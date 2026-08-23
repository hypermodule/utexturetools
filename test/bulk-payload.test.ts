import assert from "node:assert/strict";
import {test} from "node:test";

import {BulkPayloadFile} from "../src/ue/bulk-payload.ts";
import {BulkDataFlags, BulkType, ObjectDataResource} from "../src/ue/uasset.ts";

function makeResource(flags: number, serialOffset = -1n): ObjectDataResource {
  const resource = new ObjectDataResource();
  resource.bulkDataFlags = flags;
  resource.serialOffset = serialOffset;
  return resource;
}

test("BulkPayloadFile builds external payloads and assigns their resource offsets", () => {
  const resources = [
    makeResource(BulkDataFlags.None),
    makeResource(BulkDataFlags.ForceInlinePayload, 20n),
    makeResource(BulkDataFlags.OptionalPayload),
    makeResource(BulkDataFlags.None),
  ];
  const payloads = [
    Uint8Array.of(1, 2),
    Uint8Array.of(3),
    Uint8Array.of(4, 5),
    Uint8Array.of(6, 7, 8),
  ];

  const ubulk = BulkPayloadFile.build(payloads, resources, BulkType.Ubulk);
  assert.deepStrictEqual(ubulk.bytes, Uint8Array.of(1, 2, 6, 7, 8));
  assert.strictEqual(resources[0].serialOffset, 0n);
  assert.strictEqual(resources[1].serialOffset, 20n);
  assert.strictEqual(resources[2].serialOffset, -1n);
  assert.strictEqual(resources[3].serialOffset, 2n);

  const uptnl = BulkPayloadFile.build(payloads, resources, BulkType.Uptnl);
  assert.deepStrictEqual(uptnl.bytes, Uint8Array.of(4, 5));
  assert.strictEqual(resources[2].serialOffset, 0n);
});

test("BulkPayloadFile rejects non-external bulk types", () => {
  assert.throws(
    () => BulkPayloadFile.build([], [], BulkType.Uexp),
    {message: "Cannot build an external payload for bulk type 1."},
  );
});
