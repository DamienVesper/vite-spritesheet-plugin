interface AtlasFrame {
    frame: {
        h: number
        w: number
        x: number
        y: number
    }
    rotated?: boolean
    sourceSize: {
        h: number
        w: number
    }
}

interface AtlasJSON {
    meta: {
        app: string
        image: string
        scale: string
        size: {
            h: number
            w: number
        }
    }
    frames: Record<string, AtlasFrame>
}

/* eslint quotes: [1, "double", "avoid-escape"] */
declare module "virtual:spritesheets-json" {
    export const atlases: AtlasJSON;
}
