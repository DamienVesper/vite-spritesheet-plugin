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

declare module "virtual:spritesheets-json" {
    export const atlases: AtlasJSON;
}
