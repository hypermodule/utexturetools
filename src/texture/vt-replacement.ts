import type {TextureEncoder} from "./codec.ts";
import {getTextureFormatInfo} from "./formats.ts";
import type {RgbaMip} from "./mips.ts";
import {encodeRgbaImage} from "./encoding.ts";
import {
  encodeVirtualTextureAddress,
  EVirtualTextureCodec,
  type VirtualTextureBuiltData,
  VirtualTextureDataChunk,
  VirtualTextureLayerInfo,
  VirtualTextureTileOffsetData,
} from "../ue/vt.ts";
import {checkedProduct, checkedSum, concatenate, modulo, sha1, UINT32_MAX} from "../util.ts";
import type {CookedAsset} from "../ue/cooked-asset.ts";
import {ObjectDataResource} from "../ue/uasset.ts";
import type {BcEncodeOptions} from "../wasm/wasm.ts";

const RAW_GPU_CODEC_PAYLOAD_SIZE = 4;
const MIN_TILES_IN_SEPARATE_CHUNK = 64;

interface AddressedTile {
  readonly x: number;
  readonly y: number;
  readonly address: number;
}

/** Rebuild a cloned one-layer virtual texture in place and return its raw-GPU chunk payloads. */
export async function rebuildVirtualTexture(
  builtData: VirtualTextureBuiltData,
  mips: readonly RgbaMip[],
  encoder?: TextureEncoder,
  options: BcEncodeOptions = {},
): Promise<Uint8Array[]> {
  const pixelFormat = builtData.layerTypes[0];
  if (pixelFormat === undefined) {
    throw new Error("The virtual texture does not contain a pixel-format layer.");
  }

  const formatInfo = getTextureFormatInfo(pixelFormat);
  if (formatInfo === undefined) {
    throw new Error(`Replacing pixel format ${pixelFormat} is not supported yet.`);
  }

  const {layout} = formatInfo;
  const physicalTileSize = builtData.tileSize + builtData.tileBorderSize * 2;
  const physicalBlocksWide = physicalTileSize / layout.blockWidth;
  const physicalBlocksHigh = physicalTileSize / layout.blockHeight;
  const tileRowBytes = checkedProduct(physicalBlocksWide, layout.bytesPerBlock);
  const tileStride = checkedProduct(tileRowBytes, physicalBlocksHigh);
  const expectedLengths = mips.map(mip => {
    const tileCount = checkedProduct(
      Math.ceil(mip.width / builtData.tileSize),
      Math.ceil(mip.height / builtData.tileSize),
    );
    return checkedProduct(tileCount, tileStride);
  });
  const total = expectedLengths.reduce(checkedSum, 0);
  let completed = 0;
  options.onProgress?.(0, total);

  builtData.tileDataOffsetPerLayer = [tileStride];
  builtData.numMips = mips.length;
  builtData.width = mips[0].width;
  builtData.height = mips[0].height;
  builtData.chunkIndexPerMip = [];
  builtData.baseOffsetPerMip = [];
  builtData.tileOffsetData = [];
  builtData.tileIndexPerChunk = [];
  builtData.tileIndexPerMip = [];
  builtData.tileOffsetInChunk = [];

  const chunkParts: Uint8Array[][] = [];
  let currentChunkSize = 0;
  let previousTileCount = 0;
  for (let mipIndex = 0; mipIndex < mips.length; mipIndex++) {
    const mip = mips[mipIndex];
    const tilesWide = Math.ceil(mip.width / builtData.tileSize);
    const tilesHigh = Math.ceil(mip.height / builtData.tileSize);
    const addressedTiles = makeAddressedTiles(tilesWide, tilesHigh);
    const atlas = makePhysicalTileAtlas(
      mip,
      tilesWide,
      tilesHigh,
      builtData.tileSize,
      builtData.tileBorderSize,
    );

    const expectedLength = expectedLengths[mipIndex];
    const encodedAtlas = await encodeRgbaImage(
      formatInfo, atlas, encoder, {
        ...options,
        onProgress: (mipCompleted, mipTotal) => {
          const fraction = mipTotal === 0 ? 1 : mipCompleted / mipTotal;
          options.onProgress?.(completed + Math.floor(expectedLength * fraction), total);
        },
      },
    );
    const tileData = extractMortonOrderedTiles(
      encodedAtlas,
      addressedTiles,
      tilesWide,
      physicalBlocksWide,
      physicalBlocksHigh,
      layout.bytesPerBlock,
    );

    // UE stores every mip of at least 64 tiles in its own chunk, then
    // combines all of the smaller mips into one mip-tail chunk.
    if (mipIndex === 0 || previousTileCount >= MIN_TILES_IN_SEPARATE_CHUNK) {
      chunkParts.push([new Uint8Array(RAW_GPU_CODEC_PAYLOAD_SIZE)]);
      currentChunkSize = RAW_GPU_CODEC_PAYLOAD_SIZE;
    }

    const chunkIndex = chunkParts.length - 1;
    builtData.chunkIndexPerMip.push(chunkIndex);
    builtData.baseOffsetPerMip.push(currentChunkSize);
    builtData.tileOffsetData.push(makeTileOffsetData(tilesWide, tilesHigh, addressedTiles));
    chunkParts[chunkIndex].push(tileData);
    currentChunkSize = checkedSum(currentChunkSize, tileData.byteLength);
    previousTileCount = addressedTiles.length;

    completed += expectedLength;
    options.onProgress?.(completed, total);
  }

  const payloads = chunkParts.map(parts => concatenate(parts));
  const hashes = await Promise.all(payloads.map(sha1));
  builtData.chunks = payloads.map((payload, index) => {
    const chunk = new VirtualTextureDataChunk();
    chunk.bulkDataHash = hashes[index];
    chunk.sizeInBytes = payload.byteLength;
    chunk.codecPayloadSize = RAW_GPU_CODEC_PAYLOAD_SIZE;
    chunk.layerInfos = [
      new VirtualTextureLayerInfo(EVirtualTextureCodec.RawGPU, RAW_GPU_CODEC_PAYLOAD_SIZE),
    ];
    chunk.dataResourceIndex = index;
    return chunk;
  });

  return payloads;
}

function makePhysicalTileAtlas(
  mip: RgbaMip,
  tilesWide: number,
  tilesHigh: number,
  tileSize: number,
  tileBorderSize: number,
): RgbaMip {
  const physicalTileSize = tileSize + tileBorderSize * 2;
  const atlasWidth = checkedProduct(tilesWide, physicalTileSize);
  const atlasHeight = checkedProduct(tilesHigh, physicalTileSize);
  const rgba = new Uint8Array(checkedProduct(checkedProduct(atlasWidth, atlasHeight), 4));

  for (let tileY = 0; tileY < tilesHigh; tileY++) {
    for (let localY = 0; localY < physicalTileSize; localY++) {
      const sourceY = modulo(tileY * tileSize + localY - tileBorderSize, mip.height);
      const destinationY = tileY * physicalTileSize + localY;

      for (let tileX = 0; tileX < tilesWide; tileX++) {
        let destinationOffset = (destinationY * atlasWidth + tileX * physicalTileSize) * 4;
        for (let localX = 0; localX < physicalTileSize; localX++) {
          const sourceX = modulo(tileX * tileSize + localX - tileBorderSize, mip.width);
          const sourceOffset = (sourceY * mip.width + sourceX) * 4;
          rgba[destinationOffset] = mip.rgba[sourceOffset];
          rgba[destinationOffset + 1] = mip.rgba[sourceOffset + 1];
          rgba[destinationOffset + 2] = mip.rgba[sourceOffset + 2];
          rgba[destinationOffset + 3] = mip.rgba[sourceOffset + 3];
          destinationOffset += 4;
        }
      }
    }
  }

  return {width: atlasWidth, height: atlasHeight, rgba};
}

function extractMortonOrderedTiles(
  atlas: Uint8Array,
  addressedTiles: readonly AddressedTile[],
  tilesWide: number,
  physicalBlocksWide: number,
  physicalBlocksHigh: number,
  bytesPerBlock: number,
): Uint8Array {
  const tileRowBytes = physicalBlocksWide * bytesPerBlock;
  const tileStride = tileRowBytes * physicalBlocksHigh;
  const atlasRowBytes = tilesWide * tileRowBytes;
  const result = new Uint8Array(addressedTiles.length * tileStride);

  addressedTiles.forEach((tile, tileIndex) => {
    for (let row = 0; row < physicalBlocksHigh; row++) {
      const sourceOffset =
        (tile.y * physicalBlocksHigh + row) * atlasRowBytes + tile.x * tileRowBytes;
      const destinationOffset = tileIndex * tileStride + row * tileRowBytes;
      result.set(atlas.subarray(sourceOffset, sourceOffset + tileRowBytes), destinationOffset);
    }
  });

  return result;
}

function makeAddressedTiles(tilesWide: number, tilesHigh: number): AddressedTile[] {
  const tiles: AddressedTile[] = [];
  for (let y = 0; y < tilesHigh; y++) {
    for (let x = 0; x < tilesWide; x++) {
      tiles.push({x, y, address: encodeVirtualTextureAddress(x, y)});
    }
  }
  tiles.sort((left, right) => left.address - right.address);
  return tiles;
}

function makeTileOffsetData(
  tilesWide: number,
  tilesHigh: number,
  tiles: readonly AddressedTile[],
): VirtualTextureTileOffsetData {
  const data = new VirtualTextureTileOffsetData();
  data.width = tilesWide;
  data.height = tilesHigh;
  data.addresses = [0];
  data.offsets = [0];

  for (let index = 1; index < tiles.length; index++) {
    const previousAddress = tiles[index - 1].address;
    const address = tiles[index].address;
    if (address !== previousAddress + 1) {
      data.addresses.push(previousAddress + 1, address);
      data.offsets.push(UINT32_MAX, index);
    }
  }

  const finalAddress = tiles[tiles.length - 1].address;
  if (finalAddress >= UINT32_MAX) {
    throw new RangeError("The virtual texture tile grid exceeds Morton address limits.");
  }
  data.maxAddress = finalAddress + 1;
  return data;
}

export function makeVirtualDataResources(
  asset: CookedAsset,
  virtualTexture: VirtualTextureBuiltData,
  bulkPayloads: readonly Uint8Array[],
): ObjectDataResource[] {
  const templates = virtualTexture.chunks.map(chunk => (
    asset.uasset.dataResourceMap[chunk.dataResourceIndex]
  ));

  return bulkPayloads.map((payload, index) => {
    const template = templates[Math.min(index, templates.length - 1)];
    const resource = template.clone();
    resource.serialOffset = 0n;
    resource.serialSize = BigInt(payload.byteLength);
    resource.rawSize = BigInt(payload.byteLength);
    return resource;
  });
}