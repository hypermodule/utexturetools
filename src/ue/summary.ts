import {AssetReader} from "./asset-reader.ts";
import {AssetWriter} from "./asset-writer.ts";
import {CustomVersion, UEVersion, EngineVersion, GenerationInfo} from "./versioning.ts";
import type {Guid} from "./guid.ts";
import {fmt} from "../util.ts";

export const PACKAGE_FILE_TAG = 0x9e2a83c1;

export class PackageFileSummary {
  tag = 0; // u32

  legacyFileVersion = 0; // i32
  fileVersionUE3 = 0; // i32
  fileVersionUE4 = 0; // i32
  fileVersionUE5 = 0; // i32
  fileVersionLicenseeUE = 0; // i32
  customVersions: CustomVersion[] = [];

  savedHash: Uint8Array<ArrayBufferLike> = new Uint8Array();
  totalHeaderSize = 0; // i32

  packageName = "";
  packageFlags: EPackageFlags = 0; // u32

  nameCount = 0; // i32
  nameOffset = 0; // i32

  softObjectPathsCount = 0; // i32
  softObjectPathsOffset = 0; // i32

  // localizationId?: string; // Not written when PKG_FilterEditorOnly is set:

  gatherableTextDataCount = 0; // i32
  gatherableTextDataOffset = 0; // i32

  exportCount = 0; // i32
  exportOffset = 0; // i32

  importCount = 0; // i32
  importOffset = 0; // i32

  cellExportCount = 0; // i32
  cellExportOffset = 0; // i32

  cellImportCount = 0; // i32
  cellImportOffset = 0; // i32

  metaDataOffset = 0; // i32
  dependsOffset = 0; // i32

  softPackageReferencesCount = 0; // i32
  softPackageReferencesOffset = 0; // i32

  searchableNamesOffset = 0; // i32
  thumbnailTableOffset = 0; // i32

  importTypeHierarchiesCount = 0; // i32
  importTypeHierarchiesOffset = 0; // i32

  guid: Guid = {a: 0, b: 0, c: 0, d: 0};

  generations: GenerationInfo[] = [];

  savedByEngineVersion: EngineVersion | null = null;
  compatibleWithEngineVersion: EngineVersion | null = null;

  compressionFlags = 0; // i32
  compressedChunksCount = 0; // i32

  packageSource = 0; // i32
  additionalPackagesToCook: string[] = [];

  assetRegistryDataOffset = 0; // i32
  bulkDataStartOffset = 0n; // i64
  worldTileInfoDataOffset = 0; // i32
  chunkIds: number[] = [];

  preloadDependencyCount = 0; // i32
  preloadDependencyOffset = 0; // i32

  namesReferencedFromExportDataCount = 0; // i32
  payloadTocOffset = 0n; // i64
  dataResourceOffset = 0; // i32

  static read(reader: AssetReader, ver: UEVersion): PackageFileSummary {
    const currentLegacyFileVersion = -9;

    const summary = new PackageFileSummary();

    summary.tag = reader.readUint32();
    if (summary.tag !== PACKAGE_FILE_TAG) {
      reader.throwFormatError(
        `.uasset has invalid magic: expected ${fmt.hex(PACKAGE_FILE_TAG)} ` +
        `but got ${fmt.hex(summary.tag)}`
      );
    }

    summary.legacyFileVersion = reader.readInt32();
    if (summary.legacyFileVersion < currentLegacyFileVersion || summary.legacyFileVersion >= 0) {
      reader.throwFormatError(`unsupported legacy file version: ${summary.legacyFileVersion}`);
    }

    if (summary.legacyFileVersion !== -4) {
      summary.fileVersionUE3 = reader.readInt32();
    }

    summary.fileVersionUE4 = reader.readInt32();

    if (summary.legacyFileVersion <= -8) {
      summary.fileVersionUE5 = reader.readInt32();
    }

    summary.fileVersionLicenseeUE = reader.readInt32();

    if (ver >= UEVersion.UE5_6) {
      summary.savedHash = reader.readBytes(20);
      summary.totalHeaderSize = reader.readInt32();
    }

    summary.customVersions = reader.readLengthPrefixedArray(CustomVersion.read, CustomVersion.SIZE);

    if (ver < UEVersion.UE5_6) {
      summary.totalHeaderSize = reader.readInt32();
    }

    summary.packageName = reader.readFString();
    summary.packageFlags = reader.readUint32() as EPackageFlags;

    if ((summary.packageFlags & EPackageFlags.PKG_Cooked) === 0) {
      reader.throwFormatError("uncooked assets are not supported");
    }

    // TODO: Add support for PKG_FilterEditorOnly?
    if ((summary.packageFlags & EPackageFlags.PKG_FilterEditorOnly) === 0) {
      reader.throwFormatError("assets with editor-only data are not supported");
    }

    summary.nameCount = reader.readInt32();
    summary.nameOffset = reader.readInt32();

    // Since UE 5.1
    summary.softObjectPathsCount = reader.readInt32();
    summary.softObjectPathsOffset = reader.readInt32();

    // TODO: LocalizationId can be written here when editor-only data is not filtered out.

    summary.gatherableTextDataCount = reader.readInt32();
    summary.gatherableTextDataOffset = reader.readInt32();

    summary.exportCount = reader.readInt32();
    summary.exportOffset = reader.readInt32();

    summary.importCount = reader.readInt32();
    summary.importOffset = reader.readInt32();

    if (ver >= UEVersion.UE5_6) {
      summary.cellExportCount = reader.readInt32();
      summary.cellExportOffset = reader.readInt32();

      summary.cellImportCount = reader.readInt32();
      summary.cellImportOffset = reader.readInt32();

      summary.metaDataOffset = reader.readInt32();
    }

    summary.dependsOffset = reader.readInt32();

    // Since UE 4.15
    summary.softPackageReferencesCount = reader.readInt32();
    summary.softPackageReferencesOffset = reader.readInt32();
    summary.searchableNamesOffset = reader.readInt32();

    summary.thumbnailTableOffset = reader.readInt32();

    if (ver >= UEVersion.UE5_7) {
      summary.importTypeHierarchiesCount = reader.readInt32();
      summary.importTypeHierarchiesOffset = reader.readInt32();
    }

    if (ver < UEVersion.UE5_6) {
      summary.guid = reader.readGuid();
    }

    // TODO: PersistentGuid can be written here when editor-only data is not filtered out.

    summary.generations = reader.readLengthPrefixedArray(GenerationInfo.read, GenerationInfo.SIZE);

    summary.savedByEngineVersion = EngineVersion.read(reader);

    // Since UE 4.8
    summary.compatibleWithEngineVersion = EngineVersion.read(reader);

    summary.compressionFlags = reader.readInt32();
    summary.compressedChunksCount = reader.readInt32();

    if (summary.compressedChunksCount !== 0) {
      reader.throwFormatError("compressed chunks are not supported");
    }

    summary.packageSource = reader.readInt32();

    summary.additionalPackagesToCook = reader.readLengthPrefixedArray(r => r.readFString());

    summary.assetRegistryDataOffset = reader.readInt32();
    summary.bulkDataStartOffset = reader.readBigInt64();
    summary.worldTileInfoDataOffset = reader.readInt32();

    summary.chunkIds = reader.readLengthPrefixedArray(r => r.readInt32(), 4);

    summary.preloadDependencyCount = reader.readInt32();
    summary.preloadDependencyOffset = reader.readInt32();

    // Since UE 5.0
    summary.namesReferencedFromExportDataCount = reader.readInt32();

    summary.payloadTocOffset = reader.readBigInt64();

    // Since UE 5.2
    summary.dataResourceOffset = reader.readInt32();

    return summary;
  }

  write(writer: AssetWriter, ver: UEVersion): void {
    writer.writeUint32(this.tag);
    writer.writeInt32(this.legacyFileVersion);

    if (this.legacyFileVersion !== -4) {
      writer.writeInt32(this.fileVersionUE3);
    }

    writer.writeInt32(this.fileVersionUE4);

    if (this.legacyFileVersion <= -8) {
      writer.writeInt32(this.fileVersionUE5);
    }

    writer.writeInt32(this.fileVersionLicenseeUE);

    if (ver >= UEVersion.UE5_6) {
      if (this.savedHash.byteLength !== 20) {
        throw new RangeError(`Saved hash must contain 20 bytes, got ${this.savedHash.byteLength}`);
      }

      writer.writeBytes(this.savedHash);
      writer.writeInt32(this.totalHeaderSize);
    }

    writer.writeInt32(this.customVersions.length);
    for (const customVersion of this.customVersions) {
      customVersion.write(writer);
    }

    if (ver < UEVersion.UE5_6) {
      writer.writeInt32(this.totalHeaderSize);
    }

    writer.writeFString(this.packageName);
    writer.writeUint32(this.packageFlags);

    writer.writeInt32(this.nameCount);
    writer.writeInt32(this.nameOffset);

    writer.writeInt32(this.softObjectPathsCount);
    writer.writeInt32(this.softObjectPathsOffset);

    writer.writeInt32(this.gatherableTextDataCount);
    writer.writeInt32(this.gatherableTextDataOffset);

    writer.writeInt32(this.exportCount);
    writer.writeInt32(this.exportOffset);

    writer.writeInt32(this.importCount);
    writer.writeInt32(this.importOffset);

    if (ver >= UEVersion.UE5_6) {
      writer.writeInt32(this.cellExportCount);
      writer.writeInt32(this.cellExportOffset);

      writer.writeInt32(this.cellImportCount);
      writer.writeInt32(this.cellImportOffset);

      writer.writeInt32(this.metaDataOffset);
    }

    writer.writeInt32(this.dependsOffset);

    writer.writeInt32(this.softPackageReferencesCount);
    writer.writeInt32(this.softPackageReferencesOffset);
    writer.writeInt32(this.searchableNamesOffset);

    writer.writeInt32(this.thumbnailTableOffset);

    if (ver >= UEVersion.UE5_7) {
      writer.writeInt32(this.importTypeHierarchiesCount);
      writer.writeInt32(this.importTypeHierarchiesOffset);
    }

    if (ver < UEVersion.UE5_6) {
      writer.writeUint32(this.guid.a);
      writer.writeUint32(this.guid.b);
      writer.writeUint32(this.guid.c);
      writer.writeUint32(this.guid.d);
    }

    writer.writeInt32(this.generations.length);
    for (const generation of this.generations) {
      generation.write(writer);
    }

    if (this.savedByEngineVersion === null) {
      throw new Error("Saved-by engine version is not set");
    }
    this.savedByEngineVersion.write(writer);

    if (this.compatibleWithEngineVersion === null) {
      throw new Error("Compatible engine version is not set");
    }
    this.compatibleWithEngineVersion.write(writer);

    writer.writeInt32(this.compressionFlags);
    writer.writeInt32(this.compressedChunksCount);

    writer.writeInt32(this.packageSource);

    writer.writeInt32(this.additionalPackagesToCook.length);
    for (const packageName of this.additionalPackagesToCook) {
      writer.writeFString(packageName);
    }

    writer.writeInt32(this.assetRegistryDataOffset);
    writer.writeBigInt64(this.bulkDataStartOffset);
    writer.writeInt32(this.worldTileInfoDataOffset);

    writer.writeInt32(this.chunkIds.length);
    for (const chunkId of this.chunkIds) {
      writer.writeInt32(chunkId);
    }

    writer.writeInt32(this.preloadDependencyCount);
    writer.writeInt32(this.preloadDependencyOffset);

    writer.writeInt32(this.namesReferencedFromExportDataCount);

    writer.writeBigInt64(this.payloadTocOffset);

    writer.writeInt32(this.dataResourceOffset);
  }
}

export const EPackageFlags = {
  PKG_None: 0x00000000,
  PKG_Cooked: 0x00000200,
  PKG_UnversionedProperties: 0x00002000,
  PKG_FilterEditorOnly: 0x80000000,
} as const;
export type EPackageFlags = (typeof EPackageFlags)[keyof typeof EPackageFlags];
