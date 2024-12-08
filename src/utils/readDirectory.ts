import { readdirSync, statSync } from "fs";
import { resolve } from "path";

/**
 * Recursively read a directory.
 * @param dir The absolute path to the directory.
 * @returns An array representation of the directory's contents.
 */
const readDirectory = (dir: string): string[] => {
    let results: string[] = [];
    const files = readdirSync(dir);

    for (const file of files) {
        const filePath = resolve(dir, file);
        const stat = statSync(filePath);

        if (stat?.isDirectory()) {
            const res = readDirectory(filePath);
            results = results.concat(res);
        } else results.push(filePath);
    }

    return results;
};

export default readDirectory;
