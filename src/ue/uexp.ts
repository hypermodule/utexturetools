import {AssetReader} from "./asset-reader.ts";
import {AssetWriter} from "./asset-writer.ts";
import {PACKAGE_FILE_TAG} from "./summary.ts";
import {BulkType, MinimalName, type ObjectDataResource, UAsset} from "./uasset.ts";
import {UEVersion} from "./versioning.ts";
import {VirtualTextureBuiltData} from "./vt.ts";
import {bigint, fmt} from "../util.ts";

export class UExp {
  exports: Export[] = [];
  tag = PACKAGE_FILE_TAG;

  static read(reader: AssetReader, ver: UEVersion, uasset: UAsset): UExp {
    const uexp = new UExp();

    for (const exp of uasset.exportMap) {
      const relativeOffset = exp.serialOffset - BigInt(uasset.fileSize);
      reader.position = bigint.toNumber(relativeOffset);

      const className = uasset.resolveObjectName(exp.classIndex);

      if (TextureExport.isTextureClass(className)) {
        uexp.exports.push(TextureExport.read(reader, ver, className, uasset.dataResourceMap));
      } else {
        uexp.exports.push(RawExport.read(reader, exp.serialSize));
      }
    }

    if (reader.remaining !== 4) {
      reader.throwFormatError(
        `.uexp has ${reader.remaining} bytes after its exports; expected a 4-byte package tag`,
      );
    }

    uexp.tag = reader.readUint32();
    if (uexp.tag !== PACKAGE_FILE_TAG) {
      reader.throwFormatError(
        `.uexp has invalid package tag: expected ${fmt.hex(PACKAGE_FILE_TAG)} ` +
        `but got ${fmt.hex(uexp.tag)}`,
      );
    }

    return uexp;
  }

  withExport(index: number, replacement: Export): UExp {
    if (!Number.isInteger(index) || index < 0 || index >= this.exports.length) {
      throw new RangeError(`Export index ${index} is out of range.`);
    }

    const result = new UExp();
    result.exports = this.exports.slice();
    result.exports[index] = replacement;
    result.tag = this.tag;
    return result;
  }

  /** Write this .uexp, update the data resource, and return the total size of the exports */
  write(writer: AssetWriter, ver: UEVersion, dataResources: ObjectDataResource[]): number {
    const exportsStart = writer.position;

    for (const exp of this.exports) {
      if (exp.kind === "texture") {
        exp.write(writer, ver, dataResources);
      } else {
        exp.write(writer);
      }
    }

    const exportDataSize = writer.position - exportsStart;
    writer.writeUint32(this.tag);
    return exportDataSize;
  }
}

export class RawExport {
  readonly kind = "raw" as const;

  data: Uint8Array<ArrayBufferLike> = new Uint8Array();

  write(writer: AssetWriter): void {
    writer.writeBytes(this.data);
  }

  static read(reader: AssetReader, size: bigint): RawExport {
    const raw = new RawExport();
    raw.data = reader.readBytes(bigint.toNumber(size));
    return raw;
  }
}

export class TextureExport {
  readonly kind = "texture" as const;

  private static readonly TEXTURE_CLASSES = [
    "Texture2D",
    "TextureCube",
    "LightMapTexture2D",
    "ShadowMapTexture2D",
    "Texture2DArray",
    "TextureCubeArray",
    "VolumeTexture",
  ];

  readonly className: string;

  properties: Uint8Array<ArrayBufferLike> = new Uint8Array();
  serializeMipData = true;
  pixelFormatName = new MinimalName(0, 0);
  skipOffset = 0n;
  placeholder: Uint8Array<ArrayBufferLike> = new Uint8Array();
  importedWidth = 0;
  importedHeight = 0;
  packedData = 0;
  pixelFormat = "";
  firstMipToSerialize = 0;
  mipCount = 0;
  mips: Mip[] = [];
  isVirtual = false;
  virtualTextureData: VirtualTextureBuiltData | null = null;
  noneName = new MinimalName(0, 0);
  lightMapFlags = 0;

  constructor(className: string) {
    this.className = className;
  }

  static read(
    reader: AssetReader,
    ver: UEVersion,
    className: string,
    dataResources: ObjectDataResource[],
  ): TextureExport {
    const texture = new TextureExport(className);

    texture.properties = TextureExport.readProperties(reader);

    if (ver >= UEVersion.UE5_3 && texture.is2D) {
      texture.serializeMipData = reader.readBoolean32();
    }

    texture.pixelFormatName = MinimalName.read(reader);
    texture.skipOffset = reader.readBigInt64();
    texture.placeholder = reader.readBytes(16);
    texture.importedWidth = reader.readInt32();
    texture.importedHeight = reader.readInt32();
    texture.packedData = reader.readUint32();
    texture.pixelFormat = reader.readFString();
    // TODO: OptData
    // TODO: CpuCopy (5.4+)
    texture.firstMipToSerialize = reader.readInt32();
    texture.mipCount = reader.readInt32();
    texture.mips = reader.readArray(texture.mipCount, r => Mip.read(r, dataResources));

    texture.isVirtual = reader.readBoolean32();
    if (texture.isVirtual) {
      texture.virtualTextureData = VirtualTextureBuiltData.read(reader);
    }

    texture.noneName = MinimalName.read(reader);

    if (texture.isLightMap) {
      texture.lightMapFlags = reader.readUint32();
    }

    // TODO: Pass in export size and log if not everything has been read?

    return texture;
  }

  write(writer: AssetWriter, ver: UEVersion, dataResources: ObjectDataResource[]) {
    writer.writeBytes(this.properties);

    if (ver >= UEVersion.UE5_3 && this.is2D) {
      writer.writeBoolean32(this.serializeMipData);
    }

    this.pixelFormatName.write(writer);
    const skipPosition = writer.position;
    writer.writeBigInt64(0n);
    writer.writeBytes(this.placeholder);
    writer.writeInt32(this.importedWidth);
    writer.writeInt32(this.importedHeight);
    writer.writeUint32(this.packedData);
    writer.writeAnsiString(this.pixelFormat);
    // TODO: OptData
    // TODO: CpuCopy (5.4+)
    writer.writeInt32(this.firstMipToSerialize);
    writer.writeInt32(this.mips.length);

    for (const mip of this.mips) {
      mip.write(writer, dataResources);
    }

    writer.writeBoolean32(this.isVirtual);
    if (this.isVirtual) {
      if (this.virtualTextureData === null) {
        throw new Error("Virtual texture export is missing its built data.");
      }
      this.virtualTextureData.write(writer);
    }
    const nonePosition = writer.position;
    this.noneName.write(writer);

    if (this.isLightMap) {
      writer.writeUint32(this.lightMapFlags);
    }

    writer.patchBigInt64(skipPosition, BigInt(nonePosition - skipPosition));
  }

  resolvePixelFormat(): string {
    return this.virtualTextureData?.layerTypes[0] ?? this.pixelFormat;
  }

  get sliceCount(): number {
    return this.packedData & 0x3fff_ffff;
  }

  get isLightMap(): boolean {
    return this.className.includes("LightMap");
  }

  get isCube(): boolean {
    return this.className.includes("Cube");
  }

  get is3D(): boolean {
    return this.className.includes("Volume");
  }

  get isArray(): boolean {
    return this.className.includes("Array");
  }

  get is2D(): boolean {
    return !(this.isCube || this.isArray || this.is3D);
  }

  clone(): TextureExport {
    const copy = new TextureExport(this.className);
    copy.properties = this.properties.slice();
    copy.serializeMipData = this.serializeMipData;
    copy.pixelFormatName = this.pixelFormatName;
    copy.skipOffset = this.skipOffset;
    copy.placeholder = this.placeholder.slice();
    copy.importedWidth = this.importedWidth;
    copy.importedHeight = this.importedHeight;
    copy.packedData = this.packedData;
    copy.pixelFormat = this.pixelFormat;
    copy.firstMipToSerialize = this.firstMipToSerialize;
    copy.mipCount = this.mipCount;
    copy.mips = this.mips.map(mip => mip.clone());
    copy.isVirtual = this.isVirtual;
    copy.virtualTextureData = this.virtualTextureData?.clone() ?? null;
    copy.noneName = this.noneName;
    copy.lightMapFlags = this.lightMapFlags;
    return copy;
  }

  static isTextureClass(className: string): boolean {
    return TextureExport.TEXTURE_CLASSES.includes(className);
  }

  private static readProperties(reader: AssetReader): Uint8Array {
    const startOffset = reader.position;
    const errorOffset = Math.min(reader.length - 7, startOffset + 1000);

    // Search and skip to \x01\x00\x01\x00\x01\x00\x00\x00.
    // \x01\x00 is StripFlags for UTexture
    // \x01\x00 is StripFlags for UTexture2D (or Cube)
    // \x01\x00\x00\x00 is bCooked for UTexture2D (or Cube)
    //
    // Just searching \x01 is not the best algorithm but fast enough.
    // Because "found 01" means "found strip flags" for most texture assets.

    while (true) {
      let byte = reader.readUint8();
      while (byte !== 0x01 && byte !== 0x05) {
        if (reader.position >= errorOffset) {
          reader.throwFormatError("failed to find strip flags within search range");
        }

        byte = reader.readUint8();
      }

      const buffer = reader.readBytes(7);

      // The default value of StripFlags is five from UE5.4.
      // \x01: 00 01 00 01 00 00 00 | \x05: 00 05 00 01 00 00 00
      if (
        buffer[0] === 0x00 &&
        buffer[2] === 0x00 &&
        buffer[3] === 0x01 &&
        buffer[4] === 0x00 &&
        buffer[5] === 0x00 &&
        buffer[6] === 0x00 &&
        (
          (byte === 0x01 && buffer[1] === 0x01) ||
          (byte === 0x05 && buffer[1] === 0x05)
        )
      ) {
        break;
      }

      reader.position -= 7;
    }

    const propertiesSize = reader.position - startOffset;
    reader.position = startOffset;
    return reader.readBytes(propertiesSize);
  }
}

export type Export = RawExport | TextureExport;

export class Mip {
  dataResourceIndex = 0;
  inlineData: Uint8Array<ArrayBufferLike> = new Uint8Array();
  width = 0;
  height = 0;
  depth = 0;

  clone(): Mip {
    const copy = new Mip();
    copy.dataResourceIndex = this.dataResourceIndex;
    copy.inlineData = this.inlineData.slice();
    copy.width = this.width;
    copy.height = this.height;
    copy.depth = this.depth;
    return copy;
  }

  /** Serialize this mip and update its associated data resource if needed */
  write(writer: AssetWriter, dataResources: ObjectDataResource[]) {
    const dataResource = dataResources[this.dataResourceIndex];
    if (dataResource === undefined) {
      throw new Error(`Mip data resource index ${this.dataResourceIndex} is out of range.`);
    }

    writer.writeInt32(this.dataResourceIndex);

    if (dataResource.bulkType === BulkType.Uexp) {
      dataResource.serialOffset = BigInt(writer.position);
      writer.writeBytes(this.inlineData);
    }

    writer.writeUint32(this.width);
    writer.writeUint32(this.height);
    writer.writeUint32(this.depth);
  }

  static read(reader: AssetReader, dataResources: ObjectDataResource[]): Mip {
    const mip = new Mip();

    mip.dataResourceIndex = reader.readInt32();
    const dataResource = dataResources[mip.dataResourceIndex];

    if (dataResource === undefined) {
      reader.throwFormatError(`mip data resource index ${mip.dataResourceIndex} is out of range`);
    }

    if (dataResource.bulkType === BulkType.Uexp) {
      mip.inlineData = reader.readBytes(bigint.toNumber(dataResource.serialSize));
    }

    mip.width = reader.readUint32();
    mip.height = reader.readUint32();
    mip.depth = reader.readUint32();

    return mip;
  }
}
