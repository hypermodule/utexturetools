import {getTextureEncodedByteLength, type PixelFormatInfo} from "../pixel-formats.ts";
import {swapRedBlue} from "../util.ts";
import type {TextureEncoder} from "./codec.ts";
import type {RgbaMip} from "./mips.ts";
import type {BcEncodeOptions} from "../wasm/wasm.ts";

export interface EncodedMip {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

export async function encodeMips(
  info: PixelFormatInfo,
  mips: readonly RgbaMip[],
  encoder?: TextureEncoder,
  options: BcEncodeOptions = {},
): Promise<EncodedMip[]> {
  const expectedLengths = mips.map(mip => (
    getTextureEncodedByteLength(info.layout, mip.width, mip.height)
  ));
  const total = expectedLengths.reduce((sum, length) => sum + length, 0);
  options.onProgress?.(0, total);

  let completed = 0;

  const encodedMips: EncodedMip[] = [];

  for (let index = 0; index < mips.length; index++) {
    const mip = mips[index];
    const expectedLength = expectedLengths[index];

    const data = await encodeRgbaImage(info, mip, encoder, {
      ...options,
      onProgress: (mipCompleted, mipTotal) => {
        const fraction = mipTotal === 0 ? 1 : mipCompleted / mipTotal;
        options.onProgress?.(completed + Math.floor(expectedLength * fraction), total);
      },
    });

    encodedMips.push({width: mip.width, height: mip.height, data});
    completed += expectedLength;
    options.onProgress?.(completed, total);
  }

  return encodedMips;
}

export async function encodeRgbaImage(
  formatInfo: PixelFormatInfo,
  image: RgbaMip,
  encoder?: TextureEncoder,
  options: BcEncodeOptions = {},
): Promise<Uint8Array> {
  let data: Uint8Array;
  switch (formatInfo.kind) {
    case "bgra8":
      data = swapRedBlue(image.rgba);
      break;
    case "bc":
      if (encoder === undefined) {
        throw new Error(`Internal error: No BC encoder was supplied!`);
      }
      data =
        await encoder.encode(formatInfo.bcFormat, image.rgba, image.width, image.height, options);
      break;
  }

  const expectedLength = getTextureEncodedByteLength(formatInfo.layout, image.width, image.height);
  if (data.byteLength !== expectedLength) {
    throw new Error(
      `Encoding produced ${data.byteLength} bytes, but ${expectedLength} bytes were expected.`
    );
  }

  return data;
}