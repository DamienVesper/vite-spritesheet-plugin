import { loadImage, createCanvas, type Canvas } from 'canvas';
import pack from 'bin-pack';

import { platform } from 'os';

import cropping from '../detect-edges/index.js';

interface Options {
    outputFormat: string
    margin: number
    crop: boolean
    outputName: string
}

interface AtlasJSON {
    meta: {
        image: string
        size: {
            w: number
            h: number
        }
        scale: number
    }
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    frames: any
}

/**
 * @typedef {Object} Options
 * @prop {String} [outputFormat="png"] - Format of the output image ("png" or "jpeg")
 * @prop {Number} [margin=1] - Added pixels between sprites (can prevent pixels leaking to adjacent sprite)
 * @prop {Boolean} [crop=true] - Cut transparent pixels around sprites
 * @prop {String} [outputName="spritesheet.png"] - Name of the image file (for reference in the JSON file)
 */
const defaultOptions: Options = {
    outputFormat: `png`,
    margin: 1,
    crop: true,
    outputName: `spritesheet.png`
};

/**
 * Pack images into a spritesheet.
 * @param paths List of paths to the images.
 * @param options Options passed to the packer.
 */
const spritesheet = async (paths: string[], options: Partial<Options>): Promise<{ json: AtlasJSON, image: Buffer }> => {
    const { outputFormat, margin, crop, outputName } = {
        ...defaultOptions,
        ...options
    };

    if (paths.length === 0) throw new Error(`No file given.`);

    const supportedFormat = [`png`, `jpeg`];
    if (!supportedFormat.includes(outputFormat)) {
        const supported = JSON.stringify(supportedFormat);
        throw new Error(`outputFormat should only be one of ${supported}, but "${outputFormat}" was given.`);
    }

    const loads = paths.map(async path => await loadImage(path));
    const images = await Promise.all(loads);

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const playground = (createCanvas as any)() as Canvas;
    const playgroundContext = playground.getContext(`2d`);

    const data = await Promise.all(images.map(async (source) => {
        const { width, height } = source;
        playground.width = width;
        playground.height = height;

        playgroundContext.drawImage(source, 0, 0);

        const cropped = crop
            ? cropping(playground as unknown as HTMLCanvasElement)
            : {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0
            };

        return {
            width: (width - cropped.left - cropped.right) + margin,
            height: (height - cropped.top - cropped.bottom) + margin,
            source,
            cropped
        };
    }));

    const { items, width, height } = pack(data);

    const canvas = createCanvas(width + margin, height + margin);
    const context = canvas.getContext(`2d`);

    items.forEach(({ x, y, item }) => {
        context.drawImage(item.source, x - item.cropped.left + margin, y - item.cropped.top + margin);
    });

    const json = {
        meta: {
            image: outputName,
            size: {
                w: width,
                h: height
            },
            scale: 1
        },
        frames: items
            .sort((a, b) => (a.item.source.src as string).localeCompare(b.item.source.src as string))
            .reduce((acc: Record<string, unknown>, { x, y, width: w, height: h, item }) => {
                const sourceParts = (item.source.src as string).split(platform() === `win32` ? `\\` : `/`);
                acc[sourceParts.slice(sourceParts.length - 1, sourceParts.length).join()] = {
                    frame: {
                        x: x + margin,
                        y: y + margin,
                        w: w - margin,
                        h: h - margin
                    },
                    rotated: false,
                    trimmed: Object.values(item.cropped).some((value: number) => value > 0),
                    spriteSourceSize: {
                        x: item.cropped.left,
                        y: item.cropped.top,
                        w: w - margin,
                        h: h - margin
                    },
                    sourceSize: {
                        w: item.source.width,
                        h: item.source.height
                    }
                };
                return acc;
            }, {})
    };

    const image = canvas.toBuffer();

    return {
        json,
        image
    };
};

export default spritesheet;
