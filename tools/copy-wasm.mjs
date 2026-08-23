import {copyFile, mkdir} from "node:fs/promises";
import {join} from "node:path";
import {fileURLToPath} from "node:url";

const sourcePath = fileURLToPath(new URL("../wasm/bcencdec.wasm", import.meta.url));
const outputDirectory = fileURLToPath(new URL("../dist/wasm/", import.meta.url));

await mkdir(outputDirectory, {recursive: true});
await copyFile(sourcePath, join(outputDirectory, "bcencdec.wasm"));
