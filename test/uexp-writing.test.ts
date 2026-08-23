import assert from "node:assert/strict";
import {test} from "node:test";

import {AssetWriter} from "../src/ue/asset-writer.ts";
import {PACKAGE_FILE_TAG} from "../src/ue/summary.ts";
import {Mip, RawExport, TextureExport, UExp} from "../src/ue/uexp.ts";
import {VirtualTextureBuiltData} from "../src/ue/vt.ts";
import {UEVersion} from "../src/ue/versioning.ts";

test("UExp.write serializes its exports and returns their total size", () => {
  const firstExport = new RawExport();
  firstExport.data = Uint8Array.of(0x01, 0x02);
  const secondExport = new RawExport();
  secondExport.data = Uint8Array.of(0x03, 0x04);

  const uexp = new UExp();
  uexp.exports = [firstExport, secondExport];
  assert.strictEqual(uexp.tag, PACKAGE_FILE_TAG);

  const replacement = new RawExport();
  replacement.data = Uint8Array.of(0x11, 0x12, 0x13);
  const updated = uexp.withExport(0, replacement);
  const writer = new AssetWriter();
  const exportDataSize = updated.write(writer, UEVersion.UE5_4, []);

  assert.deepStrictEqual(
    writer.toUint8Array(),
    Uint8Array.of(
      0x11, 0x12, 0x13,
      0x03, 0x04,
      0xc1, 0x83, 0x2a, 0x9e,
    ),
  );
  assert.strictEqual(exportDataSize, 5);
  assert.strictEqual(uexp.exports[0], firstExport);
  assert.strictEqual(updated.exports[0], replacement);
});

test("TextureExport.clone returns an equal copy that can be modified independently", () => {
  const texture = new TextureExport("Texture2D");
  texture.properties = Uint8Array.of(1, 2, 3);
  texture.pixelFormat = "PF_DXT1";
  texture.importedWidth = 8;
  texture.importedHeight = 4;
  const mip = new Mip();
  mip.inlineData = Uint8Array.of(9);
  mip.width = 8;
  mip.height = 4;
  mip.depth = 1;
  texture.mips = [mip];
  texture.mipCount = 1;
  const virtualTexture = new VirtualTextureBuiltData();
  virtualTexture.width = 8;
  virtualTexture.layerTypes = ["PF_DXT1"];
  texture.isVirtual = true;
  texture.virtualTextureData = virtualTexture;

  const copy = texture.clone();
  assert.notStrictEqual(copy, texture);
  assert.deepStrictEqual(copy, texture);

  copy.properties[0] = 7;
  copy.importedWidth = 1;
  copy.mips[0]!.width = 1;
  copy.mips[0]!.inlineData[0] = 0;
  copy.virtualTextureData!.width = 1;
  copy.virtualTextureData!.layerTypes[0] = "PF_BC7";
  assert.deepStrictEqual(texture.properties, Uint8Array.of(1, 2, 3));
  assert.strictEqual(texture.importedWidth, 8);
  assert.strictEqual(texture.mips[0]?.width, 8);
  assert.deepStrictEqual(texture.mips[0]?.inlineData, Uint8Array.of(9));
  assert.strictEqual(texture.virtualTextureData.width, 8);
  assert.deepStrictEqual(texture.virtualTextureData.layerTypes, ["PF_DXT1"]);
});

test("VirtualTextureBuiltData.write rejects inconsistent layer metadata", () => {
  const data = new VirtualTextureBuiltData();
  data.numLayers = 1;
  data.width = 1;
  data.height = 1;
  data.tileSize = 4;
  data.tileDataOffsetPerLayer = [8];
  data.layerTypes = ["PF_DXT1"];

  assert.throws(
    () => data.write(new AssetWriter()),
    {message: "virtual texture declares 1 layer but contains 0 fallback colors"},
  );

  data.numLayers = 9;
  assert.throws(
    () => data.write(new AssetWriter()),
    {message: "virtual texture has too many layers (9 > 8)"},
  );
});
