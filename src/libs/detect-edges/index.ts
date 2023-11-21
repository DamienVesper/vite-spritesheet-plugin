/* eslint-disable @typescript-eslint/no-explicit-any */
interface Options {
    tolerance: number
}

const defaultOptions = {
    tolerance: 0
};

/**
 * Check pixel transparency.
 * @param tolerance Tolerance level.
 */
const checkOpacityLevel = (tolerance: number) => (pixels: any): boolean => {
    let transparent = true;
    for (let i = 3; i < pixels.length && transparent; i += 4) {
        transparent = transparent && pixels[i] === 255 * tolerance;
    }

    return transparent;
};

/**
 * Smartly detect edges of an image.
 * @param canvas Tainted canvas element.
 * @param options Options.
 */
const detectEdges = (canvas: HTMLCanvasElement, options?: Partial<Options>): Record<`top` | `bottom` | `left` | `right`, number> => {
    const { tolerance } = {
        ...defaultOptions,
        ...options
    };

    const isTransparent = checkOpacityLevel(tolerance);
    const { width, height } = canvas;

    const context = canvas.getContext(`2d`);
    if (context === null) throw new Error(`Failed to load canvas.`);

    let pixels: any;

    let top = -1;
    do {
        ++top;
        pixels = context.getImageData(0, top, width, 1).data;
    } while (isTransparent(pixels));

    if (top === height) {
        throw new Error(`Can't detect edges.`);
    }

    // Left
    let left = -1;
    do {
        ++left;
        pixels = context.getImageData(left, top, 1, height - top).data;
    } while (isTransparent(pixels));

    // Bottom
    let bottom = -1;
    do {
        ++bottom;
        pixels = context.getImageData(left, height - bottom - 1, width - left, 1).data;
    } while (isTransparent(pixels));

    // Right
    let right = -1;
    do {
        ++right;
        pixels = context.getImageData(width - right - 1, top, 1, height - (top + bottom)).data;
    } while (isTransparent(pixels));

    return {
        top,
        right,
        bottom,
        left
    };
};

export default detectEdges;
