# vite-spritesheet-plugin
Generate large spritesheets to save on network.
Supports SVG, PNG, JPEG.

Output files are rasterized as PNG or JPEG.

## Usage
Include this in your [Vite](https://vitejs.dev) plugin configuration.

## Configuration
Configuration options are as follows:

```ts
interface PluginOptions {
    /**
     * List of patterns to search for assets
     */
    patterns: {
        /**
        * Root directory to search for assets.
        */
        rootDir: string
        /**
        *  Glob expression to match assets.
        *  @default *.{png,gif,jpg,bmp,tiff,svg}
        */
        glob?: string
    }[]

    options?: Partial<{
        /**
        * Format of the output image
        * @default "png"
        */
        outputFormat: "png" | "jpeg"

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
        * @default false
        */
        removeExtensions: boolean

        /**
        * The Maximum width and height a generated image can be
        * Once a spritesheet exceeds this size a new one will be created
        * @default 4096
        */
        maximumSize: number
    }>
}
```
Then to import the spritesheets, use
```ts
import { atlases } from "virtual:spritesheets-jsons";
```

### Example usage with pixi.js
```ts
import { Texture, Spritesheet, Sprite } from "pixi.js";
import { atlases } from "virtual:spritesheets-jsons";

const textures: Record<string, Texture> = {};

for (const atlas of atlases) {
    const texture = await Texture.fromURL(atlas.meta.image);
    const spriteSheet = new Spritesheet(texture, atlas);
    await spriteSheet.parse();

    for (const frame in spriteSheet.textures) {
        textures[frame] = spriteSheet.textures[frame];
    }
}

const sprite = new Sprite(textures["file_name"]);

```

