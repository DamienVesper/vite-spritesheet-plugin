interface AtlasJSON {
    meta: {
        image: string
        size: {
            w: number
            h: number
        }
        scale: number
    }
    frames: Record<string, {
        frame: {
            h: number
            w: number
            x: number
            y: number
        }
        sourceSize?: {
            h: number
            w: number
        }
    }>
}

/* eslint quotes: [1, "double", "avoid-escape"] */
declare module "virtual:spritesheets-json" {
    export const atlases: AtlasJSON;
}
