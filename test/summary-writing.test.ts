import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";

import {AssetReader} from "../src/ue/asset-reader.ts";
import {AssetWriter} from "../src/ue/asset-writer.ts";
import {PackageFileSummary} from "../src/ue/summary.ts";
import {UEVersion} from "../src/ue/versioning.ts";

const FIXTURE_URL = new URL(
  "./assets/ue5_7/T_Blocks2_1K_BC1_BC.uasset",
  import.meta.url,
);

test("PackageFileSummary write roundtrip", async () => {
  const source = new Uint8Array(await readFile(FIXTURE_URL));
  const sourceReader = new AssetReader(source);
  const summary = PackageFileSummary.read(sourceReader, UEVersion.UE5_7);

  const writer = new AssetWriter();
  summary.write(writer, UEVersion.UE5_7);
  const serialized = writer.toUint8Array();
  const roundtripped = PackageFileSummary.read(
    new AssetReader(serialized),
    UEVersion.UE5_7,
  );

  assert.deepStrictEqual(serialized, source.subarray(0, sourceReader.position));
  assert.deepStrictEqual(roundtripped, summary);
});
