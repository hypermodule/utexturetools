import {AssetFormatError, AssetReader} from "./asset-reader.ts";
import {AssetWriter} from "./asset-writer.ts";
import {UINT32_MAX} from "../util.ts";

export class VirtualTextureBuiltData {
  private static readonly MAX_LAYERS = 8;

  isCooked = false;
  numLayers = 0;
  widthInBlocks = 0;
  heightInBlocks = 0;
  tileSize = 0;
  tileBorderSize = 0;
  tileDataOffsetPerLayer: number[] = [];

  numMips = 0;
  width = 0;
  height = 0;

  chunkIndexPerMip: number[] = [];
  baseOffsetPerMip: number[] = [];
  tileOffsetData: VirtualTextureTileOffsetData[] = [];

  tileIndexPerChunk: number[] = [];
  tileIndexPerMip: number[] = [];
  tileOffsetInChunk: number[] = [];

  // Array of pixel formats, e.g. "PF_DXT1", "PF_DXT5", etc.
  layerTypes: string[] = [];
  layerFallbackColors: LinearColor[] = [];

  chunks: VirtualTextureDataChunk[] = [];

  clone(): VirtualTextureBuiltData {
    const copy = new VirtualTextureBuiltData();
    copy.isCooked = this.isCooked;
    copy.numLayers = this.numLayers;
    copy.widthInBlocks = this.widthInBlocks;
    copy.heightInBlocks = this.heightInBlocks;
    copy.tileSize = this.tileSize;
    copy.tileBorderSize = this.tileBorderSize;
    copy.tileDataOffsetPerLayer = this.tileDataOffsetPerLayer.slice();
    copy.numMips = this.numMips;
    copy.width = this.width;
    copy.height = this.height;
    copy.chunkIndexPerMip = this.chunkIndexPerMip.slice();
    copy.baseOffsetPerMip = this.baseOffsetPerMip.slice();
    copy.tileOffsetData = this.tileOffsetData.map(data => data.clone());
    copy.tileIndexPerChunk = this.tileIndexPerChunk.slice();
    copy.tileIndexPerMip = this.tileIndexPerMip.slice();
    copy.tileOffsetInChunk = this.tileOffsetInChunk.slice();
    copy.layerTypes = this.layerTypes.slice();
    copy.layerFallbackColors = this.layerFallbackColors.slice();
    copy.chunks = this.chunks.map(chunk => chunk.clone());
    return copy;
  }

  write(writer: AssetWriter): void {
    VirtualTextureBuiltData.validate(this);

    writer.writeBoolean32(this.isCooked);
    writer.writeUint32(this.numLayers);
    writer.writeUint32(this.widthInBlocks);
    writer.writeUint32(this.heightInBlocks);
    writer.writeUint32(this.tileSize);
    writer.writeUint32(this.tileBorderSize);
    writeUint32Array(writer, this.tileDataOffsetPerLayer);

    writer.writeUint32(this.numMips);
    writer.writeUint32(this.width);
    writer.writeUint32(this.height);

    writeUint32Array(writer, this.chunkIndexPerMip);
    writeUint32Array(writer, this.baseOffsetPerMip);
    writer.writeInt32(this.tileOffsetData.length);
    for (const data of this.tileOffsetData) {
      data.write(writer);
    }

    writeUint32Array(writer, this.tileIndexPerChunk);
    writeUint32Array(writer, this.tileIndexPerMip);
    writeUint32Array(writer, this.tileOffsetInChunk);

    for (const layerType of this.layerTypes) {
      writer.writeAnsiString(layerType);
    }
    for (const color of this.layerFallbackColors) {
      color.write(writer);
    }

    writer.writeInt32(this.chunks.length);
    for (const chunk of this.chunks) {
      chunk.write(writer, this.numLayers);
    }
  }

  static read(reader: AssetReader): VirtualTextureBuiltData {
    const data = new VirtualTextureBuiltData();

    data.isCooked = reader.readBoolean32();

    data.numLayers = reader.readUint32();
    VirtualTextureBuiltData.validateLayerCount(data.numLayers);

    data.widthInBlocks = reader.readUint32();
    data.heightInBlocks = reader.readUint32();
    data.tileSize = reader.readUint32();
    data.tileBorderSize = reader.readUint32();
    data.tileDataOffsetPerLayer = reader.readLengthPrefixedArray(r => r.readUint32(), 4);

    data.numMips = reader.readUint32();
    data.width = reader.readUint32();
    data.height = reader.readUint32();

    data.chunkIndexPerMip = reader.readLengthPrefixedArray(r => r.readUint32(), 4);
    data.baseOffsetPerMip = reader.readLengthPrefixedArray(r => r.readUint32(), 4);
    data.tileOffsetData = reader.readLengthPrefixedArray(VirtualTextureTileOffsetData.read);

    data.tileIndexPerChunk = reader.readLengthPrefixedArray(r => r.readUint32(), 4);
    data.tileIndexPerMip = reader.readLengthPrefixedArray(r => r.readUint32(), 4);
    data.tileOffsetInChunk = reader.readLengthPrefixedArray(r => r.readUint32(), 4);

    if (data.tileOffsetInChunk.length > 0) {
      reader.throwFormatError("legacy virtual texture format not supported");
    }

    data.layerTypes = reader.readArray(data.numLayers, r => r.readFString());
    data.layerFallbackColors = reader.readArray(data.numLayers, LinearColor.read, LinearColor.SIZE);

    data.chunks =
      reader.readLengthPrefixedArray(r => VirtualTextureDataChunk.read(r, data.numLayers));

    VirtualTextureBuiltData.validate(data);
    return data;
  }

  private static validate(data: VirtualTextureBuiltData): void {
    VirtualTextureBuiltData.validateLayerCount(data.numLayers);

    if (data.width === 0 || data.height === 0) {
      throw new AssetFormatError(
        `virtual texture has invalid dimensions: ${data.width}x${data.height}`,
      );
    }

    if (data.tileSize === 0) {
      throw new AssetFormatError("virtual texture has an invalid tile size: 0");
    }

    const layerArrayLengths = [
      ["tile data offsets", data.tileDataOffsetPerLayer.length],
      ["pixel formats", data.layerTypes.length],
      ["fallback colors", data.layerFallbackColors.length],
    ] as const;
    for (const [name, length] of layerArrayLengths) {
      if (length !== data.numLayers) {
        const layerLabel = data.numLayers === 1 ? "1 layer" : `${data.numLayers} layers`;
        throw new AssetFormatError(
          `virtual texture declares ${layerLabel} but contains ${length} ${name}`,
        );
      }
    }

    if (data.tileDataOffsetPerLayer.at(-1) === 0) {
      throw new AssetFormatError("virtual texture has an invalid tile data stride: 0");
    }

    const mipArrayLengths = [
      ["chunk indices", data.chunkIndexPerMip.length],
      ["base offsets", data.baseOffsetPerMip.length],
      ["tile offsets", data.tileOffsetData.length],
    ] as const;

    for (const [name, length] of mipArrayLengths) {
      if (length !== data.numMips) {
        throw new AssetFormatError(
          `virtual texture has ${data.numMips} mips but ${length} per-mip ${name}`,
        );
      }
    }

    for (let mipIndex = 0; mipIndex < data.numMips; mipIndex++) {
      const chunkIndex = data.chunkIndexPerMip[mipIndex];
      const baseOffset = data.baseOffsetPerMip[mipIndex];

      if (
        chunkIndex !== UINT32_MAX &&
        baseOffset !== UINT32_MAX &&
        chunkIndex >= data.chunks.length
      ) {
        throw new AssetFormatError(
          `virtual texture chunk index ${chunkIndex} for mip ${mipIndex} is out of range`,
        );
      }
    }
  }

  private static validateLayerCount(numLayers: number): void {
    if (numLayers === 0) {
      throw new AssetFormatError("virtual texture has no layers");
    }
    if (numLayers > VirtualTextureBuiltData.MAX_LAYERS) {
      throw new AssetFormatError(
        `virtual texture has too many layers (${numLayers} > ` +
        `${VirtualTextureBuiltData.MAX_LAYERS})`,
      );
    }
  }
}

export class VirtualTextureTileOffsetData {
  width = 0;
  height = 0;
  maxAddress = 0;
  addresses: number[] = [];
  offsets: number[] = [];

  clone(): VirtualTextureTileOffsetData {
    const copy = new VirtualTextureTileOffsetData();
    copy.width = this.width;
    copy.height = this.height;
    copy.maxAddress = this.maxAddress;
    copy.addresses = this.addresses.slice();
    copy.offsets = this.offsets.slice();
    return copy;
  }

  write(writer: AssetWriter): void {
    VirtualTextureTileOffsetData.validate(this);
    writer.writeUint32(this.width);
    writer.writeUint32(this.height);
    writer.writeUint32(this.maxAddress);
    writeUint32Array(writer, this.addresses);
    writeUint32Array(writer, this.offsets);
  }

  static read(reader: AssetReader): VirtualTextureTileOffsetData {
    const data = new VirtualTextureTileOffsetData();

    data.width = reader.readUint32();
    data.height = reader.readUint32();
    data.maxAddress = reader.readUint32();
    data.addresses = reader.readLengthPrefixedArray(r => r.readUint32(), 4);
    data.offsets = reader.readLengthPrefixedArray(r => r.readUint32(), 4);

    VirtualTextureTileOffsetData.validate(data);
    return data;
  }

  private static validate(data: VirtualTextureTileOffsetData): void {
    if (data.addresses.length === 0 || data.addresses.length !== data.offsets.length) {
      throw new AssetFormatError("virtual texture has invalid tile offset lookup data");
    }

    if (data.addresses[0] !== 0) {
      throw new AssetFormatError("virtual texture tile offset addresses must start at zero");
    }

    for (let index = 0; index < data.addresses.length; index++) {
      const address = data.addresses[index];
      const nextAddress = data.addresses[index + 1] ?? data.maxAddress;

      if (nextAddress <= address) {
        throw new AssetFormatError("virtual texture tile offset addresses are not increasing");
      }

      const offset = data.offsets[index];
      const runLength = nextAddress - address;
      if (offset !== UINT32_MAX && offset > UINT32_MAX - (runLength - 1)) {
        throw new AssetFormatError("virtual texture tile offset overflows uint32");
      }
    }
  }
}

export class VirtualTextureDataChunk {
  bulkDataHash: Uint8Array<ArrayBufferLike> = new Uint8Array();
  sizeInBytes = 0;
  codecPayloadSize = 0;
  layerInfos: VirtualTextureLayerInfo[] = [];
  dataResourceIndex = 0;

  clone(): VirtualTextureDataChunk {
    const copy = new VirtualTextureDataChunk();
    copy.bulkDataHash = this.bulkDataHash.slice();
    copy.sizeInBytes = this.sizeInBytes;
    copy.codecPayloadSize = this.codecPayloadSize;
    copy.layerInfos = this.layerInfos.slice();
    copy.dataResourceIndex = this.dataResourceIndex;
    return copy;
  }

  write(writer: AssetWriter, numLayers: number): void {
    if (this.bulkDataHash.byteLength !== 20) {
      throw new Error(
        `Virtual texture chunk hashes must contain 20 bytes (found ${this.bulkDataHash.byteLength}).`,
      );
    }
    if (this.layerInfos.length !== numLayers) {
      throw new Error(
        `Virtual texture chunk has ${this.layerInfos.length} layer records; expected ${numLayers}.`,
      );
    }

    writer.writeBytes(this.bulkDataHash);
    writer.writeUint32(this.sizeInBytes);
    writer.writeUint32(this.codecPayloadSize);
    for (const layerInfo of this.layerInfos) {
      layerInfo.write(writer);
    }
    writer.writeInt32(this.dataResourceIndex);
  }

  static read(reader: AssetReader, numLayers: number): VirtualTextureDataChunk {
    const chunk = new VirtualTextureDataChunk();

    chunk.bulkDataHash = reader.readBytes(20); // SHA hash
    chunk.sizeInBytes = reader.readUint32();
    chunk.codecPayloadSize = reader.readUint32();
    chunk.layerInfos =
      reader.readArray(numLayers, VirtualTextureLayerInfo.read, VirtualTextureLayerInfo.SIZE);
    chunk.dataResourceIndex = reader.readInt32();

    return chunk;
  }
}

export class VirtualTextureLayerInfo {
  static readonly SIZE = 1 + 4;

  readonly codec: EVirtualTextureCodec;
  readonly payloadOffset: number;

  constructor(codec: EVirtualTextureCodec, payloadOffset: number) {
    this.codec = codec;
    this.payloadOffset = payloadOffset;
  }

  static read(reader: AssetReader): VirtualTextureLayerInfo {
    const codec = reader.readUint8() as EVirtualTextureCodec;
    const payloadOffset = reader.readUint32();

    return new VirtualTextureLayerInfo(codec, payloadOffset);
  }

  write(writer: AssetWriter): void {
    writer.writeUint8(this.codec);
    writer.writeUint32(this.payloadOffset);
  }
}

export const EVirtualTextureCodec = {
  Black: 0,
  OpaqueBlack: 1,
  White: 2,
  Flat: 3,
  RawGPU: 4,
  ZippedGPU_DEPRECATED: 5,
  Crunch_DEPRECATED: 6,
  Max: 7,
} as const;
export type EVirtualTextureCodec = (typeof EVirtualTextureCodec)[keyof typeof EVirtualTextureCodec];

/** Encode a virtual tile coordinate as its 32-bit Morton address. */
export function encodeVirtualTextureAddress(tileX: number, tileY: number): number {
  if (tileX > 0xffff || tileY > 0xffff) {
    throw new RangeError("The virtual texture tile grid exceeds Morton address limits.");
  }
  return (mortonCode2(tileX) | (mortonCode2(tileY) << 1)) >>> 0;
}

function mortonCode2(value: number): number {
  let code = value & 0x0000_ffff;
  code = (code ^ (code << 8)) & 0x00ff_00ff;
  code = (code ^ (code << 4)) & 0x0f0f_0f0f;
  code = (code ^ (code << 2)) & 0x3333_3333;
  code = (code ^ (code << 1)) & 0x5555_5555;
  return code >>> 0;
}

export class LinearColor {
  static readonly SIZE = 4 * 4;

  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;

  constructor(r: number, g: number, b: number, a: number) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  static read(reader: AssetReader): LinearColor {
    const r = reader.readFloat32();
    const g = reader.readFloat32();
    const b = reader.readFloat32();
    const a = reader.readFloat32();

    return new LinearColor(r, g, b, a);
  }

  write(writer: AssetWriter): void {
    writer.writeFloat32(this.r);
    writer.writeFloat32(this.g);
    writer.writeFloat32(this.b);
    writer.writeFloat32(this.a);
  }
}

function writeUint32Array(writer: AssetWriter, values: readonly number[]): void {
  writer.writeInt32(values.length);
  for (const value of values) {
    writer.writeUint32(value);
  }
}
