import {AssetReader} from "./asset-reader.ts";
import {AssetWriter} from "./asset-writer.ts";
import {EPackageFlags, PackageFileSummary} from "./summary.ts";
import {UEVersion} from "./versioning.ts";
import {bigint} from "../util.ts";

export class UAsset {
  summary = new PackageFileSummary();
  nameMap: NameEntrySerialized[] = [];
  importMap: ObjectImport[] = [];
  exportMap: ObjectExport[] = [];
  dependsMap: number[][] = [];
  assetObjectDataCount = 0; // i32
  preloadDependencies: number[] = [];
  dataResourceVersion: ObjectDataResourceVersion = ObjectDataResourceVersion.Invalid; // u32
  dataResourceMap: ObjectDataResource[] = [];
  appendedNullBytes = 0; // Not serialized

  // Not serialized
  fileSize = 0; // Not serialized

  static read(reader: AssetReader, ver: UEVersion): UAsset {
    // Derived from CUE4Parse (see NOTICE.txt for license)

    const asset = new UAsset();

    asset.summary = PackageFileSummary.read(reader, ver);

    // NameMap
    reader.position = asset.summary.nameOffset;
    asset.nameMap = reader.readArray(asset.summary.nameCount, NameEntrySerialized.read);

    // ImportMap
    reader.position = asset.summary.importOffset;
    asset.importMap = reader.readArray(asset.summary.importCount, ObjectImport.read);

    // ExportMap
    reader.position = asset.summary.exportOffset;
    asset.exportMap = reader.readArray(
      asset.summary.exportCount,
      r => ObjectExport.read(r, ver, asset.summary.packageFlags),
    );

    // DependsMap
    if (asset.summary.dependsOffset > 0 && asset.summary.exportCount > 0) {
      reader.position = asset.summary.dependsOffset;

      for (let i = 0; i < asset.summary.exportCount; i++) {
        asset.dependsMap.push(reader.readLengthPrefixedArray(r => r.readInt32(), 4));
      }
    }

    // AssetRegistryData
    if (asset.summary.assetRegistryDataOffset > 0) {
      reader.position = asset.summary.assetRegistryDataOffset;

      asset.assetObjectDataCount = reader.readInt32();
      if (asset.assetObjectDataCount !== 0) {
        reader.throwFormatError(
          `expected asset object data count to be zero, got ${asset.assetObjectDataCount}`,
        );
      }
    }

    // PreloadDependencies
    if (asset.summary.preloadDependencyCount > 0 && asset.summary.preloadDependencyOffset > 0) {
      reader.position = asset.summary.preloadDependencyOffset;

      asset.preloadDependencies = reader.readArray(
        asset.summary.preloadDependencyCount,
        r => r.readInt32(),
      );
    }

    // Since only cooked assets are supported, there are no SoftObjectPaths to read.

    // DataResourceMap
    if (asset.summary.dataResourceOffset > 0) {
      reader.position = asset.summary.dataResourceOffset;
      asset.dataResourceVersion = reader.readUint32() as ObjectDataResourceVersion;
      asset.dataResourceMap = reader.readLengthPrefixedArray(
        r => ObjectDataResource.read(r, asset.dataResourceVersion),
      );
    }

    // retoc can insert null padding at the end of the .uasset file
    if (asset.exportMap.length > 0) {
      const paddingLength = asset.exportMap[0].serialOffset - BigInt(reader.position);
      const paddingBytes = reader.readBytes(bigint.toNumber(paddingLength));
      if (paddingBytes.some(byte => byte !== 0)) {
        reader.throwFormatError("Encountered unexpected non-null data at end of .uasset file");
      }

      asset.appendedNullBytes = paddingBytes.byteLength;

      if (reader.remaining !== 0) {
        reader.throwFormatError("Encountered unexpected data after the end of the .uasset file");
      }
    }

    asset.fileSize = reader.length;

    return asset;
  }

  write(writer: AssetWriter, ver: UEVersion): void {
    this.summary.write(writer, ver);

    // NameMap
    this.summary.nameOffset = writer.position;
    for (const name of this.nameMap) {
      name.write(writer);
    }

    // Since only cooked assets are supported, there are no SoftObjectPaths to write.
    if (this.summary.softObjectPathsOffset > 0) {
      this.summary.softObjectPathsOffset = writer.position;
    }

    // ImportMap
    this.summary.importOffset = writer.position;
    for (const imp of this.importMap) {
      imp.write(writer);
    }

    // ExportMap
    this.summary.exportOffset = writer.position;
    for (const exp of this.exportMap) {
      exp.write(writer, ver, this.summary.packageFlags);
    }

    if (ver >= UEVersion.UE5_6) {
      this.summary.cellImportOffset = writer.position;
      this.summary.cellExportOffset = writer.position;
    }

    // DependsMap
    if (this.summary.dependsOffset > 0 && this.summary.exportCount > 0) {
      this.summary.dependsOffset = writer.position;
      for (const dependencies of this.dependsMap) {
        writer.writeInt32(dependencies.length);
        for (const dependency of dependencies) {
          writer.writeInt32(dependency);
        }
      }
    }

    // AssetRegistryData
    if (this.summary.assetRegistryDataOffset > 0) {
      this.summary.assetRegistryDataOffset = writer.position;
      if (this.assetObjectDataCount !== 0) {
        throw new Error("AssetRegistryData is not supported");
      }

      writer.writeInt32(this.assetObjectDataCount);
    }

    // PreloadDependencies
    if (this.summary.preloadDependencyCount > 0 && this.summary.preloadDependencyOffset > 0) {
      this.summary.preloadDependencyOffset = writer.position;
      for (const dependency of this.preloadDependencies) {
        writer.writeInt32(dependency);
      }
    }

    // DataResourceMap
    if (this.summary.dataResourceOffset > 0) {
      this.summary.dataResourceOffset = writer.position;
      writer.writeUint32(this.dataResourceVersion);
      writer.writeInt32(this.dataResourceMap.length);
      for (const resource of this.dataResourceMap) {
        resource.write(writer, this.dataResourceVersion);
      }
    }

    // retoc can insert null padding at the end of the .uasset file
    writer.writeBytes(new Uint8Array(this.appendedNullBytes));

    const endPosition = writer.position;
    this.summary.totalHeaderSize = endPosition;

    // Rewind and write summary again now that offsets are known
    writer.position = 0;
    this.summary.write(writer, ver);

    writer.position = endPosition;
  }

  resolveName(name: MinimalName): string {
    const index = name.nameMapIndex;

    if (0 <= index && index < this.nameMap.length) {
      return this.nameMap[index].name;
    }

    throw new RangeError(`NameMap index ${index} out of range`);
  }

  resolveObjectName(packageIndex: number): string {
    if (packageIndex < 0 && -packageIndex - 1 < this.importMap.length) {
      return this.resolveName(this.importMap[-packageIndex - 1].objectName);
    }

    if (packageIndex > 0 && packageIndex - 1 < this.exportMap.length) {
      return this.resolveName(this.exportMap[packageIndex - 1].objectName);
    }

    throw new RangeError(`Package index ${packageIndex} is out of range`);
  }

  assertHasDataResourceTable(): void {
    if (
      this.dataResourceVersion === ObjectDataResourceVersion.Invalid ||
      this.summary.dataResourceOffset <= 0
    ) {
      throw new Error("The .uasset does not contain a data resource table");
    }
  }

  /** Return an updated model containing a newly serialized single export and its resources. */
  withExportData(dataResources: readonly ObjectDataResource[], exportSize: number): UAsset {
    this.assertHasDataResourceTable();

    if (this.exportMap.length !== 1) {
      throw new Error("Rewriting .uasset files with multiple exports is not supported yet");
    }

    if (!Number.isSafeInteger(exportSize) || exportSize < 0) {
      throw new RangeError(`Invalid serialized export size: ${exportSize}.`);
    }

    const resourceSize = ObjectDataResource.size(this.dataResourceVersion);
    const headerSize = this.summary.dataResourceOffset + 4 * 2 +
      dataResources.length * resourceSize + this.appendedNullBytes;
    if (!Number.isSafeInteger(headerSize)) {
      throw new RangeError(`Invalid serialized header size: ${headerSize}.`);
    }

    const headerSizeBigInt = BigInt(headerSize);
    const result = Object.assign(new UAsset(), this);
    result.summary = Object.assign(new PackageFileSummary(), this.summary);
    result.summary.totalHeaderSize = headerSize;
    result.summary.bulkDataStartOffset = headerSizeBigInt + BigInt(exportSize);

    result.exportMap = this.exportMap.map(exp => Object.assign(new ObjectExport(), exp));
    result.exportMap[0].serialSize = BigInt(exportSize);
    result.exportMap[0].serialOffset = headerSizeBigInt;

    result.dataResourceMap = dataResources.map(resource => resource.clone());
    result.fileSize = headerSize;

    return result;
  }
}

export class NameEntrySerialized {
  readonly name: string;
  readonly hashes: number; // u32

  constructor(name: string, hashes: number) {
    this.name = name;
    this.hashes = hashes;
  }

  static read(reader: AssetReader): NameEntrySerialized {
    const name = reader.readFString();
    const hashes = reader.readUint32();

    return new NameEntrySerialized(name, hashes);
  }

  write(writer: AssetWriter): void {
    writer.writeFString(this.name);
    writer.writeUint32(this.hashes);
  }

  toString(): string {
    return this.name;
  }
}

export class MinimalName {
  readonly nameMapIndex: number; // i32
  readonly number: number; // i32

  constructor(nameMapIndex: number, number: number) {
    this.nameMapIndex = nameMapIndex;
    this.number = number;
  }

  static read(reader: AssetReader): MinimalName {
    const nameMapIndex = reader.readInt32();
    const number = reader.readInt32();

    return new MinimalName(nameMapIndex, number);
  }

  write(writer: AssetWriter): void {
    writer.writeInt32(this.nameMapIndex);
    writer.writeInt32(this.number);
  }
}

export class ObjectImport {
  classPackage = new MinimalName(0, 0);
  className = new MinimalName(0, 0);
  outerIndex = 0; // i32
  objectName = new MinimalName(0, 0);
  importOptional = false; // bool32

  static read(reader: AssetReader): ObjectImport {
    const imp = new ObjectImport();

    imp.classPackage = MinimalName.read(reader);
    imp.className = MinimalName.read(reader);
    imp.outerIndex = reader.readInt32();
    imp.objectName = MinimalName.read(reader);
    imp.importOptional = reader.readBoolean32();

    return imp;
  }

  write(writer: AssetWriter): void {
    this.classPackage.write(writer);
    this.className.write(writer);
    writer.writeInt32(this.outerIndex);
    this.objectName.write(writer);
    writer.writeBoolean32(this.importOptional);
  }
}

export class ObjectExport {
  classIndex = 0; // i32
  superIndex = 0; // i32
  templateIndex = 0; // i32
  outerIndex = 0; // i32

  objectName = new MinimalName(0, 0);
  objectFlags = 0; // u32

  serialSize = 0n; // i64
  serialOffset = 0n; // i64

  forcedExport = false; // bool32
  notForClient = false; // bool32
  notForServer = false; // bool32
  // packageGuid was removed in UE 5.1
  isInheritedInstance = false; // bool32

  packageFlags = 0; // u32

  notAlwaysLoadedForEditorGame = false; // bool32
  isAsset = false; // bool32
  generatePublicHash = false; // bool32

  firstExportDependency = 0; // i32
  serializationBeforeSerializationDependencies = 0; // i32
  createBeforeSerializationDependencies = 0; // i32
  serializationBeforeCreateDependencies = 0; // i32
  createBeforeCreateDependencies = 0; // i32

  // Since UE 5.4
  scriptSerializationStartOffset = 0n; // i64
  scriptSerializationEndOffset = 0n; // i64

  write(writer: AssetWriter, ver: UEVersion, packageFlags: EPackageFlags): void {
    writer.writeInt32(this.classIndex);
    writer.writeInt32(this.superIndex);
    writer.writeInt32(this.templateIndex);
    writer.writeInt32(this.outerIndex);

    this.objectName.write(writer);
    writer.writeUint32(this.objectFlags);

    writer.writeBigInt64(this.serialSize);
    writer.writeBigInt64(this.serialOffset);

    writer.writeBoolean32(this.forcedExport);
    writer.writeBoolean32(this.notForClient);
    writer.writeBoolean32(this.notForServer);
    writer.writeBoolean32(this.isInheritedInstance);

    writer.writeUint32(this.packageFlags);

    writer.writeBoolean32(this.notAlwaysLoadedForEditorGame);
    writer.writeBoolean32(this.isAsset);
    writer.writeBoolean32(this.generatePublicHash);

    writer.writeInt32(this.firstExportDependency);
    writer.writeInt32(this.serializationBeforeSerializationDependencies);
    writer.writeInt32(this.createBeforeSerializationDependencies);
    writer.writeInt32(this.serializationBeforeCreateDependencies);
    writer.writeInt32(this.createBeforeCreateDependencies);

    if ((packageFlags & EPackageFlags.PKG_UnversionedProperties) === 0 && ver >= UEVersion.UE5_4) {
      writer.writeBigInt64(this.scriptSerializationStartOffset);
      writer.writeBigInt64(this.scriptSerializationEndOffset);
    }
  }

  static read(reader: AssetReader, ver: UEVersion, packageFlags: EPackageFlags): ObjectExport {
    const exp = new ObjectExport();

    exp.classIndex = reader.readInt32();
    exp.superIndex = reader.readInt32();
    exp.templateIndex = reader.readInt32();
    exp.outerIndex = reader.readInt32();

    exp.objectName = MinimalName.read(reader);
    exp.objectFlags = reader.readUint32();

    exp.serialSize = reader.readBigInt64();
    exp.serialOffset = reader.readBigInt64();

    exp.forcedExport = reader.readBoolean32();
    exp.notForClient = reader.readBoolean32();
    exp.notForServer = reader.readBoolean32();
    exp.isInheritedInstance = reader.readBoolean32();

    exp.packageFlags = reader.readUint32();

    exp.notAlwaysLoadedForEditorGame = reader.readBoolean32();
    exp.isAsset = reader.readBoolean32();
    exp.generatePublicHash = reader.readBoolean32();

    exp.firstExportDependency = reader.readInt32();
    exp.serializationBeforeSerializationDependencies = reader.readInt32();
    exp.createBeforeSerializationDependencies = reader.readInt32();
    exp.serializationBeforeCreateDependencies = reader.readInt32();
    exp.createBeforeCreateDependencies = reader.readInt32();

    if ((packageFlags & EPackageFlags.PKG_UnversionedProperties) === 0 && ver >= UEVersion.UE5_4) {
      exp.scriptSerializationStartOffset = reader.readBigInt64();
      exp.scriptSerializationEndOffset = reader.readBigInt64();
    }

    return exp;
  }
}

export const ObjectDataResourceVersion = {
  Invalid: 0,
  Initial: 1,
  AddedCookedIndex: 2,
} as const;
export type ObjectDataResourceVersion =
  (typeof ObjectDataResourceVersion)[keyof typeof ObjectDataResourceVersion];

export class ObjectDataResource {
  flags = 0; // u32
  cookedIndex = 0; // u8
  serialOffset = 0n; // i64
  duplicateSerialOffset = 0n; // i64
  serialSize = 0n; // i64
  rawSize = 0n; // i64
  outerIndex = 0; // i32
  bulkDataFlags: BulkDataFlags = BulkDataFlags.None; // u32

  static read(reader: AssetReader, version: ObjectDataResourceVersion): ObjectDataResource {
    const res = new ObjectDataResource();

    res.flags = reader.readUint32();

    if (version >= ObjectDataResourceVersion.AddedCookedIndex) {
      res.cookedIndex = reader.readUint8();
    }

    res.serialOffset = reader.readBigInt64();
    res.duplicateSerialOffset = reader.readBigInt64();
    res.serialSize = reader.readBigInt64();
    res.rawSize = reader.readBigInt64();
    res.outerIndex = reader.readInt32();
    res.bulkDataFlags = reader.readUint32() as BulkDataFlags;

    return res;
  }

  static size(version: ObjectDataResourceVersion): number {
    return 4 +
      (version >= ObjectDataResourceVersion.AddedCookedIndex ? 1 : 0) +
      8 * 4 +
      4 * 2;
  }

  get bulkType(): BulkType {
    if ((this.bulkDataFlags & BulkDataFlags.ForceInlinePayload) !== 0) {
      return BulkType.Uexp;
    }

    if ((this.bulkDataFlags & BulkDataFlags.Unused) !== 0) {
      return BulkType.None;
    }

    if ((this.bulkDataFlags & BulkDataFlags.OptionalPayload) !== 0) {
      return BulkType.Uptnl;
    }

    return BulkType.Ubulk;
  }

  clone(): ObjectDataResource {
    const copy = new ObjectDataResource();
    copy.flags = this.flags;
    copy.cookedIndex = this.cookedIndex;
    copy.serialOffset = this.serialOffset;
    copy.duplicateSerialOffset = this.duplicateSerialOffset;
    copy.serialSize = this.serialSize;
    copy.rawSize = this.rawSize;
    copy.outerIndex = this.outerIndex;
    copy.bulkDataFlags = this.bulkDataFlags;
    return copy;
  }

  write(writer: AssetWriter, version: ObjectDataResourceVersion): void {
    writer.writeUint32(this.flags);

    if (version >= ObjectDataResourceVersion.AddedCookedIndex) {
      writer.writeUint8(this.cookedIndex);
    }

    writer.writeBigInt64(this.serialOffset);
    writer.writeBigInt64(this.duplicateSerialOffset);
    writer.writeBigInt64(this.serialSize);
    writer.writeBigInt64(this.rawSize);
    writer.writeInt32(this.outerIndex);
    writer.writeUint32(this.bulkDataFlags);
  }
}

export const BulkType = {
  Unknown: 0,
  Uexp: 1,
  Ubulk: 2,
  Uptnl: 3,
  None: 4,
} as const;
export type BulkType = (typeof BulkType)[keyof typeof BulkType];

export const BulkDataFlags = {
  None: 0,
  PayloadAtEndOfFile: 1 << 0,
  SerializeCompressedZLIB: 1 << 1,
  ForceSingleElementSerialization: 1 << 2,
  SingleUse: 1 << 3,
  CompressedLZO: 1 << 4,
  Unused: 1 << 5,
  ForceInlinePayload: 1 << 6,
  ForceStreamPayload: 1 << 7,
  PayloadInSeperateFile: 1 << 8,
  SerializeCompressedBitWindow: 1 << 9,
  Force_NOT_InlinePayload: 1 << 10,
  OptionalPayload: 1 << 11,
  MemoryMappedPayload: 1 << 12,
  Size64Bit: 1 << 13,
  DuplicateNonOptionalPayload: 1 << 14,
  BadDataVersion: 1 << 15,
  NoOffsetFixUp: 1 << 16,
  WorkspaceDomainPayload: 1 << 17,
  LazyLoadable: 1 << 18,
  DataIsMemoryMapped: 1 << 30,
  HasAsyncReadPending: 1 << 29,
  AlwaysAllowDiscard: 1 << 28,
} as const;
export type BulkDataFlags = (typeof BulkDataFlags)[keyof typeof BulkDataFlags];
