import type {CookedAsset, CookedAssetBundle} from "../ue/cooked-asset.ts";
import {BulkType, ObjectDataResource} from "../ue/uasset.ts";
import {Mip} from "../ue/uexp.ts";
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
    return replaceOrdinaryTexture(asset, encodedMips);
  } else {
    return replaceVirtualTexture(asset, rgbaMips, encoder, options);
  }
}

function replaceOrdinaryTexture(
  asset: CookedAsset,
  encodedMips: readonly EncodedMip[],
): CookedAssetBundle {
  const dataResources = makeOrdinaryDataResources(asset, encodedMips);

  const newTexture = asset.getTextureExport().clone();
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
  rgbaMips: readonly RgbaMip[],
  encoder: TextureEncoder | undefined,
  options: BcEncodeOptions,
): Promise<CookedAssetBundle> {
  const texture = asset.getTextureExport();

  const newTexture = texture.clone();

  const bulkPayloads = await rebuildVirtualTexture(
    newTexture.virtualTextureData!,
    rgbaMips,
    encoder,
    options,
  );

  const dataResources = makeVirtualDataResources(asset, texture.virtualTextureData!, bulkPayloads);

  newTexture.importedWidth = rgbaMips[0].width;
  newTexture.importedHeight = rgbaMips[0].height;

  // Virtual textures store mips in virtualTextureData
  newTexture.mipCount = 0;
  newTexture.mips = [];

  return asset.withTextureExport(newTexture, dataResources, bulkPayloads);
}

function makeOrdinaryDataResources(
  asset: CookedAsset,
  mips: readonly EncodedMip[],
): ObjectDataResource[] {
  let inline: ObjectDataResource | undefined;
  let external: ObjectDataResource | undefined;

  for (const {resource} of asset.getMipsAndDataResources()) {
    if (resource.bulkType === BulkType.Uexp) {
      inline ??= resource;
    } else if (
      resource.bulkType === BulkType.Ubulk ||
      resource.bulkType === BulkType.Uptnl
    ) {
      external ??= resource;
    }
  }

  const inlineThreshold = asset.getInlineMipThreshold();

  return mips.map(mip => {
    // Preserve the original size cutoff
    const shouldStoreInline =
      inlineThreshold !== undefined && Math.max(mip.width, mip.height) <= inlineThreshold;

    const template = external === undefined || shouldStoreInline ? inline : external;
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
