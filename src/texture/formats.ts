import {
  BGRA8_LAYOUT,
  type BcFormat,
  getBcFormatLayout,
  type PixelFormatInfo,
  type TextureFormatLayout,
} from "../pixel-formats.ts";

export function getTextureFormatInfo(pixelFormat: string): PixelFormatInfo | undefined {
  let bcFormat: BcFormat;

  switch (pixelFormat) {
    case "PF_B8G8R8A8": return {kind: "bgra8", layout: BGRA8_LAYOUT};
    case "PF_DXT1": bcFormat = "bc1"; break;
    case "PF_DXT3": bcFormat = "bc2"; break;
    case "PF_DXT5": bcFormat = "bc3"; break;
    case "PF_BC4": bcFormat = "bc4"; break;
    case "PF_BC5": bcFormat = "bc5"; break;
    case "PF_BC7": bcFormat = "bc7"; break;
    default: return undefined;
  }

  return {kind: "bc", bcFormat, layout: getBcFormatLayout(bcFormat)};
}

export function getTextureFormatLayout(pixelFormat: string): TextureFormatLayout | undefined {
  return getTextureFormatInfo(pixelFormat)?.layout;
}

export function getTextureBcFormat(pixelFormat: string): BcFormat | undefined {
  const info = getTextureFormatInfo(pixelFormat);
  return info?.kind === "bc" ? info.bcFormat : undefined;
}
