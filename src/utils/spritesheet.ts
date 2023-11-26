import { platform } from 'os';
import { createHash } from 'crypto';
import sharp, { type OverlayOptions } from 'sharp';

import { MaxRectsPacker, type Rectangle } from 'maxrects-packer';

export const supportedFormats = [`png`, `jpeg`] as const;

export interface CompilerOptions {
    /**
    * Format of the output image
    * @default "png"
    */
    outputFormat: typeof supportedFormats[number]

    /**
     * Output directory
     * @default "atlases"
     */
    outDir: string

    /**
    * Added pixels between sprites (can prevent pixels leaking to adjacent sprite)
    * @default 1
    */
    margin: number

    /**
     * Remove file extensions from the atlas frames
     * @default true
     */
    removeExtensions: boolean

    /**
    * The Maximum width and height a generated image can be
    * Once a spritesheet exceeds this size a new one will be created
    * @default 4096
    */
    maximumSize: number
}

export type AtlasList = Array<{ json: AtlasJSON, image: Buffer }>;

/**
 * Pack images spritesheets.
 * @param paths List of paths to the images.
 * @param options Options passed to the packer.
 */
export async function createSpritesheets (paths: string[], options: CompilerOptions): Promise<AtlasList> {
    if (paths.length === 0) throw new Error(`No file given.`);

    if (!supportedFormats.includes(options.outputFormat)) {
        const supported = JSON.stringify(supportedFormats);
        throw new Error(`outputFormat should only be one of ${supported}, but "${options.outputFormat}" was given.`);
    }

    type PackerImage = Rectangle & {
        data: {
            sharp: sharp.Sharp
            path: string
            width: number
            height: number
        }
    };

    const packer = new MaxRectsPacker<PackerImage>(options.maximumSize, options.maximumSize, options.margin, {
        smart: true,
        pot: true,
        square: true,
        allowRotation: false
    });

    await Promise.all(paths.map(async path => {
        const image = sharp(path);

        const data = await image.metadata();

        if (data.width === undefined || data.height === undefined) {
            throw new Error(`Image ${path} has invalid width and height`);
        }

        packer.add(data.width, data.height, {
            sharp: image,
            path,
            width: data.width,
            height: data.height
        });
    }));

    const atlases: AtlasList = [];

    for (const bin of packer.bins) {
        const canvas = sharp({
            create: {
                width: bin.width,
                height: bin.height,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
        });

        const json: AtlasJSON = {
            meta: {
                image: ``,
                scale: 1,
                size: {
                    w: bin.width,
                    h: bin.height
                }
            },
            frames: {}
        };

        const images: OverlayOptions[] = [];

        for (const rect of bin.rects) {
            const image = rect.data.sharp as sharp.Sharp;

            images.push({
                input: await image.toBuffer(),
                left: rect.x,
                top: rect.y
            });

            const sourceParts = (rect.data.path as string).split(platform() === `win32` ? `\\` : `/`);
            let name = sourceParts.slice(sourceParts.length - 1, sourceParts.length).join();

            if (options.removeExtensions) {
                const temp = name.split(`.`);
                temp.splice(temp.length - 1, 1);
                name = temp.join();
            }

            json.frames[name] = {
                frame: {
                    h: rect.height,
                    w: rect.width,
                    x: rect.x,
                    y: rect.y
                }
            };
        }

        canvas.composite(images);

        canvas.toFormat(options.outputFormat);

        const buffer = await canvas.toBuffer();

        const hash = createHash(`sha1`);
        hash.setEncoding(`hex`);
        hash.write(buffer);
        hash.end();
        const sha1 = (hash.read() as string).slice(0, 8);

        json.meta.image = `${options.outDir}/atlas-${sha1}.${options.outputFormat}`;

        atlases.push({
            json,
            image: buffer
        });
    }

    return atlases;
}
