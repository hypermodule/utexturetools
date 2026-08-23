import type {CookedAsset} from "../ue/cooked-asset.ts";
import {AssetFormatError} from "../ue/asset-reader.ts";
import {
  EVirtualTextureCodec,
  encodeVirtualTextureAddress,
  type VirtualTextureBuiltData,
  type VirtualTextureTileOffsetData,
} from "../ue/vt.ts";
import {getTextureFormatLayout} from "./formats.ts";
import type {TextureFormatLayout} from "../pixel-formats.ts";
import {checkedProduct, UINT32_MAX} from "../util.ts";

type RgbaColor = readonly [red: number, green: number, blue: number, alpha: number];

export interface VirtualTextureConstantRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: RgbaColor;
}

export interface AssembledVirtualTextureMip {
  readonly width: number;
  readonly height: number;
  readonly pixelFormat: string;
  readonly encoded: Uint8Array;
  readonly constantRegions: readonly VirtualTextureConstantRegion[];
}

interface TileLayout {
  readonly physicalTileBytes: number;
  readonly physicalTileRowBytes: number;
  readonly usefulTileBlocksX: number;
  readonly usefulTileBlocksY: number;
  readonly borderBlocksX: number;
  readonly borderBlocksY: number;
  readonly outputBlocksX: number;
  readonly outputBlocksY: number;
  readonly outputRowBytes: number;
}

export function assembleVirtualTextureMip(
  asset: CookedAsset,
  mipIndex: number,
): AssembledVirtualTextureMip {
  // Derived from CUE4Parse (see NOTICE.txt for license)

  const texture = asset.getTextureExport();
  const vt = texture.virtualTextureData;

  if (!texture.isVirtual || vt === null) {
    throw new Error("The texture does not contain virtual texture data.");
  }

  if (vt.numLayers !== 1) {
    throw new Error(
      `Only virtual textures with a single layer are supported (found ${vt.numLayers}).`,
    );
  }

  if (!Number.isInteger(mipIndex) || mipIndex < 0 || mipIndex >= vt.numMips) {
    throw new RangeError(`Mip ${mipIndex} is out of range.`);
  }

  const tileOffsets = vt.tileOffsetData[mipIndex];
  const pixelFormat = vt.layerTypes[0];
  const format = getTextureFormatLayout(pixelFormat);
  if (format === undefined) {
    throw new Error(`Virtual texture pixel format ${pixelFormat} is not supported yet.`);
  }

  const width = getMipDimension(vt.width, mipIndex);
  const height = getMipDimension(vt.height, mipIndex);
  const layout = computeTileLayout(vt, format, width, height);
  validateTileGrid(vt, tileOffsets, width, height);

  const outputLength = checkedProduct(layout.outputRowBytes, layout.outputBlocksY);
  const encoded = new Uint8Array(outputLength);
  initializePlaceholderBlocks(encoded, pixelFormat, format.bytesPerBlock);

  const chunkIndex = vt.chunkIndexPerMip[mipIndex];
  const baseOffset = vt.baseOffsetPerMip[mipIndex];
  const constantRegions: VirtualTextureConstantRegion[] = [];
  if (chunkIndex === UINT32_MAX || baseOffset === UINT32_MAX) {
    return {width, height, pixelFormat, encoded, constantRegions};
  }

  const chunk = vt.chunks[chunkIndex];
  const layerInfo = chunk.layerInfos[0];
  const constantColor = getConstantColor(layerInfo.codec);
  if (constantColor === undefined && layerInfo.codec !== EVirtualTextureCodec.RawGPU) {
    throw new Error(`Virtual texture codec ${layerInfo.codec} is not supported yet.`);
  }

  const tileStride = vt.tileDataOffsetPerLayer[0];
  let chunkData: Uint8Array | undefined;

  for (let tileY = 0; tileY < tileOffsets.height; tileY++) {
    for (let tileX = 0; tileX < tileOffsets.width; tileX++) {
      const tileOffset = getTileOffset(tileOffsets, encodeVirtualTextureAddress(tileX, tileY));
      if (tileOffset === undefined) {
        continue;
      }

      if (constantColor !== undefined) {
        const x = tileX * vt.tileSize;
        const y = tileY * vt.tileSize;
        constantRegions.push({
          x,
          y,
          width: Math.min(vt.tileSize, width - x),
          height: Math.min(vt.tileSize, height - y),
          color: constantColor,
        });
        continue;
      }

      const tileStart = checkedTileStart(baseOffset, tileOffset, tileStride);
      chunkData ??= asset.readDataResource(chunk.dataResourceIndex);

      copyTile(
        chunkData,
        tileStart,
        encoded,
        tileX,
        tileY,
        layout,
        format.bytesPerBlock,
      );
    }
  }

  return {width, height, pixelFormat, encoded, constantRegions};
}

export function applyVirtualTextureConstants(
  rgba: Uint8Array,
  imageWidth: number,
  regions: readonly VirtualTextureConstantRegion[],
): void {
  for (const region of regions) {
    for (let y = region.y; y < region.y + region.height; y++) {
      let offset = (y * imageWidth + region.x) * 4;

      for (let x = 0; x < region.width; x++) {
        rgba[offset] = region.color[0];
        rgba[offset + 1] = region.color[1];
        rgba[offset + 2] = region.color[2];
        rgba[offset + 3] = region.color[3];
        offset += 4;
      }
    }
  }
}

function computeTileLayout(
  vt: VirtualTextureBuiltData,
  format: TextureFormatLayout,
  outputWidth: number,
  outputHeight: number,
): TileLayout {
  if (vt.tileSize % format.blockWidth !== 0 || vt.tileSize % format.blockHeight !== 0) {
    throw new AssetFormatError(
      `virtual texture tile size ${vt.tileSize} is not a multiple of the format block size`,
    );
  }

  if (vt.tileBorderSize % format.blockWidth !== 0 || vt.tileBorderSize % format.blockHeight !== 0) {
    throw new AssetFormatError(
      `virtual texture tile border ${vt.tileBorderSize} is not a multiple of the format block size`,
    );
  }

  const physicalWidth = vt.tileSize + vt.tileBorderSize * 2;
  const physicalHeight = vt.tileSize + vt.tileBorderSize * 2;
  const physicalBlocksX = physicalWidth / format.blockWidth;
  const physicalBlocksY = physicalHeight / format.blockHeight;
  const physicalTileRowBytes = checkedProduct(physicalBlocksX, format.bytesPerBlock);
  const outputBlocksX = Math.ceil(outputWidth / format.blockWidth);
  const outputBlocksY = Math.ceil(outputHeight / format.blockHeight);

  return {
    physicalTileBytes: checkedProduct(physicalTileRowBytes, physicalBlocksY),
    physicalTileRowBytes,
    usefulTileBlocksX: vt.tileSize / format.blockWidth,
    usefulTileBlocksY: vt.tileSize / format.blockHeight,
    borderBlocksX: vt.tileBorderSize / format.blockWidth,
    borderBlocksY: vt.tileBorderSize / format.blockHeight,
    outputBlocksX,
    outputBlocksY,
    outputRowBytes: checkedProduct(outputBlocksX, format.bytesPerBlock),
  };
}

function validateTileGrid(
  vt: VirtualTextureBuiltData,
  tileOffsets: VirtualTextureTileOffsetData,
  width: number,
  height: number,
): void {
  const expectedWidth = Math.ceil(width / vt.tileSize);
  const expectedHeight = Math.ceil(height / vt.tileSize);

  if (tileOffsets.width !== expectedWidth || tileOffsets.height !== expectedHeight) {
    throw new AssetFormatError(
      `virtual texture mip tile grid is ${tileOffsets.width}x${tileOffsets.height}, ` +
      `but ${expectedWidth}x${expectedHeight} was expected`,
    );
  }

  if (tileOffsets.width > 0x1_0000 || tileOffsets.height > 0x1_0000) {
    throw new AssetFormatError("virtual texture tile grid exceeds Morton address limits");
  }
}

function getTileOffset(data: VirtualTextureTileOffsetData, address: number): number | undefined {
  if (address >= data.maxAddress) {
    return undefined;
  }

  let low = 0;
  let high = data.addresses.length;

  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    const middleAddress = data.addresses[middle];
    if (middleAddress <= address) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  const blockIndex = low - 1;
  const baseAddress = data.addresses[blockIndex];
  const baseOffset = data.offsets[blockIndex];
  if (baseOffset === UINT32_MAX) {
    return undefined;
  }

  return baseOffset + address - baseAddress;
}

function copyTile(
  chunkData: Uint8Array,
  tileStart: number,
  output: Uint8Array,
  tileX: number,
  tileY: number,
  layout: TileLayout,
  bytesPerBlock: number,
): void {
  if (tileStart > chunkData.byteLength - layout.physicalTileBytes) {
    throw new AssetFormatError(
      `virtual texture tile range [${tileStart}, ${tileStart + layout.physicalTileBytes}) 
      exceeds its ${chunkData.byteLength}-byte chunk`
    );
  }

  const destinationBlockX = tileX * layout.usefulTileBlocksX;
  const destinationBlockY = tileY * layout.usefulTileBlocksY;

  const blocksToCopyX = Math.min(
    layout.usefulTileBlocksX,
    layout.outputBlocksX - destinationBlockX,
  );

  const blocksToCopyY = Math.min(
    layout.usefulTileBlocksY,
    layout.outputBlocksY - destinationBlockY,
  );

  const rowBytes = blocksToCopyX * bytesPerBlock;

  for (let row = 0; row < blocksToCopyY; row++) {
    const sourceOffset =
      tileStart +
      (layout.borderBlocksY + row) * layout.physicalTileRowBytes +
      layout.borderBlocksX * bytesPerBlock;

    const destinationOffset =
      (destinationBlockY + row) * layout.outputRowBytes +
      destinationBlockX * bytesPerBlock;

    output.set(chunkData.subarray(sourceOffset, sourceOffset + rowBytes), destinationOffset);
  }
}

function getMipDimension(baseDimension: number, mipIndex: number): number {
  return Math.max(1, Math.floor(baseDimension / (2 ** mipIndex)));
}

function getConstantColor(codec: EVirtualTextureCodec): RgbaColor | undefined {
  switch (codec) {
    case EVirtualTextureCodec.Black: return [0, 0, 0, 0];
    case EVirtualTextureCodec.OpaqueBlack: return [0, 0, 0, 255];
    case EVirtualTextureCodec.White: return [255, 255, 255, 255];
    case EVirtualTextureCodec.Flat: return [128, 125, 255, 255];
    default: return undefined;
  }
}

const TRANSPARENT_BLACK_BC7_BLOCK = new Uint8Array([
  0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x12, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x11,
]);

function initializePlaceholderBlocks(
  output: Uint8Array,
  pixelFormat: string,
  bytesPerBlock: number,
): void {
  if (pixelFormat !== "PF_BC7") {
    return;
  }

  // An all-zero BC7 block has no mode bit and is invalid. Constant tiles are
  // overwritten after decoding, but absent tiles keep this placeholder, so it
  // must decode to a sensible color (transparent black).
  for (let offset = 0; offset < output.byteLength; offset += bytesPerBlock) {
    output.set(TRANSPARENT_BLACK_BC7_BLOCK, offset);
  }
}

function checkedTileStart(baseOffset: number, tileOffset: number, tileStride: number): number {
  const result = baseOffset + tileOffset * tileStride;

  if (!Number.isSafeInteger(result)) {
    throw new AssetFormatError("virtual texture tile position exceeds integer limits");
  }

  return result;
}
