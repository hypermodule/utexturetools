import {BulkType, type ObjectDataResource} from "./uasset.ts";
import {concatenate} from "../util.ts";

export class BulkPayloadFile {
  readonly bytes: Uint8Array;

  private constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  static build(
    payloads: readonly Uint8Array[],
    resources: readonly ObjectDataResource[],
    bulkType: BulkType,
  ): BulkPayloadFile {
    if (payloads.length !== resources.length) {
      throw new Error(
        `Cannot build bulk payload: received ${payloads.length} payloads ` +
        `for ${resources.length} data resources.`,
      );
    }

    if (bulkType !== BulkType.Ubulk && bulkType !== BulkType.Uptnl) {
      throw new Error(`Cannot build an external payload for bulk type ${bulkType}.`);
    }

    let byteLength = 0;
    const chunks: Uint8Array[] = [];

    for (let index = 0; index < resources.length; index++) {
      const resource = resources[index];
      if (resource.bulkType !== bulkType) {
        continue;
      }

      const payload = payloads[index];
      resource.serialOffset = BigInt(byteLength);
      chunks.push(payload);
      byteLength += payload.byteLength;
    }

    return new BulkPayloadFile(concatenate(chunks));
  }
}
