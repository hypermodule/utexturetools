import {AssetReader} from "./asset-reader.ts";
import {AssetWriter} from "./asset-writer.ts";
import type {Guid} from "./guid.ts";

export const UEVersion = {
  UE5_0: 500_000,
  UE5_1: 501_000,
  UE5_2: 502_000,
  UE5_3: 503_000,
  UE5_4: 504_000,
  UE5_5: 505_000,
  UE5_6: 506_000,
  UE5_7: 507_000,
} as const;

export type UEVersion = (typeof UEVersion)[keyof typeof UEVersion];

export class EngineVersion {
  public readonly major: number;
  public readonly minor: number;
  public readonly patch: number;
  public readonly changeList: number;
  public readonly branch: string;

  constructor(major: number, minor: number, patch: number, changeList: number, branch: string) {
    this.branch = branch;
    this.changeList = changeList;
    this.patch = patch;
    this.minor = minor;
    this.major = major;
  }

  static read(reader: AssetReader): EngineVersion {
    const major = reader.readUint16();
    const minor = reader.readUint16();
    const patch = reader.readUint16();
    const changeList = reader.readUint32();
    const branch = reader.readFString();

    return new EngineVersion(
      major,
      minor,
      patch,
      changeList,
      branch,
    );
  }

  write(writer: AssetWriter): void {
    writer.writeUint16(this.major);
    writer.writeUint16(this.minor);
    writer.writeUint16(this.patch);
    writer.writeUint32(this.changeList);
    writer.writeFString(this.branch);
  }
}

export class CustomVersion {
  static readonly SIZE = 16 + 4;

  public readonly key: Guid;
  public readonly version: number;

  constructor(key: Guid, version: number) {
    this.version = version;
    this.key = key;
  }

  static read(reader: AssetReader): CustomVersion {
    const key = reader.readGuid();
    const version = reader.readInt32();

    return new CustomVersion(key, version);
  }

  write(writer: AssetWriter): void {
    writer.writeUint32(this.key.a);
    writer.writeUint32(this.key.b);
    writer.writeUint32(this.key.c);
    writer.writeUint32(this.key.d);
    writer.writeInt32(this.version);
  }
}

export class GenerationInfo {
  static readonly SIZE = 4 * 2;

  public readonly exportCount: number;

  public readonly nameCount: number;

  constructor(exportCount: number, nameCount: number) {
    this.nameCount = nameCount;
    this.exportCount = exportCount;
  }

  static read(reader: AssetReader): GenerationInfo {
    const exportCount = reader.readInt32();
    const nameCount = reader.readInt32();

    return new GenerationInfo(exportCount, nameCount);
  }

  write(writer: AssetWriter): void {
    writer.writeInt32(this.exportCount);
    writer.writeInt32(this.nameCount);
  }
}
