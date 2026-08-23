export interface TextureFormatLayout {
  readonly blockWidth: number;
  readonly blockHeight: number;
  readonly bytesPerBlock: number;
}

export const BGRA8_LAYOUT: TextureFormatLayout = {
  blockWidth: 1,
  blockHeight: 1,
  bytesPerBlock: 4,
};

const BC8_LAYOUT: TextureFormatLayout = {
  blockWidth: 4,
  blockHeight: 4,
  bytesPerBlock: 8,
};

const BC16_LAYOUT: TextureFormatLayout = {
  blockWidth: 4,
  blockHeight: 4,
  bytesPerBlock: 16,
};

const BC_FORMAT_LAYOUTS = {
  bc1: BC8_LAYOUT,
  bc2: BC16_LAYOUT,
  bc3: BC16_LAYOUT,
  bc4: BC8_LAYOUT,
  bc5: BC16_LAYOUT,
  bc7: BC16_LAYOUT,
} as const;
export type BcFormat = keyof typeof BC_FORMAT_LAYOUTS;

export type PixelFormatInfo =
  | {
      readonly kind: "bgra8";
      readonly layout: TextureFormatLayout;
    }
  | {
      readonly kind: "bc";
      readonly bcFormat: BcFormat;
      readonly layout: TextureFormatLayout;
    };

export function getBcFormatLayout(format: BcFormat): TextureFormatLayout {
  return BC_FORMAT_LAYOUTS[format];
}

export function getTextureEncodedByteLength(
  layout: TextureFormatLayout,
  width: number,
  height: number,
): number {
  let blocksWide = Math.ceil(width / layout.blockWidth);
  let blocksTall = Math.ceil(height / layout.blockHeight);
  return blocksWide * blocksTall * layout.bytesPerBlock;
}
