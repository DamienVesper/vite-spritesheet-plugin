import type { Plugin, ResolvedConfig } from 'vite';
import { watch, type FSWatcher } from 'chokidar';

import { resolve } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { Minimatch } from 'minimatch';

import createSpritesheet from './libs/@pencil.js/spritesheet';
import readDirectory from './utils/readDirectory';

interface Pattern {
    rootDir: string // Root directory to search for assets.
    outDir?: string // Output directory to search for assets.
    glob?: string // Glob expression to match assets.
    filename?: string // The name of the output file. Default is spritesheet.png.
}

interface PluginOptions {
    patterns: Pattern[] // All the patterns.

    // Extra compiler options.
    compilerOptions?: Partial<{
        format: `png` | `jpeg` | `svg`
        margin: number // Margin between assets.
        crop: boolean // Whether to crop extra whitespace from assets.
        svgo: boolean // Whether to optimize assets with svgo.
    }>
}

const PLUGIN_NAME = `vite-spritesheet-plugin`;

async function buildSpritesheet (patternConfig: Pattern, compilerOpts: Required<PluginOptions[`compilerOptions`]>): Promise<{ pattern: Required<Pattern>, json: string, atlas: Buffer }> {
    const pattern = {
        rootDir: patternConfig.rootDir,
        outDir: patternConfig.outDir ?? ``,

        glob: patternConfig.glob ?? `**/*.{png,gif,jpg,bmp,tiff,svg}`,
        filename: patternConfig.filename ?? `spritesheet.png`
    };

    const imagesMatcher = new Minimatch(pattern.glob);

    const files = readDirectory(pattern.rootDir).filter(x => imagesMatcher.match(x));
    const options = Object.assign({ outputName: pattern.filename }, compilerOpts);

    const { json, image } = await createSpritesheet(files, options);
    return {
        pattern,
        json: JSON.stringify(json),
        atlas: image
    };
}

export function spritesheet ({
    patterns,
    compilerOptions
}: PluginOptions): Plugin[] {
    let config: ResolvedConfig;
    let watcher: FSWatcher;

    const compilerOpts = {
        format: `png`,
        margin: 0,
        crop: true,
        svgo: true,
        ...(compilerOptions ?? {})
    } satisfies NonNullable<PluginOptions[`compilerOptions`]>;

    return [
        {
            name: `${PLUGIN_NAME}:build`,
            apply: `build`,
            configResolved: async (_config) => {
                config = _config;
            },
            writeBundle: async () => {
                for (const pattern of patterns) {
                    try {
                        const spritesheet = await buildSpritesheet(pattern, compilerOpts);
                        const filename = spritesheet.pattern.filename.replace(`.${compilerOpts.format}`, ``);

                        const dirPath = resolve(config.root, config.build.outDir, pattern.outDir ?? ``);
                        const filePath = resolve(dirPath, filename);

                        if (!existsSync(dirPath)) mkdirSync(dirPath);

                        writeFileSync(`${filePath}.${compilerOpts.format}`, spritesheet.atlas);
                        writeFileSync(`${filePath}.json`, spritesheet.json);

                        config.logger.info(`Built atlas ${filename}.${compilerOpts.format}`);
                    } catch (e: unknown) {
                        config.logger.error(`Failed to build atlas ${pattern.filename ?? `spritesheet.png`}`);
                        config.logger.error(e as string);
                    }
                }
            }
        },
        {
            name: `${PLUGIN_NAME}:serve`,
            apply: `serve`,
            configResolved: async (_config) => {
                config = _config;
            },
            configureServer: async (server) => {
                function reloadPage (): void {
                    server.ws.send({ type: `full-reload`, path: `*` });
                }

                watcher = watch(patterns.map(pattern => resolve(pattern.rootDir, pattern.glob ?? `**/*.{png,gif,jpg,bmp,tiff,svg}`)), {
                    cwd: config.root,
                    ignoreInitial: true
                })
                    .on(`add`, reloadPage)
                    .on(`change`, reloadPage)
                    .on(`unlink`, reloadPage);

                const files = new Map<string, Buffer | string>();
                for (const pattern of patterns) {
                    const spritesheet = await buildSpritesheet(pattern, compilerOpts);

                    const filename = spritesheet.pattern.filename.replace(`.${compilerOpts.format}`, ``);
                    const filePath = resolve(pattern.outDir ?? ``, filename);

                    files.set(`${filePath}.${compilerOpts.format}`, spritesheet.atlas);
                    files.set(`${filePath}.json`, spritesheet.json);
                }

                return () => {
                    server.middlewares.use((req, res, next) => {
                        if (req.url === undefined) return next();

                        const file = files.get(req.url.slice(1));
                        if (file === undefined) return next();

                        res.writeHead(200, {
                            [`Content-Type`]: req.url.endsWith(`.json`)
                                ? `application/json`
                                : req.url.endsWith(`.jpeg`)
                                    ? `image/jpeg`
                                    : `image/png`,
                            [`Cache-Control`]: `no-cache`
                        });

                        res.end(file);
                    });
                };
            },
            closeBundle: async () => {
                await watcher.close();
            }
        }
    ];
}
