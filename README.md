# vite-spritesheet-plugin
Generate large spritesheets to save on network.
Supports SVG, PNG, JPEG.

Output files are rasterized as PNG or JPEG.

## Usage
Include this in your [Vite](https://vitejs.dev) plugin configuration.

## Configuration
Configuration options are as follows:

```ts
export interface PluginOptions {
    patterns: Array<{
        rootDir: string // Root directory to search for assets.
        outDir: string // Output directory to search for assets.
        glob?: string // Glob expression to match assets.
        filename?: string // The name of the output file. Default is spritesheet.png. 
    }>

    // Extra compiler options.
    compilerOptions?: Partial<{
        format: `png` | `jpeg`
        margin: number // Margin between assets.
        crop: boolean // Whether to crop extra whitespace from assets.
        svgo: boolean // Whether to optimize assets with svgo (TBD).
    }>
}
```

To define multiple spritesheets, use multiple instances of the plugin.
