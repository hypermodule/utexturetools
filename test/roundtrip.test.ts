import assert from "node:assert/strict";
import {test} from "node:test";

import {AssetWriter} from "../src/ue/asset-writer.ts";
import {type CookedAsset, type CookedAssetBundle} from "../src/ue/cooked-asset.ts";
import {UEVersion} from "../src/ue/versioning.ts";
import {readAsset} from "./util.ts";

function writeAsset(asset: CookedAsset): CookedAssetBundle {
  const uassetWriter = new AssetWriter();
  asset.uasset.write(uassetWriter, asset.version);

  const uexpWriter = new AssetWriter();
  asset.uexp.write(uexpWriter, asset.version, asset.uasset.dataResourceMap);

  return {
    uasset: uassetWriter.toUint8Array(),
    uexp: uexpWriter.toUint8Array(),
    ...(asset.files.ubulk !== undefined ? {ubulk: asset.files.ubulk} : {}),
    ...(asset.files.uptnl !== undefined ? {uptnl: asset.files.uptnl} : {}),
  };
}

test("UE5_7__Texture2D_BC1_Roundtrip", async () => {
  const original = await readAsset("./assets/ue5_7/T_Blocks2_1K_BC1_BC", UEVersion.UE5_7);
  const roundtripped = writeAsset(original);

  assert.equal(Buffer.compare(roundtripped.uasset, original.files.uasset), 0);
  assert.equal(Buffer.compare(roundtripped.uexp, original.files.uexp), 0);
  assert.ok(roundtripped.ubulk);
  assert.ok(original.files.ubulk);
  assert.equal(Buffer.compare(roundtripped.ubulk, original.files.ubulk), 0);
});

test("UE5_8__Texture2D_BC1_Roundtrip", async () => {
  const original = await readAsset("./assets/ue5_8/T_Blocks2_1K_BC1_BC", UEVersion.UE5_8);
  const roundtripped = writeAsset(original);

  assert.equal(Buffer.compare(roundtripped.uasset, original.files.uasset), 0);
  assert.equal(Buffer.compare(roundtripped.uexp, original.files.uexp), 0);
  assert.ok(roundtripped.ubulk);
  assert.ok(original.files.ubulk);
  assert.equal(Buffer.compare(roundtripped.ubulk, original.files.ubulk), 0);
});