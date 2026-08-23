import type {TextureFormatLayout} from "../pixel-formats.ts";
import type {CookedAsset, CookedAssetBundle} from "../ue/cooked-asset.ts";
import {BulkType, ObjectDataResource} from "../ue/uasset.ts";
import {Mip, TextureExport} from "../ue/uexp.ts";
import type {VirtualTextureBuiltData} from "../ue/vt.ts";
import type {TextureEncoder} from "./codec.ts";
import {getTextureFormatInfo, getTextureFormatLayout} from "./formats.ts";
import {encodeMips, type EncodedMip} from "./encoding.ts";
import {makeVirtualDataResources, rebuildVirtualTexture} from "./vt-replacement.ts";
import {generateTextureMips, type RgbaMip} from "./mips.ts";
import type {BcEncodeOptions} from "../wasm/wasm.ts";

/**
 * Encode an RGBA8 image using the texture's existing pixel format and replace
 * every mip in a cooked Texture2D asset, including its virtual texture tiles.
 */
export async function replaceTexture(
  asset: CookedAsset,
  rgba: Uint8Array,
  width: number,
  height: number,
  encoder?: TextureEncoder,
  options: BcEncodeOptions = {},
): Promise<CookedAssetBundle> {
  assertCanReplaceTexture(asset);
  const texture = asset.getTextureExport();

  const rgbaMips = generateTextureMips(rgba, width, height);

  if (texture.virtualTextureData === null) {
    const formatInfo = getTextureFormatInfo(texture.pixelFormat)!;
    const encodedMips = await encodeMips(formatInfo, rgbaMips, encoder, options);
    return replaceOrdinaryTexture(asset, texture, encodedMips);
  } else {
    return replaceVirtualTexture(asset, texture, rgbaMips, encoder, options);
  }
}

function replaceOrdinaryTexture(
  asset: CookedAsset,
  texture: TextureExport,
  encodedMips: readonly EncodedMip[],
): CookedAssetBundle {
  const dataResources = makeOrdinaryDataResources(asset, texture, encodedMips);

  const newTexture = texture.clone();
  newTexture.importedWidth = encodedMips[0].width;
  newTexture.importedHeight = encodedMips[0].height;
  newTexture.mips = encodedMips.map((mipData, index) => {
    const mip = new Mip();
    mip.dataResourceIndex = index;
    mip.inlineData =
      dataResources[index].bulkType === BulkType.Uexp ? mipData.data : new Uint8Array();
    mip.width = mipData.width;
    mip.height = mipData.height;
    mip.depth = 1;
    return mip;
  });
  newTexture.mipCount = newTexture.mips.length;

  return asset.withTextureExport(newTexture, dataResources, encodedMips.map(mip => mip.data));
}

async function replaceVirtualTexture(
  asset: CookedAsset,
  texture: TextureExport,
  rgbaMips: readonly RgbaMip[],
  encoder: TextureEncoder | undefined,
  options: BcEncodeOptions,
): Promise<CookedAssetBundle> {
  const replacement = texture.clone();

  const bulkPayloads = await rebuildVirtualTexture(
    replacement.virtualTextureData!,
    rgbaMips,
    encoder,
    options,
  );

  const resources = makeVirtualDataResources(asset, texture.virtualTextureData!, bulkPayloads);

  replacement.importedWidth = rgbaMips[0].width;
  replacement.importedHeight = rgbaMips[0].height;

  // Virtual textures store mips in virtualTextureData
  replacement.mipCount = 0;
  replacement.mips = [];

  return asset.withTextureExport(replacement, resources, bulkPayloads);
}

function makeOrdinaryDataResources(
  asset: CookedAsset,
  texture: TextureExport,
  mips: readonly EncodedMip[],
): ObjectDataResource[] {
  const oldMipResources = texture.mips.map(mip => (
    asset.uasset.dataResourceMap[mip.dataResourceIndex]
  ));

  const inlineIndex = oldMipResources.findIndex(resource => resource.bulkType === BulkType.Uexp);
  const inlineTemplate = inlineIndex === -1 ? undefined : oldMipResources[inlineIndex];
  const externalTemplate = oldMipResources.find(resource => (
    resource.bulkType === BulkType.Ubulk || resource.bulkType === BulkType.Uptnl
  ));
  const firstInlineMip = inlineIndex === -1 ? undefined : texture.mips[inlineIndex];
  const inlineMaximumDimension =
    firstInlineMip === undefined ? 0 : Math.max(firstInlineMip.width, firstInlineMip.height);

  return mips.map(mip => {
    // Mirror the original storage layout: mips that were inline stay
    // inline while everything else goes to the external bulk file
    const shouldStoreInline = externalTemplate === undefined || (
      inlineTemplate !== undefined && Math.max(mip.width, mip.height) <= inlineMaximumDimension
    );

    const template = shouldStoreInline ? inlineTemplate : externalTemplate;
    if (template === undefined) {
      throw new Error("The texture does not contain a reusable bulk-data resource record.");
    }

    const resource = template.clone();
    resource.serialOffset = 0n;
    resource.serialSize = BigInt(mip.data.byteLength);
    resource.rawSize = BigInt(mip.data.byteLength);
    return resource;
  });
}

// -------- Validation --------

function assertCanReplaceTexture(asset: CookedAsset): void {
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

  const format = assertSupportedReplacementFormat(texture.resolvePixelFormat());
  if (virtualTexture !== null) {
    assertVirtualTileAlignment(virtualTexture, format);
  }
  assertTextureResourceOwnership(asset, texture, dataResourceIndexes);
  for (const resource of asset.uasset.dataResourceMap) {
    assertSupportedResourceStorage(resource, virtualTexture !== null);
  }
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

function assertSupportedReplacementFormat(pixelFormat: string): TextureFormatLayout {
  const format = getTextureFormatLayout(pixelFormat);

  if (format === undefined) {
    throw new Error(`Pixel format ${pixelFormat} is not supported yet.`);
  }

  return format;
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
