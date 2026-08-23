import {AssetFormatError, AssetReader} from "./asset-reader.ts";
import {AssetWriter} from "./asset-writer.ts";
import {BulkPayloadFile} from "./bulk-payload.ts";
import {BulkType, type ObjectDataResource, UAsset} from "./uasset.ts";
import {type Mip, type TextureExport, UExp} from "./uexp.ts";
import type {UEVersion} from "./versioning.ts";
import {bigint} from "../util.ts";

export interface CookedAssetBundle {
  readonly uasset: Uint8Array;
  readonly uexp: Uint8Array;
  readonly ubulk?: Uint8Array;
  readonly uptnl?: Uint8Array;
}

export class CookedAsset {
  readonly uasset: UAsset;
  readonly uexp: UExp;
  readonly version: UEVersion;

  readonly files: CookedAssetBundle;

  constructor(files: CookedAssetBundle, uasset: UAsset, uexp: UExp, version: UEVersion) {
    this.files = files;
    this.uasset = uasset;
    this.uexp = uexp;
    this.version = version;
  }

  getTextureExport(): TextureExport {
    const textureExports = this.uexp.exports.filter(exp => exp.kind === "texture");

    if (textureExports.length === 0) {
      throw new Error("The asset does not contain a texture export.");
    }

    if (textureExports.length > 1) {
      throw new Error("The asset contains multiple texture exports.");
    }

    return textureExports[0];
  }

  withTextureExport(
    texture: TextureExport,
    dataResources: readonly ObjectDataResource[],
    payloads: readonly Uint8Array[],
  ): CookedAssetBundle {
    if (this.uasset.exportMap.length !== 1 || this.uexp.exports.length !== 1) {
      throw new Error("Replacing textures in packages with multiple exports is not supported yet.");
    }

    const resources = dataResources.map(resource => resource.clone());
    const ubulk = BulkPayloadFile.build(payloads, resources, BulkType.Ubulk);
    const uptnl = BulkPayloadFile.build(payloads, resources, BulkType.Uptnl);

    const uexpWriter = new AssetWriter();
    const uexp = this.uexp.withExport(0, texture);
    const exportSize = uexp.write(uexpWriter, this.version, resources);
    const uasset = this.uasset.withExportData(resources, exportSize);
    const uassetWriter = new AssetWriter(uasset.fileSize);
    uasset.write(uassetWriter, this.version);

    return {
      uasset: uassetWriter.toUint8Array(),
      uexp: uexpWriter.toUint8Array(),
      ...(this.files.ubulk !== undefined || ubulk.bytes.byteLength > 0 ? {ubulk: ubulk.bytes} : {}),
      ...(this.files.uptnl !== undefined || uptnl.bytes.byteLength > 0
        ? {uptnl: uptnl.bytes}
        : {}),
    };
  }

  readMipData(mip: Mip): Uint8Array {
    const resource = this.getDataResource(mip.dataResourceIndex);

    if (resource.bulkType === BulkType.Uexp || resource.bulkType === BulkType.None) {
      return mip.inlineData;
    }

    return this.readDataResource(mip.dataResourceIndex);
  }

  readDataResource(dataResourceIndex: number): Uint8Array {
    const resource = this.getDataResource(dataResourceIndex);
    const source = this.getResourceSource(resource);

    const end = resource.serialOffset + resource.serialSize;
    if (end > BigInt(source.byteLength)) {
      throw new AssetFormatError(
        `data resource ${dataResourceIndex} range ` +
        `[${resource.serialOffset}, ${end}) exceeds size of its bulk data source ` +
        `(${source.byteLength} bytes)`,
      );
    }

    return source.subarray(bigint.toNumber(resource.serialOffset), bigint.toNumber(end));
  }

  private getDataResource(dataResourceIndex: number): ObjectDataResource {
    const dataResourceMap = this.uasset.dataResourceMap;

    if (
      !Number.isInteger(dataResourceIndex) ||
      dataResourceIndex < 0 ||
      dataResourceIndex >= dataResourceMap.length
    ) {
      throw new RangeError(
        `data resource index ${dataResourceIndex} out of range ` +
        `(count=${dataResourceMap.length})`,
      );
    }

    return dataResourceMap[dataResourceIndex];
  }

  private getResourceSource(resource: ObjectDataResource): Uint8Array {
    switch (resource.bulkType) {
      case BulkType.Uexp:
        return this.files.uexp;
      case BulkType.Ubulk:
        if (this.files.ubulk === undefined) {
          throw new AssetFormatError(".ubulk file is missing");
        }

        return this.files.ubulk;
      case BulkType.Uptnl:
        if (this.files.uptnl === undefined) {
          throw new AssetFormatError(".uptnl file is missing");
        }

        return this.files.uptnl;
      case BulkType.None:
        throw new AssetFormatError("data resource has no payload");
      default:
        throw new AssetFormatError(`unsupported bulk data type: ${resource.bulkType}`);
    }
  }
}

export function parseAsset(files: CookedAssetBundle, version: UEVersion): CookedAsset {
  const uasset = UAsset.read(new AssetReader(files.uasset), version);
  const uexp = UExp.read(new AssetReader(files.uexp), version, uasset);

  return new CookedAsset(files, uasset, uexp, version);
}
