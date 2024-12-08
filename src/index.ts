import type { FSWatcher, Plugin, ResolvedConfig } from "vite";
import { watch } from "chokidar";
import { Minimatch } from "minimatch";
import { resolve } from "path";

import readDirectory from "./utils/readDirectory.js";
import { type AtlasList, type CompilerOptions, createSpritesheets } from "./utils/spritesheet.js";

interface Pattern {
    /**
     * Root directory to search for assets.
     */
    rootDir: string
    /**
     *  Glob expression to match assets.
     *  @default *.{png,gif,jpg,bmp,tiff,svg}
     */
    glob?: string
}

interface PluginOptions {
    /**
     * List of patterns to search for assets
     */
    patterns: Pattern[]

    options?: Partial<CompilerOptions>
}

const defaultGlob = `**/*.{png,gif,jpg,bmp,tiff,svg}`;

const PLUGIN_NAME = `vite-spritesheet-plugin`;

async function buildSpritesheets (patternsConfig: Pattern[], compilerOpts: CompilerOptions): Promise<AtlasList> {
    const files: string[] = [];

    for (const patternConfig of patternsConfig) {
        const pattern = {
            rootDir: patternConfig.rootDir,
            glob: patternConfig.glob ?? defaultGlob
        };

        const imagesMatcher = new Minimatch(pattern.glob);

        files.push(...readDirectory(pattern.rootDir).filter(x => imagesMatcher.match(x)));
    }

    return await createSpritesheets(files, compilerOpts);
}

export function spritesheet ({ patterns, options }: PluginOptions): Plugin[] {
    let watcher: FSWatcher;
    let config: ResolvedConfig;

    const compilerOpts = {
        outputFormat: `png`,
        outDir: `atlases`,
        margin: 1,
        removeExtensions: false,
        maximumSize: 4096,
        packerOptions: {
            ...options?.packerOptions
        },
        ...(options ?? {})
    } satisfies NonNullable<CompilerOptions>;

    const virtualModuleId = `virtual:spritesheets-jsons`;
    const resolvedVirtualModuleId = `\0${virtualModuleId}`;

    let spritesheets: AtlasList;

    let atlases: AtlasJSON[] = [];

    let buildTimeout: NodeJS.Timeout | undefined;

    return [
        {
            name: `${PLUGIN_NAME}:build`,
            apply: `build`,
            async buildStart () {
                this.info(`Building spritesheets`);
                spritesheets = await buildSpritesheets(patterns, compilerOpts);
                atlases = spritesheets.map(sheet => sheet.json);
            },
            generateBundle () {
                for (const sheet of spritesheets) {
                    this.emitFile({
                        type: `asset`,
                        fileName: sheet.json.meta.image,
                        source: sheet.image
                    });
                    this.info(`Built atlas ${sheet.json.meta.image}`);
                }
            },
            resolveId (id) {
                if (id === virtualModuleId)
                    return resolvedVirtualModuleId;
            },
            load (id) {
                if (id === resolvedVirtualModuleId)
                    return `export const atlases = ${JSON.stringify(atlases)}`;
            }
        },
        {
            name: `${PLUGIN_NAME}:serve`,
            apply: `serve`,
            configResolved (cfg) {
                config = cfg;
            },
            async configureServer (server) {
                function reloadPage (): void {
                    clearTimeout(buildTimeout);

                    buildTimeout = setTimeout(() => {
                        config.logger.info(`Rebuilding spritesheets`);

                        buildSheets().then(() => {
                            const module = server.moduleGraph.getModuleById(resolvedVirtualModuleId);
                            if (module !== undefined) void server.reloadModule(module);
                        }).catch(console.error);
                    }, 500);
                }

                // @ts-expect-error Chokidar types are not up-to-date.
                watcher = watch(patterns.map(pattern => resolve(pattern.rootDir, pattern.glob ?? defaultGlob)), {
                    cwd: config.root,
                    ignoreInitial: true
                })
                    .on(`add`, reloadPage)
                    .on(`change`, reloadPage)
                    .on(`unlink`, reloadPage);

                const files = new Map<string, Buffer | string>();

                async function buildSheets (): Promise<void> {
                    spritesheets = await buildSpritesheets(patterns, compilerOpts);
                    atlases = spritesheets.map(sheet => sheet.json);

                    files.clear();
                    for (const sheet of spritesheets)
                        files.set(sheet.json.meta.image, sheet.image);
                }
                await buildSheets();

                return () => {
                    server.middlewares.use((req, res, next) => {
                        if (req.originalUrl === undefined) return next();

                        const file = files.get(req.originalUrl.slice(1));
                        if (file === undefined) return next();

                        res.writeHead(200, {
                            [`Content-Type`]: `image/${compilerOpts.outputFormat}`
                        });

                        res.end(file);
                    });
                };
            },
            closeBundle: async () => {
                await watcher.close();
            },
            resolveId (id) {
                if (id === virtualModuleId)
                    return resolvedVirtualModuleId;
            },
            load (id) {
                if (id === resolvedVirtualModuleId)
                    return `export const atlases = ${JSON.stringify(atlases)}`;
            }
        }
    ];
}
