import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";

import {decodeTextureMip, reconstructNormalMapBlue} from "../src/texture/decoding.ts";
import {getTextureBcFormat} from "../src/texture/formats.ts";
import {parseAsset} from "../src/ue/cooked-asset.ts";
import {UEVersion} from "../src/ue/versioning.ts";
import {loadWasm, readPpmPixels} from "./util.ts";

async function readTextureAsset(uassetPath: string, version: UEVersion) {
  const uexpPath = uassetPath.replace(".uasset", ".uexp");
  const ubulkPath = uassetPath.replace(".uasset", ".ubulk");

  const [uasset, uexp, ubulk] = await Promise.all([
    readFile(new URL(uassetPath, import.meta.url)),
    readFile(new URL(uexpPath, import.meta.url)),
    readFile(new URL(ubulkPath, import.meta.url)),
  ]);

  return parseAsset({uasset, uexp, ubulk}, version);
}

test("reconstructs normal-map blue from BC5 red and green channels", () => {
  const rgba = Uint8Array.of(
    128, 128, 0, 255,
    255, 128, 0, 127,
    0, 0, 0, 255,
  );

  reconstructNormalMapBlue(rgba);

  assert.deepStrictEqual(rgba, Uint8Array.of(
    128, 128, 255, 255,
    255, 128, 128, 127,
    0, 0, 128, 255,
  ));
});

test("decodes PF_B8G8R8A8 mip data to RGBA", async () => {
  const asset =
    await readTextureAsset("./assets/ue5_4/T_Blocky_1K_B8G8R8A8_BC.uasset", UEVersion.UE5_4);
  const texture = asset.getTextureExport();

  const mip = texture.mips[4];
  assert.ok(mip !== undefined);
  const source = asset.readMipData(mip);
  const decoded = await decodeTextureMip(asset, 4);

  assert.equal(decoded.width, 64);
  assert.equal(decoded.height, 64);
  assert.equal(decoded.encodedByteLength, 64 * 64 * 4);
  assert.equal(decoded.rgba.length, source.length);

  for (let offset = 0; offset < source.length; offset += 4) {
    assert.equal(decoded.rgba[offset], source[offset + 2]);
    assert.equal(decoded.rgba[offset + 1], source[offset + 1]);
    assert.equal(decoded.rgba[offset + 2], source[offset]);
    assert.equal(decoded.rgba[offset + 3], source[offset + 3]);
  }
});

test("requires an asset to contain exactly one texture export", async () => {
  const asset =
    await readTextureAsset("./assets/ue5_4/T_Blocky_1K_B8G8R8A8_BC.uasset", UEVersion.UE5_4);
  const texture = asset.getTextureExport();

  asset.uexp.exports.push(texture);

  assert.throws(() => asset.getTextureExport());
});

test("decodes PF_DXT1 mip data correctly", async () => {
  const asset = await readTextureAsset("./assets/ue5_4/T_Roof_1K_BC1_BC.uasset", UEVersion.UE5_4);

  const progress: Array<readonly [number, number]> = [];
  const codecs = await loadWasm();
  const decoded = await decodeTextureMip(
    asset,
    0,
    codecs,
    (completed, total) => progress.push([completed, total]),
  );

  const expected = readPpmPixels(
    await readFile(new URL("./assets/ue5_4/T_Roof_1K_BC1_BC.ppm", import.meta.url)),
    decoded.width,
    decoded.height,
  );

  assert.strictEqual(decoded.rgba.length, expected.length / 3 * 4);

  for (let pixel = 0; pixel < decoded.width * decoded.height; pixel++) {
    const rgbaOffset = pixel * 4;
    const rgbOffset = pixel * 3;
    assert.ok(
      Math.abs(decoded.rgba[rgbaOffset] - expected[rgbOffset]) <= 1,
      `red channel at pixel ${pixel}`
    );

    assert.ok(
      Math.abs(decoded.rgba[rgbaOffset + 1] - expected[rgbOffset + 1]) <= 1,
      `green channel at pixel ${pixel}`,
    );

    assert.ok(
      Math.abs(decoded.rgba[rgbaOffset + 2] - expected[rgbOffset + 2]) <= 1,
      `blue channel at pixel ${pixel}`,
    );

    assert.equal(decoded.rgba[rgbaOffset + 3], 255, `alpha channel at pixel ${pixel}`);
  }
});

test("decodes virtual PF_DXT1 mip data correctly", async () => {
  const asset =
    await readTextureAsset("./assets/ue5_4/T_Blocks2_1K_BC1_VT_BC.uasset", UEVersion.UE5_4);
  const codecs = await loadWasm();
  const decoded = await decodeTextureMip(asset, 0, codecs);

  assert.equal(decoded.width, 1024);
  assert.equal(decoded.height, 1024);
  assert.equal(decoded.encodedByteLength, 1024 * 1024 / 2);

  const expected = readPpmPixels(
    await readFile(new URL("./assets/bc/blocks2.ppm", import.meta.url)),
    decoded.width,
    decoded.height,
  );

  assert.strictEqual(decoded.rgba.length, expected.length / 3 * 4);

  for (let pixel = 0; pixel < decoded.width * decoded.height; pixel++) {
    const rgbaOffset = pixel * 4;
    const rgbOffset = pixel * 3;
    assert.ok(
      Math.abs(decoded.rgba[rgbaOffset] - expected[rgbOffset]) <= 1,
      `red channel at pixel ${pixel}`,
    );
    assert.ok(
      Math.abs(decoded.rgba[rgbaOffset + 1] - expected[rgbOffset + 1]) <= 1,
      `green channel at pixel ${pixel}`,
    );
    assert.ok(
      Math.abs(decoded.rgba[rgbaOffset + 2] - expected[rgbOffset + 2]) <= 1,
      `blue channel at pixel ${pixel}`,
    );
    assert.equal(decoded.rgba[rgbaOffset + 3], 255, `alpha channel at pixel ${pixel}`);
  }
});

test("requires a BC codec after validating the encoded mip", async () => {
  const asset = await readTextureAsset("./assets/ue5_4/T_Roof_1K_BC1_BC.uasset", UEVersion.UE5_4);
  await assert.rejects(() => decodeTextureMip(asset, 0));

  const mip = asset.getTextureExport().mips[0];
  mip.width *= 2;
  await assert.rejects(() => decodeTextureMip(asset, 0));
});

test("rejects unsupported formats before decoding", async () => {
  const asset = await readTextureAsset("./assets/ue5_4/T_Roof_1K_BC1_BC.uasset", UEVersion.UE5_4);
  asset.getTextureExport().pixelFormat = "PF_BC6H";
  await assert.rejects(() => decodeTextureMip(asset, 0), {
    message: "Unsupported pixel format: PF_BC6H",
  });
});

test("validates decoded lengths and forwards BC decoder arguments", async () => {
  const asset = await readTextureAsset("./assets/ue5_4/T_Roof_1K_BC1_BC.uasset", UEVersion.UE5_4);
  const onProgress = () => {};
  await assert.rejects(() => decodeTextureMip(asset, 0, {
    decode(format, input, width, height, progress) {
      assert.equal(format, "bc1");
      assert.deepStrictEqual(input, asset.readMipData(asset.getTextureExport().mips[0]));
      assert.equal(width, 1024);
      assert.equal(height, 1024);
      assert.strictEqual(progress, onProgress);
      return new Uint8Array();
    },
  }, onProgress), {
    message: "Decoding yielded 0 bytes, but 4194304 bytes were expected.",
  });
});

test("maps pixel formats to BC formats", () => {
  assert.equal(getTextureBcFormat("PF_DXT1"), "bc1");
  assert.equal(getTextureBcFormat("PF_DXT3"), "bc2");
  assert.equal(getTextureBcFormat("PF_DXT5"), "bc3");
  assert.equal(getTextureBcFormat("PF_BC4"), "bc4");
  assert.equal(getTextureBcFormat("PF_BC5"), "bc5");
  assert.equal(getTextureBcFormat("PF_BC7"), "bc7");
  assert.equal(getTextureBcFormat("PF_BC6H"), undefined);
});
