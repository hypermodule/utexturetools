import type {CookedAsset} from "../ue/cooked-asset.ts";
import type {TextureDecoder} from "./codec.ts";
import type {ProgressCallback} from "../util.ts";
import {swapRedBlue} from "../util.ts";
import {getTextureFormatInfo} from "./formats.ts";
import {
  applyVirtualTextureConstants,
  assembleVirtualTextureMip,
  type AssembledVirtualTextureMip,
} from "./vt-decoding.ts";
import {getTextureEncodedByteLength} from "../pixel-formats.ts";

export interface DecodedMip {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
  readonly encodedByteLength: number;
}

export async function decodeTextureMip(
  asset: CookedAsset,
  mipIndex: number,
  decoder?: TextureDecoder,
  onProgress?: ProgressCallback,
): Promise<DecodedMip> {
  const texture = asset.getTextureExport();
  if (!texture.is2D || texture.sliceCount !== 1) {
    throw new Error("Only non-array 2D textures are currently supported");
  }

  // 1) Read encoded mip

  let width: number;
  let height: number;
  let pixelFormat: string;
  let source: Uint8Array;
  let virtualMip: AssembledVirtualTextureMip | undefined;

  if (texture.isVirtual) {
    virtualMip = assembleVirtualTextureMip(asset, mipIndex);
    ({width, height, pixelFormat} = virtualMip);
    source = virtualMip.encoded;
  } else {
    const mip = texture.mips[mipIndex];
    if (mip === undefined) {
      throw new RangeError(`Mip ${mipIndex} is out of range.`);
    }

    ({width, height} = mip);
    pixelFormat = texture.pixelFormat;
    source = asset.readMipData(mip);
  }

  // 2) Validate mip

  const formatInfo = getTextureFormatInfo(pixelFormat);
  if (formatInfo === undefined) {
    throw new Error(`Unsupported pixel format: ${pixelFormat}`);
  }

  const expectedEncodedLength = getTextureEncodedByteLength(formatInfo.layout, width, height);
  if (source.byteLength !== expectedEncodedLength) {
    throw new Error(
      `Mip contains ${source.byteLength} bytes, but ${expectedEncodedLength} bytes were expected.`
    );
  }

  // 3) Decode mip

  let rgba: Uint8Array;
  switch (formatInfo.kind) {
    case "bgra8":
      rgba = swapRedBlue(source);
      break;

    case "bc":
      if (decoder === undefined) {
        throw new Error(`A codec is required to decode ${pixelFormat} textures.`);
      }

      rgba = await decoder.decode(formatInfo.bcFormat, source, width, height, onProgress);
      break;
  }

  // 4) Finish up

  const expectedDecodedLength = width * height * 4;
  if (rgba.byteLength !== expectedDecodedLength) {
    throw new Error(
      `Decoding yielded ${rgba.byteLength} bytes, but ${expectedDecodedLength} bytes were expected.`
    );
  }

  if (virtualMip !== undefined) {
    applyVirtualTextureConstants(rgba, width, virtualMip.constantRegions);
  }

  return {
    width,
    height,
    rgba,
    encodedByteLength: source.byteLength,
  };
}

/** Reconstruct a tangent-space normal's positive Z component from BC5 X/Y data. */
export function reconstructNormalMapBlue(rgba: Uint8Array): void {
  for (let offset = 0; offset < rgba.byteLength; offset += 4) {
    const x = rgba[offset] / 127.5 - 1;
    const y = rgba[offset + 1] / 127.5 - 1;
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    rgba[offset + 2] = Math.round((z + 1) * 127.5);
  }
}
