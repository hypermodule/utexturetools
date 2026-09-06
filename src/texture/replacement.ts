import type {CookedAsset, CookedAssetBundle} from "../ue/cooked-asset.ts";
import {BulkType, ObjectDataResource} from "../ue/uasset.ts";
import {Mip, TextureExport} from "../ue/uexp.ts";
import type {TextureEncoder} from "./codec.ts";
import {encodeMips, type EncodedMip} from "./encoding.ts";
import {validateTextureReplacement} from "./replacement-validation.ts";
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
  const {texture, formatInfo} = validateTextureReplacement(asset);
  const rgbaMips = generateTextureMips(rgba, width, height);

  if (texture.virtualTextureData === null) {
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
