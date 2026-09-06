import type {PixelFormatInfo, TextureFormatLayout} from "../pixel-formats.ts";
import type {CookedAsset} from "../ue/cooked-asset.ts";
import {BulkType, type ObjectDataResource} from "../ue/uasset.ts";
import type {TextureExport} from "../ue/uexp.ts";
import type {VirtualTextureBuiltData} from "../ue/vt.ts";
import {getTextureFormatInfo} from "./formats.ts";

/** Validate replacement support before encoding and return the resolved texture and format. */
export function validateTextureReplacement(
  asset: CookedAsset,
): {texture: TextureExport; formatInfo: PixelFormatInfo} {
  const texture = asset.getTextureExport();
  assertReplaceableTextureShape(texture);

  const virtualTexture = texture.virtualTextureData;
  let dataResourceIndexes: number[];
  if (virtualTexture !== null) {
    assertReplaceableVirtualStructure(virtualTexture);
    dataResourceIndexes = virtualTexture.chunks.map(chunk => chunk.dataResourceIndex);
  } else {
    dataResourceIndexes = texture.mips.map(mip => mip.dataResourceIndex);
  }

  const formatInfo = assertSupportedReplacementFormat(texture.resolvePixelFormat());
  if (virtualTexture !== null) {
    assertVirtualTileAlignment(virtualTexture, formatInfo.layout);
  }
  assertTextureResourceOwnership(asset, texture, dataResourceIndexes);
  for (const resource of asset.uasset.dataResourceMap) {
    assertSupportedResourceStorage(resource, virtualTexture !== null);
  }

  return {texture, formatInfo};
}

function assertReplaceableTextureShape(texture: TextureExport): void {
  if (!texture.is2D || texture.sliceCount !== 1) {
    throw new Error("Only non-array 2D textures can be replaced.");
  }

  if (!texture.serializeMipData) {
    throw new Error("The texture does not contain serialized mip data.");
  }

  if (texture.firstMipToSerialize !== 0) {
    throw new Error(
      "Textures whose serialized mip chain does not start at mip 0 are not supported.",
    );
  }

  const virtualTexture = texture.virtualTextureData;
  if (texture.isVirtual !== (virtualTexture !== null)) {
    throw new Error("The texture has inconsistent virtual texture metadata.");
  }
}

function assertReplaceableVirtualStructure(virtualTexture: VirtualTextureBuiltData): void {
  if (virtualTexture.numLayers !== 1) {
    throw new Error(
      `Only virtual textures with a single layer can be replaced ` +
      `(found ${virtualTexture.numLayers}).`,
    );
  }

  if (virtualTexture.layerTypes.length !== 1) {
    throw new Error("The virtual texture has inconsistent pixel-format layer metadata.");
  }

  if (virtualTexture.widthInBlocks !== 1 || virtualTexture.heightInBlocks !== 1) {
    throw new Error("Only virtual textures with a single source block can be replaced.");
  }

  if (virtualTexture.chunks.length === 0) {
    throw new Error("The virtual texture does not contain a reusable bulk-data resource record.");
  }
}

function assertSupportedReplacementFormat(pixelFormat: string): PixelFormatInfo {
  const formatInfo = getTextureFormatInfo(pixelFormat);

  if (formatInfo === undefined) {
    throw new Error(`Pixel format ${pixelFormat} is not supported yet.`);
  }

  return formatInfo;
}

function assertVirtualTileAlignment(
  virtualTexture: VirtualTextureBuiltData,
  format: TextureFormatLayout,
): void {
  if (
    virtualTexture.tileSize % format.blockWidth !== 0 ||
    virtualTexture.tileSize % format.blockHeight !== 0 ||
    virtualTexture.tileBorderSize % format.blockWidth !== 0 ||
    virtualTexture.tileBorderSize % format.blockHeight !== 0
  ) {
    throw new Error(
      "The virtual texture tile size and border must be multiples of its pixel-format block size.",
    );
  }
}

function assertTextureResourceOwnership(
  asset: CookedAsset,
  texture: TextureExport,
  dataResourceIndexes: readonly number[],
): void {
  if (asset.uasset.exportMap.length !== 1 || asset.uexp.exports[0] !== texture) {
    throw new Error("Replacing textures in packages with multiple exports is not supported yet.");
  }

  asset.uasset.assertHasDataResourceTable();

  const indexes = dataResourceIndexes.toSorted((a, b) => a - b);
  if (
    indexes.length !== asset.uasset.dataResourceMap.length ||
    indexes.some((index, position) => index !== position)
  ) {
    throw new Error("The package contains data resources that do not belong to the texture.");
  }
}

function assertSupportedResourceStorage(resource: ObjectDataResource, isVirtual: boolean): void {
  const isSupported = resource.bulkType === BulkType.Ubulk ||
    resource.bulkType === BulkType.Uptnl ||
    (!isVirtual && resource.bulkType === BulkType.Uexp);

  if (!isSupported) {
    throw new Error("The texture uses an unsupported bulk-data storage type.");
  }

  if (resource.duplicateSerialOffset !== -1n) {
    throw new Error("Duplicated bulk-data payloads are not supported yet.");
  }
}
