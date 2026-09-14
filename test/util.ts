import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

import {BcWasm} from "../src/wasm/wasm.ts";
import {UEVersion} from "../src/ue/versioning.ts";
import {parseAsset} from "../src/ue/cooked-asset.ts";

export async function loadWasm(): Promise<BcWasm> {
  const binary = await readFile(new URL("../wasm/bcencdec.wasm", import.meta.url));
  return BcWasm.load(new URL(`data:application/wasm;base64,${binary.toString("base64")}`));
}

export function readPpmPixels(
  bytes: Uint8Array,
  width: number,
  height: number,
  includeAlpha = false
): Uint8Array {
  let offset = 0;

  function readToken(): string {
    while (offset < bytes.length) {
      if (bytes[offset] === 0x23) {
        while (offset < bytes.length && bytes[offset] !== 0x0a) offset++;
      }
      if (bytes[offset] > 0x20) break;
      offset++;
    }

    const start = offset;
    while (offset < bytes.length && bytes[offset] > 0x20) offset++;
    return new TextDecoder().decode(bytes.subarray(start, offset));
  }

  assert.equal(readToken(), "P6");
  assert.equal(Number(readToken()), width);
  assert.equal(Number(readToken()), height);
  assert.equal(readToken(), "255");
  assert.equal(bytes[offset], 0x0a);

  const pixels = bytes.subarray(offset + 1);
  assert.equal(pixels.length, width * height * 3);

  if (!includeAlpha) {
    return pixels;
  }

  const rgba = new Uint8Array(width * height * 4);

  for (let pixel = 0; pixel < width * height; pixel++) {
    const rgbaOffset = pixel * 4;
    const rgbOffset = pixel * 3;
    rgba[rgbaOffset] = pixels[rgbOffset];
    rgba[rgbaOffset + 1] = pixels[rgbOffset + 1];
    rgba[rgbaOffset + 2] = pixels[rgbOffset + 2];
    rgba[rgbaOffset + 3] = 255;
  }

  return rgba;
}

export async function readAsset(basePath: string, version: UEVersion = UEVersion.UE5_4) {
  const [uasset, uexp, ubulk] = await Promise.all(
    [".uasset", ".uexp", ".ubulk"].map(extension => (
      readFile(new URL(basePath + extension, import.meta.url))
    )),
  );

  return parseAsset({uasset, uexp, ubulk}, version);
}