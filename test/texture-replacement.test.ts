import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";

import {decodeTextureMip} from "../src/texture/decoding.ts";
import {rebuildVirtualTexture} from "../src/texture/vt-replacement.ts";
import {replaceTexture} from "../src/texture/replacement.ts";
import {parseAsset} from "../src/ue/cooked-asset.ts";
import {UEVersion} from "../src/ue/versioning.ts";
import {PACKAGE_FILE_TAG} from "../src/ue/summary.ts";
import {BulkDataFlags, BulkType} from "../src/ue/uasset.ts";
import {UINT32_MAX} from "../src/util.ts";
import {loadWasm} from "./util.ts";
import {generateTextureMips} from "../src/texture/mips.ts";

async function readAsset(basePath: string, version: UEVersion = UEVersion.UE5_4) {
  const [uasset, uexp, ubulk] = await Promise.all(
    [".uasset", ".uexp", ".ubulk"].map(extension => (
      readFile(new URL(basePath + extension, import.meta.url))
    )),
  );
  return parseAsset({uasset, uexp, ubulk}, version);
}

// -------- Swap tests --------

test("Swap_UE5_2__Texture2D_BC1", async () => {
  const original = await readAsset("./assets/ue5_2/swap_bc1/original/T_Blocks_BC1_BC", UEVersion.UE5_2);
  const editorSwap = await readAsset("./assets/ue5_2/swap_bc1/swapped/T_Blocks_BC1_BC", UEVersion.UE5_2);
  const originalSnapshot = structuredClone(original);

  const wasm = await loadWasm();
  const rgba = new Uint8Array(2048 * 2048 * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba.set([40, 100, 200, 255], offset);
  }

  const progress: Array<readonly [number, number]> = [];
  const originalRgba = rgba.slice();
  const output = await replaceTexture(original, rgba, 2048, 2048, wasm, {
    quality: 0,
    onProgress: (completed, total) => progress.push([completed, total]),
  });
  assert.deepStrictEqual(structuredClone(original), originalSnapshot);
  assert.deepStrictEqual(rgba, originalRgba);
  assert.equal(output.uasset.byteLength, editorSwap.files.uasset.byteLength);
  assert.equal(output.uexp.byteLength, editorSwap.files.uexp.byteLength);
  assert.equal(output.ubulk?.byteLength, editorSwap.files.ubulk?.byteLength);
  assert.equal(
    new DataView(output.uexp.buffer, output.uexp.byteOffset).getUint32(
      output.uexp.byteLength - 4,
      true,
    ),
    PACKAGE_FILE_TAG,
  );
  assert.deepStrictEqual(progress[0], [0, 2_796_216]);
  assert.deepStrictEqual(progress.at(-1), [2_796_216, 2_796_216]);

  const replaced = parseAsset(output, UEVersion.UE5_2);
  const texture = replaced.getTextureExport();
  const expectedTexture = editorSwap.getTextureExport();
  assert.equal(texture.importedWidth, 2048);
  assert.equal(texture.importedHeight, 2048);
  assert.equal(texture.mipCount, 12);
  assert.equal(texture.skipOffset, expectedTexture.skipOffset);
  assert.deepStrictEqual(
    texture.mips.map(mip => [mip.width, mip.height, mip.depth]),
    expectedTexture.mips.map(mip => [mip.width, mip.height, mip.depth]),
  );
  assert.deepStrictEqual(
    replaced.uasset.dataResourceMap.map(resource => [
      resource.serialOffset,
      resource.serialSize,
      resource.rawSize,
      resource.bulkType,
    ]),
    editorSwap.uasset.dataResourceMap.map(resource => [
      resource.serialOffset,
      resource.serialSize,
      resource.rawSize,
      resource.bulkType,
    ]),
  );
  assert.equal(replaced.uasset.summary.totalHeaderSize, editorSwap.uasset.summary.totalHeaderSize);
  assert.equal(
    replaced.uasset.summary.bulkDataStartOffset,
    editorSwap.uasset.summary.bulkDataStartOffset,
  );
  assert.equal(
    replaced.uasset.exportMap[0]?.serialSize,
    editorSwap.uasset.exportMap[0]?.serialSize
  );
  assert.equal(
    replaced.uasset.exportMap[0]?.serialOffset,
    editorSwap.uasset.exportMap[0]?.serialOffset,
  );

  const lastMip = await decodeTextureMip(replaced, 11, wasm);
  assert.ok(Math.abs(lastMip.rgba[0]! - 40) <= 10);
  assert.ok(Math.abs(lastMip.rgba[1]! - 100) <= 10);
  assert.ok(Math.abs(lastMip.rgba[2]! - 200) <= 10);
  assert.equal(lastMip.rgba[3], 255);
});

test("Swap_UE5_3__Texture2D_BC1", async () => {
  const original = await readAsset("./assets/ue5_3/swap_bc1/original/T_Blocks_BC1_BC", UEVersion.UE5_3);
  const editorSwap = await readAsset("./assets/ue5_3/swap_bc1/swapped/T_Blocks_BC1_BC", UEVersion.UE5_3);
  const originalSnapshot = structuredClone(original);

  const wasm = await loadWasm();
  const rgba = new Uint8Array(2048 * 2048 * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba.set([40, 100, 200, 255], offset);
  }

  const progress: Array<readonly [number, number]> = [];
  const originalRgba = rgba.slice();
  const output = await replaceTexture(original, rgba, 2048, 2048, wasm, {
    quality: 0,
    onProgress: (completed, total) => progress.push([completed, total]),
  });
  assert.deepStrictEqual(structuredClone(original), originalSnapshot);
  assert.deepStrictEqual(rgba, originalRgba);
  assert.equal(output.uasset.byteLength, editorSwap.files.uasset.byteLength);
  assert.equal(output.uexp.byteLength, editorSwap.files.uexp.byteLength);
  assert.equal(output.ubulk?.byteLength, editorSwap.files.ubulk?.byteLength);
  assert.equal(
    new DataView(output.uexp.buffer, output.uexp.byteOffset).getUint32(
      output.uexp.byteLength - 4,
      true,
    ),
    PACKAGE_FILE_TAG,
  );
  assert.deepStrictEqual(progress[0], [0, 2_796_216]);
  assert.deepStrictEqual(progress.at(-1), [2_796_216, 2_796_216]);

  const replaced = parseAsset(output, UEVersion.UE5_3);
  const texture = replaced.getTextureExport();
  const expectedTexture = editorSwap.getTextureExport();
  assert.equal(texture.importedWidth, 2048);
  assert.equal(texture.importedHeight, 2048);
  assert.equal(texture.mipCount, 12);
  assert.equal(texture.skipOffset, expectedTexture.skipOffset);
  assert.deepStrictEqual(
    texture.mips.map(mip => [mip.width, mip.height, mip.depth]),
    expectedTexture.mips.map(mip => [mip.width, mip.height, mip.depth]),
  );
  assert.deepStrictEqual(
    replaced.uasset.dataResourceMap.map(resource => [
      resource.serialOffset,
      resource.serialSize,
      resource.rawSize,
      resource.bulkType,
    ]),
    editorSwap.uasset.dataResourceMap.map(resource => [
      resource.serialOffset,
      resource.serialSize,
      resource.rawSize,
      resource.bulkType,
    ]),
  );
  assert.equal(replaced.uasset.summary.totalHeaderSize, editorSwap.uasset.summary.totalHeaderSize);
  assert.equal(
    replaced.uasset.summary.bulkDataStartOffset,
    editorSwap.uasset.summary.bulkDataStartOffset,
  );
  assert.equal(
    replaced.uasset.exportMap[0]?.serialSize,
    editorSwap.uasset.exportMap[0]?.serialSize
  );
  assert.equal(
    replaced.uasset.exportMap[0]?.serialOffset,
    editorSwap.uasset.exportMap[0]?.serialOffset,
  );

  const lastMip = await decodeTextureMip(replaced, 11, wasm);
  assert.ok(Math.abs(lastMip.rgba[0]! - 40) <= 10);
  assert.ok(Math.abs(lastMip.rgba[1]! - 100) <= 10);
  assert.ok(Math.abs(lastMip.rgba[2]! - 200) <= 10);
  assert.equal(lastMip.rgba[3], 255);
});

test("Swap_UE5_4__Texture2D_BC1", async () => {
  const original = await readAsset("./assets/ue5_4/swap_bc1/original/T_Blocks2_BC1_BC");
  const editorSwap = await readAsset("./assets/ue5_4/swap_bc1/swapped/T_Blocks2_BC1_BC");
  const originalSnapshot = structuredClone(original);

  const wasm = await loadWasm();
  const rgba = new Uint8Array(2048 * 2048 * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba.set([40, 100, 200, 255], offset);
  }

  const progress: Array<readonly [number, number]> = [];
  const originalRgba = rgba.slice();
  const output = await replaceTexture(original, rgba, 2048, 2048, wasm, {
    quality: 0,
    onProgress: (completed, total) => progress.push([completed, total]),
  });
  assert.deepStrictEqual(structuredClone(original), originalSnapshot);
  assert.deepStrictEqual(rgba, originalRgba);
  assert.equal(output.uasset.byteLength, editorSwap.files.uasset.byteLength);
  assert.equal(output.uexp.byteLength, editorSwap.files.uexp.byteLength);
  assert.equal(output.ubulk?.byteLength, editorSwap.files.ubulk?.byteLength);
  assert.equal(
    new DataView(output.uexp.buffer, output.uexp.byteOffset).getUint32(
      output.uexp.byteLength - 4,
      true,
    ),
    PACKAGE_FILE_TAG,
  );
  assert.deepStrictEqual(progress[0], [0, 2_796_216]);
  assert.deepStrictEqual(progress.at(-1), [2_796_216, 2_796_216]);

  const replaced = parseAsset(output, UEVersion.UE5_4);
  const texture = replaced.getTextureExport();
  const expectedTexture = editorSwap.getTextureExport();
  assert.equal(texture.importedWidth, 2048);
  assert.equal(texture.importedHeight, 2048);
  assert.equal(texture.mipCount, 12);
  assert.equal(texture.skipOffset, expectedTexture.skipOffset);
  assert.deepStrictEqual(
    texture.mips.map(mip => [mip.width, mip.height, mip.depth]),
    expectedTexture.mips.map(mip => [mip.width, mip.height, mip.depth]),
  );
  assert.deepStrictEqual(
    replaced.uasset.dataResourceMap.map(resource => [
      resource.serialOffset,
      resource.serialSize,
      resource.rawSize,
      resource.bulkType,
    ]),
    editorSwap.uasset.dataResourceMap.map(resource => [
      resource.serialOffset,
      resource.serialSize,
      resource.rawSize,
      resource.bulkType,
    ]),
  );
  assert.equal(replaced.uasset.summary.totalHeaderSize, editorSwap.uasset.summary.totalHeaderSize);
  assert.equal(
    replaced.uasset.summary.bulkDataStartOffset,
    editorSwap.uasset.summary.bulkDataStartOffset,
  );
  assert.equal(
    replaced.uasset.exportMap[0]?.serialSize,
    editorSwap.uasset.exportMap[0]?.serialSize
  );
  assert.equal(
    replaced.uasset.exportMap[0]?.serialOffset,
    editorSwap.uasset.exportMap[0]?.serialOffset,
  );

  const lastMip = await decodeTextureMip(replaced, 11, wasm);
  assert.ok(Math.abs(lastMip.rgba[0]! - 40) <= 10);
  assert.ok(Math.abs(lastMip.rgba[1]! - 100) <= 10);
  assert.ok(Math.abs(lastMip.rgba[2]! - 200) <= 10);
  assert.equal(lastMip.rgba[3], 255);
});

test("Swap_UE5_5__Texture2D_BC1", async () => {
  const original = await readAsset("./assets/ue5_5/swap_bc1/original/T_Blocks_BC1_BC", UEVersion.UE5_5);
  const editorSwap = await readAsset("./assets/ue5_5/swap_bc1/swapped/T_Blocks_BC1_BC", UEVersion.UE5_5);
  const originalSnapshot = structuredClone(original);

  const wasm = await loadWasm();
  const rgba = new Uint8Array(2048 * 2048 * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba.set([40, 100, 200, 255], offset);
  }

  const progress: Array<readonly [number, number]> = [];
  const originalRgba = rgba.slice();
  const output = await replaceTexture(original, rgba, 2048, 2048, wasm, {
    quality: 0,
    onProgress: (completed, total) => progress.push([completed, total]),
  });
  assert.deepStrictEqual(structuredClone(original), originalSnapshot);
  assert.deepStrictEqual(rgba, originalRgba);
  assert.equal(output.uasset.byteLength, editorSwap.files.uasset.byteLength);
  assert.equal(output.uexp.byteLength, editorSwap.files.uexp.byteLength);
  assert.equal(output.ubulk?.byteLength, editorSwap.files.ubulk?.byteLength);
  assert.equal(
    new DataView(output.uexp.buffer, output.uexp.byteOffset).getUint32(
      output.uexp.byteLength - 4,
      true,
    ),
    PACKAGE_FILE_TAG,
  );
  assert.deepStrictEqual(progress[0], [0, 2_796_216]);
  assert.deepStrictEqual(progress.at(-1), [2_796_216, 2_796_216]);

  const replaced = parseAsset(output, UEVersion.UE5_5);
  const texture = replaced.getTextureExport();
  const expectedTexture = editorSwap.getTextureExport();
  assert.equal(texture.importedWidth, 2048);
  assert.equal(texture.importedHeight, 2048);
  assert.equal(texture.mipCount, 12);
  assert.equal(texture.skipOffset, expectedTexture.skipOffset);
  assert.deepStrictEqual(
    texture.mips.map(mip => [mip.width, mip.height, mip.depth]),
    expectedTexture.mips.map(mip => [mip.width, mip.height, mip.depth]),
  );
  assert.deepStrictEqual(
    replaced.uasset.dataResourceMap.map(resource => [
      resource.serialOffset,
      resource.serialSize,
      resource.rawSize,
      resource.bulkType,
    ]),
    editorSwap.uasset.dataResourceMap.map(resource => [
      resource.serialOffset,
      resource.serialSize,
      resource.rawSize,
      resource.bulkType,
    ]),
  );
  assert.equal(replaced.uasset.summary.totalHeaderSize, editorSwap.uasset.summary.totalHeaderSize);
  assert.equal(
    replaced.uasset.summary.bulkDataStartOffset,
    editorSwap.uasset.summary.bulkDataStartOffset,
  );
  assert.equal(
    replaced.uasset.exportMap[0]?.serialSize,
    editorSwap.uasset.exportMap[0]?.serialSize
  );
  assert.equal(
    replaced.uasset.exportMap[0]?.serialOffset,
    editorSwap.uasset.exportMap[0]?.serialOffset,
  );

  const lastMip = await decodeTextureMip(replaced, 11, wasm);
  assert.ok(Math.abs(lastMip.rgba[0]! - 40) <= 10);
  assert.ok(Math.abs(lastMip.rgba[1]! - 100) <= 10);
  assert.ok(Math.abs(lastMip.rgba[2]! - 200) <= 10);
  assert.equal(lastMip.rgba[3], 255);
});

test("Swap_UE5_6__Texture2D_BC1", async () => {
  const original = await readAsset("./assets/ue5_6/swap_bc1/original/T_Blocks_BC1_BC", UEVersion.UE5_6);
  const editorSwap = await readAsset("./assets/ue5_6/swap_bc1/swapped/T_Blocks_BC1_BC", UEVersion.UE5_6);
  const originalSnapshot = structuredClone(original);

  const wasm = await loadWasm();
  const rgba = new Uint8Array(2048 * 2048 * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba.set([40, 100, 200, 255], offset);
  }

  const progress: Array<readonly [number, number]> = [];
  const originalRgba = rgba.slice();
  const output = await replaceTexture(original, rgba, 2048, 2048, wasm, {
    quality: 0,
    onProgress: (completed, total) => progress.push([completed, total]),
  });
  assert.deepStrictEqual(structuredClone(original), originalSnapshot);
  assert.deepStrictEqual(rgba, originalRgba);
  assert.equal(output.uasset.byteLength, editorSwap.files.uasset.byteLength);
  assert.equal(output.uexp.byteLength, editorSwap.files.uexp.byteLength);
  assert.equal(output.ubulk?.byteLength, editorSwap.files.ubulk?.byteLength);
  assert.equal(
    new DataView(output.uexp.buffer, output.uexp.byteOffset).getUint32(
      output.uexp.byteLength - 4,
      true,
    ),
    PACKAGE_FILE_TAG,
  );
  assert.deepStrictEqual(progress[0], [0, 2_796_216]);
  assert.deepStrictEqual(progress.at(-1), [2_796_216, 2_796_216]);

  const replaced = parseAsset(output, UEVersion.UE5_6);
  const texture = replaced.getTextureExport();
  const expectedTexture = editorSwap.getTextureExport();
  assert.equal(texture.importedWidth, 2048);
  assert.equal(texture.importedHeight, 2048);
  assert.equal(texture.mipCount, 12);
  assert.equal(texture.skipOffset, expectedTexture.skipOffset);
  assert.deepStrictEqual(
    texture.mips.map(mip => [mip.width, mip.height, mip.depth]),
    expectedTexture.mips.map(mip => [mip.width, mip.height, mip.depth]),
  );
  assert.deepStrictEqual(
    replaced.uasset.dataResourceMap.map(resource => [
      resource.serialOffset,
      resource.serialSize,
      resource.rawSize,
      resource.bulkType,
    ]),
    editorSwap.uasset.dataResourceMap.map(resource => [
      resource.serialOffset,
      resource.serialSize,
      resource.rawSize,
      resource.bulkType,
    ]),
  );
  assert.equal(replaced.uasset.summary.totalHeaderSize, editorSwap.uasset.summary.totalHeaderSize);
  assert.equal(
    replaced.uasset.summary.bulkDataStartOffset,
    editorSwap.uasset.summary.bulkDataStartOffset,
  );
  assert.equal(
    replaced.uasset.exportMap[0]?.serialSize,
    editorSwap.uasset.exportMap[0]?.serialSize
  );
  assert.equal(
    replaced.uasset.exportMap[0]?.serialOffset,
    editorSwap.uasset.exportMap[0]?.serialOffset,
  );

  const lastMip = await decodeTextureMip(replaced, 11, wasm);
  assert.ok(Math.abs(lastMip.rgba[0]! - 40) <= 10);
  assert.ok(Math.abs(lastMip.rgba[1]! - 100) <= 10);
  assert.ok(Math.abs(lastMip.rgba[2]! - 200) <= 10);
  assert.equal(lastMip.rgba[3], 255);
});

test("Swap_UE5_7__Texture2D_BC1", async () => {
  const original = await readAsset("./assets/ue5_7/swap_bc1/original/T_Blocks_BC1_BC", UEVersion.UE5_7);
  const editorSwap = await readAsset("./assets/ue5_7/swap_bc1/swapped/T_Blocks_BC1_BC", UEVersion.UE5_7);
  const originalSnapshot = structuredClone(original);

  const wasm = await loadWasm();
  const rgba = new Uint8Array(2048 * 2048 * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba.set([40, 100, 200, 255], offset);
  }

  const progress: Array<readonly [number, number]> = [];
  const originalRgba = rgba.slice();
  const output = await replaceTexture(original, rgba, 2048, 2048, wasm, {
    quality: 0,
    onProgress: (completed, total) => progress.push([completed, total]),
  });
  assert.deepStrictEqual(structuredClone(original), originalSnapshot);
  assert.deepStrictEqual(rgba, originalRgba);
  assert.equal(output.uasset.byteLength, editorSwap.files.uasset.byteLength);
  assert.equal(output.uexp.byteLength, editorSwap.files.uexp.byteLength);
  assert.equal(output.ubulk?.byteLength, editorSwap.files.ubulk?.byteLength);
  assert.equal(
    new DataView(output.uexp.buffer, output.uexp.byteOffset).getUint32(
      output.uexp.byteLength - 4,
      true,
    ),
    PACKAGE_FILE_TAG,
  );
  assert.deepStrictEqual(progress[0], [0, 2_796_216]);
  assert.deepStrictEqual(progress.at(-1), [2_796_216, 2_796_216]);

  const replaced = parseAsset(output, UEVersion.UE5_7);
  const texture = replaced.getTextureExport();
  const expectedTexture = editorSwap.getTextureExport();
  assert.equal(texture.importedWidth, 2048);
  assert.equal(texture.importedHeight, 2048);
  assert.equal(texture.mipCount, 12);
  assert.equal(texture.skipOffset, expectedTexture.skipOffset);
  assert.deepStrictEqual(
    texture.mips.map(mip => [mip.width, mip.height, mip.depth]),
    expectedTexture.mips.map(mip => [mip.width, mip.height, mip.depth]),
  );
  assert.deepStrictEqual(
    replaced.uasset.dataResourceMap.map(resource => [
      resource.serialOffset,
      resource.serialSize,
      resource.rawSize,
      resource.bulkType,
    ]),
    editorSwap.uasset.dataResourceMap.map(resource => [
      resource.serialOffset,
      resource.serialSize,
      resource.rawSize,
      resource.bulkType,
    ]),
  );
  assert.equal(replaced.uasset.summary.totalHeaderSize, editorSwap.uasset.summary.totalHeaderSize);
  assert.equal(
    replaced.uasset.summary.bulkDataStartOffset,
    editorSwap.uasset.summary.bulkDataStartOffset,
  );
  assert.equal(
    replaced.uasset.exportMap[0]?.serialSize,
    editorSwap.uasset.exportMap[0]?.serialSize
  );
  assert.equal(
    replaced.uasset.exportMap[0]?.serialOffset,
    editorSwap.uasset.exportMap[0]?.serialOffset,
  );

  const lastMip = await decodeTextureMip(replaced, 11, wasm);
  assert.ok(Math.abs(lastMip.rgba[0]! - 40) <= 10);
  assert.ok(Math.abs(lastMip.rgba[1]! - 100) <= 10);
  assert.ok(Math.abs(lastMip.rgba[2]! - 200) <= 10);
  assert.equal(lastMip.rgba[3], 255);
});

// -------- Misc tests --------

test("generates a complete box-filtered RGBA mip chain", () => {
  const rgba = new Uint8Array(3 * 2 * 4);
  const colors = [
    [0, 10, 20, 30],
    [30, 40, 50, 60],
    [60, 70, 80, 90],
    [90, 100, 110, 120],
    [120, 130, 140, 150],
    [150, 160, 170, 180]
  ];
  colors.forEach((color, index) => rgba.set(color, index * 4));

  const mips = generateTextureMips(rgba, 3, 2);
  assert.deepStrictEqual(mips.map(mip => [mip.width, mip.height]), [[3, 2], [1, 1]]);
  assert.deepStrictEqual(mips[0]?.rgba, rgba);
  assert.notStrictEqual(mips[0]?.rgba, rgba);
  assert.deepStrictEqual(mips[1]?.rgba, Uint8Array.of(75, 85, 95, 105));
});

test("replaces BGRA8 textures without a block codec", async () => {
  const original = await readAsset("./assets/ue5_4/T_Blocky_1K_B8G8R8A8_BC");
  const rgba = Uint8Array.of(
    1, 2, 3, 4, 10, 20, 30, 40,
    50, 60, 70, 80, 90, 100, 110, 120,
  );

  const output = await replaceTexture(original, rgba, 2, 2);
  const replaced = parseAsset(output, UEVersion.UE5_4);
  const texture = replaced.getTextureExport();
  assert.deepStrictEqual(texture.mips.map(mip => [mip.width, mip.height]), [[2, 2], [1, 1]]);
  assert.ok(replaced.uasset.dataResourceMap.every(resource => resource.bulkType === BulkType.Uexp));
  assert.equal(output.ubulk?.byteLength, 0);
  assert.deepStrictEqual((await decodeTextureMip(replaced, 0)).rgba, rgba);
  assert.deepStrictEqual(
    (await decodeTextureMip(replaced, 1)).rgba,
    Uint8Array.of(38, 46, 53, 61),
  );
});

test("preserves optional bulk storage and the inline dimension threshold", async () => {
  const original = await readAsset("./assets/ue5_4/T_Blocky_1K_B8G8R8A8_BC");
  for (const resource of original.uasset.dataResourceMap) {
    if (resource.bulkType === BulkType.Ubulk) {
      resource.bulkDataFlags |= BulkDataFlags.OptionalPayload;
    }
  }
  const firstInlineMip = original.getTextureExport().mips.find(mip => (
    original.uasset.dataResourceMap[mip.dataResourceIndex]!.bulkType === BulkType.Uexp
  ));
  assert.ok(firstInlineMip);
  const threshold = Math.max(firstInlineMip.width, firstInlineMip.height);
  const width = threshold * 2;
  const rgba = new Uint8Array(width * 4).fill(123);
  const originalSnapshot = structuredClone(original);

  const output = await replaceTexture(original, rgba, width, 1);
  const replaced = parseAsset(output, UEVersion.UE5_4);
  assert.deepStrictEqual(structuredClone(original), originalSnapshot);
  assert.equal(output.uptnl?.byteLength, rgba.byteLength);
  assert.equal(output.ubulk?.byteLength, 0);
  for (const mip of replaced.getTextureExport().mips) {
    const resource = replaced.uasset.dataResourceMap[mip.dataResourceIndex]!;
    assert.equal(resource.bulkType, mip.width > threshold ? BulkType.Uptnl : BulkType.Uexp);
    assert.equal(resource.serialSize, BigInt(mip.width * mip.height * 4));
    assert.equal(resource.rawSize, resource.serialSize);
  }
  assert.deepStrictEqual((await decodeTextureMip(replaced, 0)).rgba, rgba);
});

test("replaces and resizes the editor BC1 virtual texture fixture", async () => {
  const original = await readAsset("./assets/ue5_4/swap_bc1_vt/original/T_Blocks2_BC1_VT_BC");
  const editorSwap = await readAsset("./assets/ue5_4/swap_bc1_vt/swapped/T_Blocks2_BC1_VT_BC");
  const originalVirtual = original.getTextureExport().virtualTextureData;
  assert.ok(originalVirtual !== null);
  const originalWidth = originalVirtual.width;
  const originalSnapshot = structuredClone(original);

  const wasm = await loadWasm();
  const rgba = new Uint8Array(2048 * 2048 * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba.set([40, 100, 200, 255], offset);
  }

  const progress: Array<readonly [number, number]> = [];
  const originalRgba = rgba.slice();
  const output = await replaceTexture(original, rgba, 2048, 2048, wasm, {
    quality: 0,
    onProgress: (completed, total) => progress.push([completed, total]),
  });
  assert.deepStrictEqual(structuredClone(original), originalSnapshot);
  assert.deepStrictEqual(rgba, originalRgba);
  assert.equal(output.uasset.byteLength, editorSwap.files.uasset.byteLength);
  assert.equal(output.uexp.byteLength, editorSwap.files.uexp.byteLength);
  assert.equal(output.ubulk?.byteLength, editorSwap.files.ubulk?.byteLength);
  assert.deepStrictEqual(progress[0], [0, 3_218_304]);
  assert.deepStrictEqual(progress.at(-1), [3_218_304, 3_218_304]);
  assert.equal(originalVirtual.width, originalWidth);

  const replaced = parseAsset(output, UEVersion.UE5_4);
  const texture = replaced.getTextureExport();
  const expectedTexture = editorSwap.getTextureExport();
  const virtual = texture.virtualTextureData;
  const expectedVirtual = expectedTexture.virtualTextureData;
  assert.ok(virtual !== null);
  assert.ok(expectedVirtual !== null);

  assert.equal(texture.importedWidth, 2048);
  assert.equal(texture.importedHeight, 2048);
  assert.equal(texture.mipCount, 0);
  assert.equal(texture.skipOffset, expectedTexture.skipOffset);
  assert.equal(virtual.width, 2048);
  assert.equal(virtual.height, 2048);
  assert.equal(virtual.numMips, 12);
  assert.deepStrictEqual(virtual.chunkIndexPerMip, expectedVirtual.chunkIndexPerMip);
  assert.deepStrictEqual(virtual.baseOffsetPerMip, expectedVirtual.baseOffsetPerMip);
  assert.deepStrictEqual(virtual.tileOffsetData, expectedVirtual.tileOffsetData);
  assert.deepStrictEqual(
    virtual.chunks.map(chunk => [
      chunk.sizeInBytes,
      chunk.codecPayloadSize,
      chunk.layerInfos,
      chunk.dataResourceIndex,
    ]),
    expectedVirtual.chunks.map(chunk => [
      chunk.sizeInBytes,
      chunk.codecPayloadSize,
      chunk.layerInfos,
      chunk.dataResourceIndex,
    ]),
  );
  assert.deepStrictEqual(
    replaced.uasset.dataResourceMap.map(resource => [
      resource.serialOffset,
      resource.serialSize,
      resource.rawSize,
      resource.bulkType,
    ]),
    editorSwap.uasset.dataResourceMap.map(resource => [
      resource.serialOffset,
      resource.serialSize,
      resource.rawSize,
      resource.bulkType,
    ]),
  );
  assert.equal(replaced.uasset.summary.totalHeaderSize, editorSwap.uasset.summary.totalHeaderSize);
  assert.equal(
    replaced.uasset.summary.bulkDataStartOffset,
    editorSwap.uasset.summary.bulkDataStartOffset,
  );
  assert.equal(replaced.uasset.exportMap[0]?.serialSize, editorSwap.uasset.exportMap[0]?.serialSize);

  for (const chunk of virtual.chunks) {
    const payload = replaced.readDataResource(chunk.dataResourceIndex);
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", payload.slice()));
    assert.deepStrictEqual(chunk.bulkDataHash, hash);
  }

  const lastMip = await decodeTextureMip(replaced, 11, wasm);
  assert.ok(Math.abs(lastMip.rgba[0]! - 40) <= 10);
  assert.ok(Math.abs(lastMip.rgba[1]! - 100) <= 10);
  assert.ok(Math.abs(lastMip.rgba[2]! - 200) <= 10);
  assert.equal(lastMip.rgba[3], 255);
});

test("writes Morton-ordered virtual tiles with wrapped borders", async () => {
  const original = await readAsset(
    "./assets/ue5_4/swap_bc1_vt/original/T_Blocks2_BC1_VT_BC",
  );
  const tileSize = 128;
  const tilesWide = 3;
  const tilesHigh = 2;
  const width = tilesWide * tileSize;
  const height = tilesHigh * tileSize;
  const rgba = new Uint8Array(width * height * 4);
  const colors = [
    [200, 20, 20, 255],
    [20, 200, 20, 255],
    [20, 20, 200, 255],
    [220, 220, 20, 255],
    [220, 20, 220, 255],
    [20, 220, 220, 255],
  ] as const;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = colors[Math.floor(y / tileSize) * tilesWide + Math.floor(x / tileSize)];
      rgba.set(color, (y * width + x) * 4);
    }
  }

  const wasm = await loadWasm();
  const output = await replaceTexture(original, rgba, width, height, wasm, {quality: 0});
  const replaced = parseAsset(output, UEVersion.UE5_4);
  const decoded = await decodeTextureMip(replaced, 0, wasm);
  for (let tileY = 0; tileY < tilesHigh; tileY++) {
    for (let tileX = 0; tileX < tilesWide; tileX++) {
      assertColorNear(
        decoded.rgba,
        width,
        tileX * tileSize + tileSize / 2,
        tileY * tileSize + tileSize / 2,
        colors[tileY * tilesWide + tileX],
      );
    }
  }

  const virtual = replaced.getTextureExport().virtualTextureData;
  assert.ok(virtual !== null);
  assert.deepStrictEqual(virtual.tileOffsetData[0].addresses, [0, 5, 6]);
  assert.deepStrictEqual(virtual.tileOffsetData[0].offsets, [0, UINT32_MAX, 5]);
  const chunk = virtual.chunks[virtual.chunkIndexPerMip[0]];
  const chunkData = replaced.readDataResource(chunk.dataResourceIndex);
  const tileStart = virtual.baseOffsetPerMip[0];
  const tileLength = virtual.tileDataOffsetPerLayer[0];
  const physicalTile = await wasm.decode(
    "bc1",
    chunkData.subarray(tileStart, tileStart + tileLength),
    136,
    136,
  );
  assertColorNear(physicalTile, 136, 68, 0, colors[3]);
  assertColorNear(physicalTile, 136, 0, 68, colors[2]);
  assertColorNear(physicalTile, 136, 0, 0, colors[5]);
  assertColorNear(physicalTile, 136, 68, 68, colors[0]);
});

test("virtual atlas encoding preserves aggregate progress and sequential dispatch", async () => {
  const asset = await readAsset("./assets/ue5_4/swap_bc1_vt/original/T_Blocks2_BC1_VT_BC");
  const builtData = asset.getTextureExport().virtualTextureData;
  assert.ok(builtData);
  builtData.tileSize = 4;
  builtData.tileBorderSize = 0;
  const mips = generateTextureMips(new Uint8Array(8 * 4 * 4), 8, 4);
  const progress: Array<readonly [number, number]> = [];
  const widths: number[] = [];
  let active = false;
  await rebuildVirtualTexture(builtData, mips, {
    async encode(format, _rgba, width, height, options) {
      assert.equal(active, false);
      active = true;
      assert.equal(format, "bc1");
      assert.equal(options?.quality, 0);
      assert.equal(options?.perceptual, false);
      widths.push(width);
      options?.onProgress?.(1, 3);
      await Promise.resolve();
      active = false;
      return new Uint8Array(width * height / 2);
    },
  }, {
    quality: 0,
    perceptual: false,
    onProgress: (completed, total) => progress.push([completed, total]),
  });
  assert.deepStrictEqual(widths, [8, 4, 4, 4]);
  assert.deepStrictEqual(progress, [
    [0, 40], [5, 40], [16, 40], [18, 40], [24, 40],
    [26, 40], [32, 40], [34, 40], [40, 40],
  ]);
});

test("encodes BGRA virtual tiles without a block codec", async () => {
  const asset = await readAsset("./assets/ue5_4/swap_bc1_vt/original/T_Blocks2_BC1_VT_BC");
  const builtData = asset.getTextureExport().virtualTextureData;
  assert.ok(builtData !== null);
  builtData.layerTypes = ["PF_B8G8R8A8"];
  builtData.tileSize = 4;
  builtData.tileBorderSize = 1;

  const mips = generateTextureMips(Uint8Array.of(11, 22, 33, 44), 1, 1);
  const progress: Array<readonly [number, number]> = [];
  const payloads = await rebuildVirtualTexture(builtData, mips, undefined, {
    onProgress: (completed, total) => progress.push([completed, total]),
  });

  const expected = new Uint8Array(4 + 6 * 6 * 4);
  for (let offset = 4; offset < expected.length; offset += 4) {
    expected.set([33, 22, 11, 44], offset);
  }
  assert.deepStrictEqual(payloads, [expected]);
  assert.deepStrictEqual(builtData.tileDataOffsetPerLayer, [144]);
  assert.deepStrictEqual(progress, [[0, 144], [144, 144]]);
});

test("requires a BC encoder for regular and virtual texture replacement", async () => {
  for (const basePath of [
    "./assets/ue5_4/swap_bc1/original/T_Blocks2_BC1_BC",
    "./assets/ue5_4/swap_bc1_vt/original/T_Blocks2_BC1_VT_BC",
  ]) {
    const asset = await readAsset(basePath);
    await assert.rejects(() => replaceTexture(asset, Uint8Array.of(0, 0, 0, 255), 1, 1));
  }
});

function assertColorNear(
  rgba: Uint8Array,
  width: number,
  x: number,
  y: number,
  expected: readonly number[],
): void {
  const offset = (y * width + x) * 4;

  for (let channel = 0; channel < 3; channel++) {
    assert.ok(
      Math.abs(rgba[offset + channel]! - expected[channel]!) <= 10,
      `channel ${channel} at (${x}, ${y})`,
    );
  }

  assert.equal(rgba[offset + 3], expected[3]);
}
