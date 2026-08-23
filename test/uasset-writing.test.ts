import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";

import {AssetReader} from "../src/ue/asset-reader.ts";
import {AssetWriter} from "../src/ue/asset-writer.ts";
import {
  ObjectDataResource,
  ObjectDataResourceVersion,
  UAsset,
} from "../src/ue/uasset.ts";
import {UEVersion} from "../src/ue/versioning.ts";

const FIXTURE_URL = new URL("./assets/ue5_4/T_Blocky_1K_B8G8R8A8_BC.uasset", import.meta.url);
const UE5_7_FIXTURE_URL = new URL(
  "./assets/ue5_7/T_Blocks2_1K_BC1_BC.uasset",
  import.meta.url,
);

test("ObjectDataResource.size accounts for the serialized version", () => {
  assert.equal(ObjectDataResource.size(ObjectDataResourceVersion.Initial), 44);
  assert.equal(ObjectDataResource.size(ObjectDataResourceVersion.AddedCookedIndex), 45);
});

test("UAsset write roundtrip", async () => {
  const source = new Uint8Array(await readFile(FIXTURE_URL));
  const original = UAsset.read(new AssetReader(source), UEVersion.UE5_4);
  assert.equal(original.assetObjectDataCount, 0);
  const writer = new AssetWriter();

  original.write(writer, UEVersion.UE5_4);

  const serialized = writer.toUint8Array();
  const roundtripped = UAsset.read(new AssetReader(serialized), UEVersion.UE5_4);
  assert.deepStrictEqual(roundtripped, original);
});

test("UAsset.write derives summary offsets from the writer position", async () => {
  const source = new Uint8Array(await readFile(UE5_7_FIXTURE_URL));
  const uasset = UAsset.read(new AssetReader(source), UEVersion.UE5_7);

  uasset.summary.totalHeaderSize = 1;
  uasset.summary.nameOffset = 1;
  uasset.summary.softObjectPathsOffset = 1;
  uasset.summary.importOffset = 1;
  uasset.summary.exportOffset = 1;
  uasset.summary.cellImportOffset = 1;
  uasset.summary.cellExportOffset = 1;
  uasset.summary.dependsOffset = 1;
  uasset.summary.assetRegistryDataOffset = 1;
  uasset.summary.preloadDependencyOffset = 1;
  uasset.summary.dataResourceOffset = 1;

  const writer = new AssetWriter();
  uasset.write(writer, UEVersion.UE5_7);

  assert.deepStrictEqual(writer.toUint8Array(), source);
});

test("UAsset.read rejects cooked asset object data", async () => {
  const source = new Uint8Array(await readFile(FIXTURE_URL));
  const original = UAsset.read(new AssetReader(source), UEVersion.UE5_4);
  new DataView(source.buffer, source.byteOffset, source.byteLength).setInt32(
    original.summary.assetRegistryDataOffset,
    1,
    true,
  );

  assert.throws(
    () => UAsset.read(new AssetReader(source), UEVersion.UE5_4),
    /expected asset object data count to be zero, got 1/,
  );
});

function appendHeaderPadding(bytes: Uint8Array, padding: Uint8Array): Uint8Array {
  const original = UAsset.read(new AssetReader(bytes), UEVersion.UE5_4);
  const padded = new Uint8Array(bytes.byteLength + padding.byteLength);
  padded.set(bytes);
  padded.set(padding, bytes.byteLength);

  // ObjectExport.SerialOffset follows its four package indexes, object name,
  // object flags, and SerialSize.
  const serialOffsetPosition = original.summary.exportOffset + 36;
  new DataView(padded.buffer).setBigInt64(
    serialOffsetPosition,
    BigInt(padded.byteLength),
    true,
  );
  return padded;
}

test("UAsset.rewrite reproduces an unchanged .uasset", async () => {
  const bytes = await readFile(FIXTURE_URL);
  const uasset = UAsset.read(new AssetReader(bytes), UEVersion.UE5_4);
  const headerSize = BigInt(uasset.fileSize);

  const updated = uasset.withExportData(
    uasset.dataResourceMap,
    Number(uasset.summary.bulkDataStartOffset - headerSize),
  );
  const writer = new AssetWriter();
  updated.write(writer, UEVersion.UE5_4);
  const rewritten = writer.toUint8Array();

  assert.deepStrictEqual(rewritten, new Uint8Array(bytes));
  assert.notStrictEqual(rewritten, bytes);
});

test("UAsset.rewrite preserves null padding after the data resource table", async () => {
  const source = await readFile(FIXTURE_URL);
  const bytes = appendHeaderPadding(source, new Uint8Array(3));
  const uasset = UAsset.read(new AssetReader(bytes), UEVersion.UE5_4);
  const exportSize = Number(uasset.summary.bulkDataStartOffset - BigInt(source.byteLength));

  assert.equal(uasset.appendedNullBytes, 3);

  const updated = uasset.withExportData(uasset.dataResourceMap, exportSize);
  const writer = new AssetWriter();
  updated.write(writer, UEVersion.UE5_4);
  const rewritten = writer.toUint8Array();

  assert.equal(rewritten.byteLength, bytes.byteLength);
  assert.deepStrictEqual(rewritten.subarray(-3), new Uint8Array(3));
  assert.equal(
    UAsset.read(new AssetReader(rewritten), UEVersion.UE5_4).appendedNullBytes,
    3,
  );
});

test("UAsset model retains the header data needed for rewriting", async () => {
  const bytes = await readFile(FIXTURE_URL);
  const expected = new Uint8Array(bytes);
  const uasset = UAsset.read(new AssetReader(bytes), UEVersion.UE5_4);
  const headerSize = BigInt(uasset.fileSize);
  const exportSize = Number(uasset.summary.bulkDataStartOffset - headerSize);

  bytes.fill(0);
  const updated = uasset.withExportData(uasset.dataResourceMap, exportSize);
  const writer = new AssetWriter();
  updated.write(writer, UEVersion.UE5_4);
  const rewritten = writer.toUint8Array();

  assert.deepStrictEqual(rewritten, expected);
});
