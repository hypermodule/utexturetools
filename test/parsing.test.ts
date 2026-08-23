import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

import {AssetReader} from "../src/ue/asset-reader.ts";
import {EngineVersion, UEVersion} from "../src/ue/versioning.ts";
import {EPackageFlags} from "../src/ue/summary.ts";
import {
  BulkDataFlags,
  BulkType,
  MinimalName,
  ObjectDataResourceVersion,
  UAsset,
} from "../src/ue/uasset.ts";
import {Mip, UExp} from "../src/ue/uexp.ts";
import {EVirtualTextureCodec, VirtualTextureTileOffsetData} from "../src/ue/vt.ts";

const expectedUbulkDataFlags = (
  BulkDataFlags.PayloadAtEndOfFile |
  BulkDataFlags.PayloadInSeperateFile |
  BulkDataFlags.Force_NOT_InlinePayload |
  BulkDataFlags.NoOffsetFixUp
) >>> 0;

const expectedUexpDataFlags = (
  BulkDataFlags.SingleUse |
  BulkDataFlags.ForceInlinePayload
) >>> 0;

test("UE5_2__Texture2D_BC1", async () => {
  const version = UEVersion.UE5_2;

  // ======== .uasset ========
  const uassetPath = "./assets/ue5_2/T_Blocks_1K_BC1_BC.uasset";
  const uassetBytes = await readFile(new URL(uassetPath, import.meta.url));
  const reader = new AssetReader(uassetBytes);
  const uasset = UAsset.read(reader, version);

  assert.strictEqual(uasset.fileSize, uassetBytes.length);
  assert.strictEqual(uasset.fileSize, 1174);

  // PackageFileSummary
  const summary = uasset.summary;

  assert.strictEqual(summary.tag, 0x9e2a83c1);
  assert.strictEqual(summary.legacyFileVersion, -8);

  assert.strictEqual(summary.fileVersionUE3, 0);
  assert.strictEqual(summary.fileVersionUE4, 0);
  assert.strictEqual(summary.fileVersionUE5, 0);
  assert.strictEqual(summary.fileVersionLicenseeUE, 0);
  assert.deepStrictEqual(summary.customVersions, []);

  assert.deepStrictEqual(summary.savedHash, new Uint8Array());
  assert.strictEqual(summary.totalHeaderSize, 1174);

  assert.strictEqual(summary.packageName, "/Game/Textures/T_Blocks_1K_BC1_BC");

  const expectedFlags = (
    EPackageFlags.PKG_Cooked |
    EPackageFlags.PKG_UnversionedProperties |
    EPackageFlags.PKG_FilterEditorOnly
  ) >>> 0;
  assert.strictEqual(summary.packageFlags, expectedFlags);

  assert.strictEqual(summary.nameCount, 10);
  assert.strictEqual(summary.nameOffset, 250);

  assert.strictEqual(summary.softObjectPathsCount, 0);
  assert.strictEqual(summary.softObjectPathsOffset, 474);

  assert.strictEqual(summary.gatherableTextDataCount, 0);
  assert.strictEqual(summary.gatherableTextDataOffset, 0);

  assert.strictEqual(summary.exportCount, 1);
  assert.strictEqual(summary.exportOffset, 570);

  assert.strictEqual(summary.importCount, 3);
  assert.strictEqual(summary.importOffset, 474);

  assert.strictEqual(summary.cellExportCount, 0);
  assert.strictEqual(summary.cellExportOffset, 0);
  assert.strictEqual(summary.cellImportCount, 0);
  assert.strictEqual(summary.cellImportOffset, 0);

  assert.strictEqual(summary.metaDataOffset, 0);
  assert.strictEqual(summary.dependsOffset, 666);

  assert.strictEqual(summary.softPackageReferencesCount, 0);
  assert.strictEqual(summary.softPackageReferencesOffset, 0);

  assert.strictEqual(summary.searchableNamesOffset, 0);
  assert.strictEqual(summary.thumbnailTableOffset, 0);

  assert.strictEqual(summary.importTypeHierarchiesCount, 0);
  assert.strictEqual(summary.importTypeHierarchiesOffset, 0);

  assert.deepStrictEqual(summary.guid, {
    a: 2103254287,
    b: 91834682,
    c: 2147607271,
    d: 3420507784,
  });

  assert.strictEqual(summary.generations.length, 1);
  const generation = summary.generations[0];
  assert.strictEqual(generation.exportCount, 1);
  assert.strictEqual(generation.nameCount, 10);

  const emptyEngine = new EngineVersion(0, 0, 0, 0, "");
  assert.deepStrictEqual(summary.savedByEngineVersion, emptyEngine);
  assert.deepStrictEqual(summary.compatibleWithEngineVersion, emptyEngine);

  assert.strictEqual(summary.compressionFlags, 0);
  assert.strictEqual(summary.compressedChunksCount, 0);

  assert.strictEqual(summary.packageSource, 1400756568);

  assert.deepStrictEqual(summary.additionalPackagesToCook, []);

  assert.strictEqual(summary.assetRegistryDataOffset, 670);
  assert.strictEqual(summary.bulkDataStartOffset, 4208n);
  assert.strictEqual(summary.worldTileInfoDataOffset, 0);
  assert.deepStrictEqual(summary.chunkIds, []);

  assert.strictEqual(summary.preloadDependencyCount, 2);
  assert.strictEqual(summary.preloadDependencyOffset, 674);

  assert.strictEqual(summary.namesReferencedFromExportDataCount, 2);
  assert.strictEqual(summary.payloadTocOffset, -1n);

  assert.strictEqual(summary.dataResourceOffset, 682);

  // NameMap
  const expectedNames = [
    "None",
    "PF_DXT1",
    "/Game/Textures/T_Blocks_1K_BC1_BC",
    "/Script/CoreUObject",
    "/Script/Engine",
    "Class",
    "Default__Texture2D",
    "Package",
    "T_Blocks_1K_BC1_BC",
    "Texture2D",
  ];
  assert.deepStrictEqual(uasset.nameMap.map(x => x.name), expectedNames);

  // ImportMap
  assert.strictEqual(uasset.importMap.length, 3);

  assert.deepStrictEqual(uasset.importMap[0].classPackage, new MinimalName(3, 0));
  assert.deepStrictEqual(uasset.importMap[0].className, new MinimalName(5, 0));
  assert.strictEqual(uasset.importMap[0].outerIndex, -2);
  assert.deepStrictEqual(uasset.importMap[0].objectName, new MinimalName(9, 0));
  assert.strictEqual(uasset.importMap[0].importOptional, false);

  assert.deepStrictEqual(uasset.importMap[1].classPackage, new MinimalName(3, 0));
  assert.deepStrictEqual(uasset.importMap[1].className, new MinimalName(7, 0));
  assert.strictEqual(uasset.importMap[1].outerIndex, 0);
  assert.deepStrictEqual(uasset.importMap[1].objectName, new MinimalName(4, 0));
  assert.strictEqual(uasset.importMap[1].importOptional, false);

  assert.deepStrictEqual(uasset.importMap[2].classPackage, new MinimalName(4, 0));
  assert.deepStrictEqual(uasset.importMap[2].className, new MinimalName(9, 0));
  assert.strictEqual(uasset.importMap[2].outerIndex, -2);
  assert.deepStrictEqual(uasset.importMap[2].objectName, new MinimalName(6, 0));
  assert.strictEqual(uasset.importMap[2].importOptional, false);

  // ExportMap
  assert.strictEqual(uasset.exportMap.length, 1);

  const exportObject = uasset.exportMap[0];
  assert.strictEqual(exportObject.classIndex, -1);
  assert.strictEqual(exportObject.superIndex, 0);
  assert.strictEqual(exportObject.templateIndex, -3);
  assert.strictEqual(exportObject.outerIndex, 0);
  assert.deepStrictEqual(exportObject.objectName, new MinimalName(8, 0));
  assert.strictEqual(exportObject.objectFlags, 3);
  assert.strictEqual(exportObject.serialSize, 3034n);
  assert.strictEqual(exportObject.serialOffset, 1174n);
  assert.strictEqual(exportObject.forcedExport, false);
  assert.strictEqual(exportObject.notForClient, false);
  assert.strictEqual(exportObject.notForServer, false);
  assert.strictEqual(exportObject.isInheritedInstance, false);
  assert.strictEqual(exportObject.packageFlags, 0);
  assert.strictEqual(exportObject.notAlwaysLoadedForEditorGame, true);
  assert.strictEqual(exportObject.isAsset, true);
  assert.strictEqual(exportObject.generatePublicHash, false);
  assert.strictEqual(exportObject.firstExportDependency, 0);
  assert.strictEqual(exportObject.serializationBeforeSerializationDependencies, 0);
  assert.strictEqual(exportObject.createBeforeSerializationDependencies, 0);
  assert.strictEqual(exportObject.serializationBeforeCreateDependencies, 2);
  assert.strictEqual(exportObject.createBeforeCreateDependencies, 0);

  // Script serialization offsets are not serialized for unversioned properties
  assert.strictEqual(exportObject.scriptSerializationStartOffset, 0n);
  assert.strictEqual(exportObject.scriptSerializationEndOffset, 0n);

  // DependsMap
  assert.deepStrictEqual(uasset.dependsMap, [[]]);

  // PreloadDependencies
  assert.deepStrictEqual(uasset.preloadDependencies, [-1, -3]);

  // DataResourceMap
  const expectedDataResources = [
    {serialOffset: 0n, serialSize: 524288n, rawSize: 524288n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialOffset: 524288n, serialSize: 131072n, rawSize: 131072n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialOffset: 655360n, serialSize: 32768n, rawSize: 32768n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialOffset: 688128n, serialSize: 8192n, rawSize: 8192n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialOffset: 170n, serialSize: 2048n, rawSize: 2048n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2234n, serialSize: 512n, rawSize: 512n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2762n, serialSize: 128n, rawSize: 128n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2906n, serialSize: 32n, rawSize: 32n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2954n, serialSize: 8n, rawSize: 8n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2978n, serialSize: 8n, rawSize: 8n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 3002n, serialSize: 8n, rawSize: 8n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
  ];

  assert.strictEqual(uasset.dataResourceVersion, 1);
  assert.strictEqual(uasset.dataResourceMap.length, expectedDataResources.length);
  for (let i = 0; i < expectedDataResources.length; i++) {
    const actual = uasset.dataResourceMap[i];
    const expected = expectedDataResources[i];

    assert.strictEqual(actual.flags, 0);
    assert.strictEqual(actual.cookedIndex, 0);
    assert.strictEqual(actual.serialOffset, expected.serialOffset);
    assert.strictEqual(actual.duplicateSerialOffset, -1n);
    assert.strictEqual(actual.serialSize, expected.serialSize);
    assert.strictEqual(actual.rawSize, expected.rawSize);
    assert.strictEqual(actual.outerIndex, 1);
    assert.strictEqual(actual.bulkDataFlags, expected.bulkDataFlags);
    assert.strictEqual(actual.bulkType, expected.bulkType);
  }

  // ======== .uexp ========
  const uexpPath = uassetPath.replace(".uasset", ".uexp");
  const uexpBytes = await readFile(new URL(uexpPath, import.meta.url));
  const uexpReader = new AssetReader(uexpBytes);
  const uexp = UExp.read(uexpReader, version, uasset);

  assert.strictEqual(uexp.exports.length, 1);
  const tex = uexp.exports[0];
  assert.strictEqual(tex.kind, "texture");

  assert.strictEqual(tex.serializeMipData, true);
  assert.deepStrictEqual(tex.pixelFormatName, new MinimalName(1, 0));
  assert.strictEqual(tex.skipOffset, 2980n);
  assert.strictEqual(tex.importedWidth, 1024);
  assert.strictEqual(tex.importedHeight, 1024);
  assert.strictEqual(tex.packedData, 1);
  assert.strictEqual(tex.pixelFormat, "PF_DXT1");
  assert.strictEqual(tex.firstMipToSerialize, 0);
  assert.strictEqual(tex.mipCount, 11);

  const expectedMips = [
    {inlineDataLength: 0, width: 1024, height: 1024},
    {inlineDataLength: 0, width: 512, height: 512},
    {inlineDataLength: 0, width: 256, height: 256},
    {inlineDataLength: 0, width: 128, height: 128},
    {inlineDataLength: 2048, width: 64, height: 64},
    {inlineDataLength: 512, width: 32, height: 32},
    {inlineDataLength: 128, width: 16, height: 16},
    {inlineDataLength: 32, width: 8, height: 8},
    {inlineDataLength: 8, width: 4, height: 4},
    {inlineDataLength: 8, width: 2, height: 2},
    {inlineDataLength: 8, width: 1, height: 1},
  ];

  assert.strictEqual(tex.mips.length, expectedMips.length);
  for (let i = 0; i < expectedMips.length; i++) {
    const mip: Mip = tex.mips[i]!;
    const expected = expectedMips[i];

    assert.strictEqual(mip.dataResourceIndex, i);
    assert.strictEqual(mip.inlineData.length, expected.inlineDataLength);
    assert.strictEqual(mip.width, expected.width);
    assert.strictEqual(mip.height, expected.height);
    assert.strictEqual(mip.depth, 1);
  }

  assert.strictEqual(tex.isVirtual, false);

  assert.deepStrictEqual(tex.noneName, new MinimalName(0, 0));
});

test("UE5_3__Texture2D_BC1", async () => {
  const version = UEVersion.UE5_3;

  // ======== .uasset ========
  const uassetPath = "./assets/ue5_3/T_Blocks2_1K_BC1_BC.uasset";
  const uassetBytes = await readFile(new URL(uassetPath, import.meta.url));
  const reader = new AssetReader(uassetBytes);
  const uasset = UAsset.read(reader, version);

  assert.strictEqual(uasset.fileSize, uassetBytes.length);
  assert.strictEqual(uasset.fileSize, 1177);

  // PackageFileSummary
  const summary = uasset.summary;

  assert.strictEqual(summary.tag, 0x9e2a83c1);
  assert.strictEqual(summary.legacyFileVersion, -8);

  assert.strictEqual(summary.fileVersionUE3, 0);
  assert.strictEqual(summary.fileVersionUE4, 0);
  assert.strictEqual(summary.fileVersionUE5, 0);
  assert.strictEqual(summary.fileVersionLicenseeUE, 0);
  assert.deepStrictEqual(summary.customVersions, []);

  assert.deepStrictEqual(summary.savedHash, new Uint8Array());
  assert.strictEqual(summary.totalHeaderSize, 1177);

  assert.strictEqual(summary.packageName, "/Game/Textures/T_Blocks2_1K_BC1_BC");

  const expectedFlags = (
    EPackageFlags.PKG_Cooked |
    EPackageFlags.PKG_UnversionedProperties |
    EPackageFlags.PKG_FilterEditorOnly
  ) >>> 0;
  assert.strictEqual(summary.packageFlags, expectedFlags);

  assert.strictEqual(summary.nameCount, 10);
  assert.strictEqual(summary.nameOffset, 251);

  assert.strictEqual(summary.softObjectPathsCount, 0);
  assert.strictEqual(summary.softObjectPathsOffset, 477);

  assert.strictEqual(summary.gatherableTextDataCount, 0);
  assert.strictEqual(summary.gatherableTextDataOffset, 0);

  assert.strictEqual(summary.exportCount, 1);
  assert.strictEqual(summary.exportOffset, 573);

  assert.strictEqual(summary.importCount, 3);
  assert.strictEqual(summary.importOffset, 477);

  assert.strictEqual(summary.cellExportCount, 0);
  assert.strictEqual(summary.cellExportOffset, 0);
  assert.strictEqual(summary.cellImportCount, 0);
  assert.strictEqual(summary.cellImportOffset, 0);

  assert.strictEqual(summary.metaDataOffset, 0);
  assert.strictEqual(summary.dependsOffset, 669);

  assert.strictEqual(summary.softPackageReferencesCount, 0);
  assert.strictEqual(summary.softPackageReferencesOffset, 0);

  assert.strictEqual(summary.searchableNamesOffset, 0);
  assert.strictEqual(summary.thumbnailTableOffset, 0);

  assert.strictEqual(summary.importTypeHierarchiesCount, 0);
  assert.strictEqual(summary.importTypeHierarchiesOffset, 0);

  assert.deepStrictEqual(summary.guid, {
    a: 3072418273,
    b: 3250079270,
    c: 2989889866,
    d: 1812165198,
  });

  assert.strictEqual(summary.generations.length, 1);
  const generation = summary.generations[0];
  assert.strictEqual(generation.exportCount, 1);
  assert.strictEqual(generation.nameCount, 10);

  const emptyEngine = new EngineVersion(0, 0, 0, 0, "");
  assert.deepStrictEqual(summary.savedByEngineVersion, emptyEngine);
  assert.deepStrictEqual(summary.compatibleWithEngineVersion, emptyEngine);

  assert.strictEqual(summary.compressionFlags, 0);
  assert.strictEqual(summary.compressedChunksCount, 0);

  assert.strictEqual(summary.packageSource, -980866167);

  assert.deepStrictEqual(summary.additionalPackagesToCook, []);

  assert.strictEqual(summary.assetRegistryDataOffset, 673);
  assert.strictEqual(summary.bulkDataStartOffset, 4215n);
  assert.strictEqual(summary.worldTileInfoDataOffset, 0);
  assert.deepStrictEqual(summary.chunkIds, []);

  assert.strictEqual(summary.preloadDependencyCount, 2);
  assert.strictEqual(summary.preloadDependencyOffset, 677);

  assert.strictEqual(summary.namesReferencedFromExportDataCount, 2);
  assert.strictEqual(summary.payloadTocOffset, -1n);

  assert.strictEqual(summary.dataResourceOffset, 685);

  // NameMap
  const expectedNames = [
    "None",
    "PF_DXT1",
    "/Game/Textures/T_Blocks2_1K_BC1_BC",
    "/Script/CoreUObject",
    "/Script/Engine",
    "Class",
    "Default__Texture2D",
    "Package",
    "T_Blocks2_1K_BC1_BC",
    "Texture2D",
  ];
  assert.deepStrictEqual(uasset.nameMap.map(x => x.name), expectedNames);
  // Name entry hashes are not included in the .uasset fixture's decoded values.

  // ImportMap
  assert.strictEqual(uasset.importMap.length, 3);

  assert.deepStrictEqual(uasset.importMap[0].classPackage, new MinimalName(3, 0));
  assert.deepStrictEqual(uasset.importMap[0].className, new MinimalName(5, 0));
  assert.strictEqual(uasset.importMap[0].outerIndex, -2);
  assert.deepStrictEqual(uasset.importMap[0].objectName, new MinimalName(9, 0));
  assert.strictEqual(uasset.importMap[0].importOptional, false);

  assert.deepStrictEqual(uasset.importMap[1].classPackage, new MinimalName(3, 0));
  assert.deepStrictEqual(uasset.importMap[1].className, new MinimalName(7, 0));
  assert.strictEqual(uasset.importMap[1].outerIndex, 0);
  assert.deepStrictEqual(uasset.importMap[1].objectName, new MinimalName(4, 0));
  assert.strictEqual(uasset.importMap[1].importOptional, false);

  assert.deepStrictEqual(uasset.importMap[2].classPackage, new MinimalName(4, 0));
  assert.deepStrictEqual(uasset.importMap[2].className, new MinimalName(9, 0));
  assert.strictEqual(uasset.importMap[2].outerIndex, -2);
  assert.deepStrictEqual(uasset.importMap[2].objectName, new MinimalName(6, 0));
  assert.strictEqual(uasset.importMap[2].importOptional, false);

  // ExportMap
  assert.strictEqual(uasset.exportMap.length, 1);

  const exportObject = uasset.exportMap[0];
  assert.strictEqual(exportObject.classIndex, -1);
  assert.strictEqual(exportObject.superIndex, 0);
  assert.strictEqual(exportObject.templateIndex, -3);
  assert.strictEqual(exportObject.outerIndex, 0);
  assert.deepStrictEqual(exportObject.objectName, new MinimalName(8, 0));
  assert.strictEqual(exportObject.objectFlags, 3);
  assert.strictEqual(exportObject.serialSize, 3038n);
  assert.strictEqual(exportObject.serialOffset, 1177n);
  assert.strictEqual(exportObject.forcedExport, false);
  assert.strictEqual(exportObject.notForClient, false);
  assert.strictEqual(exportObject.notForServer, false);
  assert.strictEqual(exportObject.isInheritedInstance, false);
  assert.strictEqual(exportObject.packageFlags, 0);
  assert.strictEqual(exportObject.notAlwaysLoadedForEditorGame, true);
  assert.strictEqual(exportObject.isAsset, true);
  assert.strictEqual(exportObject.generatePublicHash, false);
  assert.strictEqual(exportObject.firstExportDependency, 0);
  assert.strictEqual(exportObject.serializationBeforeSerializationDependencies, 0);
  assert.strictEqual(exportObject.createBeforeSerializationDependencies, 0);
  assert.strictEqual(exportObject.serializationBeforeCreateDependencies, 2);
  assert.strictEqual(exportObject.createBeforeCreateDependencies, 0);

  assert.strictEqual(exportObject.scriptSerializationStartOffset, 0n);
  assert.strictEqual(exportObject.scriptSerializationEndOffset, 0n);

  // DependsMap
  assert.deepStrictEqual(uasset.dependsMap, [[]]);

  // PreloadDependencies
  assert.deepStrictEqual(uasset.preloadDependencies, [-1, -3]);

  // DataResourceMap
  const expectedDataResources = [
    {serialOffset: 0n, serialSize: 524288n, rawSize: 524288n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialOffset: 524288n, serialSize: 131072n, rawSize: 131072n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialOffset: 655360n, serialSize: 32768n, rawSize: 32768n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialOffset: 688128n, serialSize: 8192n, rawSize: 8192n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialOffset: 174n, serialSize: 2048n, rawSize: 2048n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2238n, serialSize: 512n, rawSize: 512n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2766n, serialSize: 128n, rawSize: 128n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2910n, serialSize: 32n, rawSize: 32n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2958n, serialSize: 8n, rawSize: 8n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2982n, serialSize: 8n, rawSize: 8n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 3006n, serialSize: 8n, rawSize: 8n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
  ];

  assert.strictEqual(uasset.dataResourceVersion, ObjectDataResourceVersion.Initial);
  assert.strictEqual(uasset.dataResourceMap.length, expectedDataResources.length);
  for (let i = 0; i < expectedDataResources.length; i++) {
    const actual = uasset.dataResourceMap[i];
    const expected = expectedDataResources[i];

    assert.strictEqual(actual.flags, 0);
    assert.strictEqual(actual.cookedIndex, 0);
    assert.strictEqual(actual.serialOffset, expected.serialOffset);
    assert.strictEqual(actual.duplicateSerialOffset, -1n);
    assert.strictEqual(actual.serialSize, expected.serialSize);
    assert.strictEqual(actual.rawSize, expected.rawSize);
    assert.strictEqual(actual.outerIndex, 1);
    assert.strictEqual(actual.bulkDataFlags, expected.bulkDataFlags);
    assert.strictEqual(actual.bulkType, expected.bulkType);
  }

  // ======== .uexp ========
  const uexpPath = uassetPath.replace(".uasset", ".uexp");
  const uexpBytes = await readFile(new URL(uexpPath, import.meta.url));
  const uexpReader = new AssetReader(uexpBytes);
  const uexp = UExp.read(uexpReader, version, uasset);

  assert.strictEqual(uexp.exports.length, 1);
  const tex = uexp.exports[0];
  assert.strictEqual(tex.kind, "texture");
  assert.strictEqual(tex.className, "Texture2D");

  assert.strictEqual(tex.serializeMipData, true);
  assert.deepStrictEqual(tex.pixelFormatName, new MinimalName(1, 0));
  assert.strictEqual(tex.skipOffset, 2980n);
  assert.strictEqual(tex.importedWidth, 1024);
  assert.strictEqual(tex.importedHeight, 1024);
  assert.strictEqual(tex.packedData, 1);
  assert.strictEqual(tex.pixelFormat, "PF_DXT1");
  assert.strictEqual(tex.firstMipToSerialize, 0);
  assert.strictEqual(tex.mipCount, 11);

  const expectedMips = [
    {inlineDataLength: 0, width: 1024, height: 1024},
    {inlineDataLength: 0, width: 512, height: 512},
    {inlineDataLength: 0, width: 256, height: 256},
    {inlineDataLength: 0, width: 128, height: 128},
    {inlineDataLength: 2048, width: 64, height: 64},
    {inlineDataLength: 512, width: 32, height: 32},
    {inlineDataLength: 128, width: 16, height: 16},
    {inlineDataLength: 32, width: 8, height: 8},
    {inlineDataLength: 8, width: 4, height: 4},
    {inlineDataLength: 8, width: 2, height: 2},
    {inlineDataLength: 8, width: 1, height: 1},
  ];

  assert.strictEqual(tex.mips.length, expectedMips.length);
  for (let i = 0; i < expectedMips.length; i++) {
    const mip: Mip = tex.mips[i]!;
    const expected = expectedMips[i];

    assert.strictEqual(mip.dataResourceIndex, i);
    assert.strictEqual(mip.inlineData.length, expected.inlineDataLength);
    assert.strictEqual(mip.width, expected.width);
    assert.strictEqual(mip.height, expected.height);
    assert.strictEqual(mip.depth, 1);
  }

  assert.strictEqual(tex.isVirtual, false);

  assert.deepStrictEqual(tex.noneName, new MinimalName(0, 0));
});

test("UE5_4__Texture2D_B8G8R8A8", async () => {
  const version = UEVersion.UE5_4;

  // ======== .uasset ========
  const uassetPath = "./assets/ue5_4/T_Blocky_1K_B8G8R8A8_BC.uasset";
  const uassetBytes = await readFile(new URL(uassetPath, import.meta.url));
  const reader = new AssetReader(uassetBytes);
  const uasset = UAsset.read(reader, version);

  assert.strictEqual(uasset.fileSize, uassetBytes.length);
  assert.strictEqual(uasset.fileSize, 1193);

  // PackageFileSummary
  const summary = uasset.summary;

  assert.strictEqual(summary.tag, 0x9e2a83c1);
  assert.strictEqual(summary.legacyFileVersion, -8);

  assert.strictEqual(summary.fileVersionUE3, 0);
  assert.strictEqual(summary.fileVersionUE4, 0);
  assert.strictEqual(summary.fileVersionUE5, 0);
  assert.strictEqual(summary.fileVersionLicenseeUE, 0);
  assert.deepStrictEqual(summary.customVersions, []);

  assert.deepStrictEqual(summary.savedHash, new Uint8Array());
  assert.strictEqual(summary.totalHeaderSize, 1193);

  assert.strictEqual(summary.packageName, "/Game/Textures/T_Blocky_1K_B8G8R8A8_BC");

  const expectedFlags = (
    EPackageFlags.PKG_Cooked |
    EPackageFlags.PKG_UnversionedProperties |
    EPackageFlags.PKG_FilterEditorOnly
  ) >>> 0;
  assert.strictEqual(summary.packageFlags, expectedFlags);

  assert.strictEqual(summary.nameCount, 10);
  assert.strictEqual(summary.nameOffset, 255);

  assert.strictEqual(summary.softObjectPathsCount, 0);
  assert.strictEqual(summary.softObjectPathsOffset, 493);

  assert.strictEqual(summary.gatherableTextDataCount, 0);
  assert.strictEqual(summary.gatherableTextDataOffset, 0);

  assert.strictEqual(summary.exportCount, 1);
  assert.strictEqual(summary.exportOffset, 589);

  assert.strictEqual(summary.importCount, 3);
  assert.strictEqual(summary.importOffset, 493);

  assert.strictEqual(summary.cellExportCount, 0);
  assert.strictEqual(summary.cellExportOffset, 0);
  assert.strictEqual(summary.cellImportCount, 0);
  assert.strictEqual(summary.cellImportOffset, 0);

  assert.strictEqual(summary.metaDataOffset, 0);
  assert.strictEqual(summary.dependsOffset, 685);

  assert.strictEqual(summary.softPackageReferencesCount, 0);
  assert.strictEqual(summary.softPackageReferencesOffset, 0);

  assert.strictEqual(summary.searchableNamesOffset, 0);
  assert.strictEqual(summary.thumbnailTableOffset, 0);

  assert.strictEqual(summary.importTypeHierarchiesCount, 0);
  assert.strictEqual(summary.importTypeHierarchiesOffset, 0);

  assert.deepStrictEqual(summary.guid, {
    a: 1795800455,
    b: 30361359,
    c: 2720667443,
    d: 1831212279,
  });

  assert.strictEqual(summary.generations.length, 1);
  const generation = summary.generations[0];
  assert.strictEqual(generation.exportCount, 1);
  assert.strictEqual(generation.nameCount, 10);

  const emptyEngine = new EngineVersion(0, 0, 0, 0, "");
  assert.deepStrictEqual(summary.savedByEngineVersion, emptyEngine);
  assert.deepStrictEqual(summary.compatibleWithEngineVersion, emptyEngine);

  assert.strictEqual(summary.compressionFlags, 0);
  assert.strictEqual(summary.compressedChunksCount, 0);

  assert.strictEqual(summary.packageSource, 727301009);

  assert.deepStrictEqual(summary.additionalPackagesToCook, []);

  assert.strictEqual(summary.assetRegistryDataOffset, 689);
  assert.strictEqual(summary.bulkDataStartOffset, 23342n);
  assert.strictEqual(summary.worldTileInfoDataOffset, 0);
  assert.deepStrictEqual(summary.chunkIds, []);

  assert.strictEqual(summary.preloadDependencyCount, 2);
  assert.strictEqual(summary.preloadDependencyOffset, 693);

  assert.strictEqual(summary.namesReferencedFromExportDataCount, 2);
  assert.strictEqual(summary.payloadTocOffset, -1n);

  assert.strictEqual(summary.dataResourceOffset, 701);

  // NameMap
  const expectedNames = [
    "None",
    "PF_B8G8R8A8",
    "/Game/Textures/T_Blocky_1K_B8G8R8A8_BC",
    "/Script/CoreUObject",
    "/Script/Engine",
    "Class",
    "Default__Texture2D",
    "Package",
    "T_Blocky_1K_B8G8R8A8_BC",
    "Texture2D",
  ];
  assert.deepStrictEqual(uasset.nameMap.map(x => x.name), expectedNames);

  // ImportMap
  assert.strictEqual(uasset.importMap.length, 3);

  assert.deepStrictEqual(uasset.importMap[0].classPackage, new MinimalName(3, 0));
  assert.deepStrictEqual(uasset.importMap[0].className, new MinimalName(5, 0));
  assert.strictEqual(uasset.importMap[0].outerIndex, -2);
  assert.deepStrictEqual(uasset.importMap[0].objectName, new MinimalName(9, 0));
  assert.strictEqual(uasset.importMap[0].importOptional, false);

  assert.deepStrictEqual(uasset.importMap[1].classPackage, new MinimalName(3, 0));
  assert.deepStrictEqual(uasset.importMap[1].className, new MinimalName(7, 0));
  assert.strictEqual(uasset.importMap[1].outerIndex, 0);
  assert.deepStrictEqual(uasset.importMap[1].objectName, new MinimalName(4, 0));
  assert.strictEqual(uasset.importMap[1].importOptional, false);

  assert.deepStrictEqual(uasset.importMap[2].classPackage, new MinimalName(4, 0));
  assert.deepStrictEqual(uasset.importMap[2].className, new MinimalName(9, 0));
  assert.strictEqual(uasset.importMap[2].outerIndex, -2);
  assert.deepStrictEqual(uasset.importMap[2].objectName, new MinimalName(6, 0));
  assert.strictEqual(uasset.importMap[2].importOptional, false);

  // ExportMap
  assert.strictEqual(uasset.exportMap.length, 1);

  const exportObject = uasset.exportMap[0];
  assert.strictEqual(exportObject.classIndex, -1);
  assert.strictEqual(exportObject.superIndex, 0);
  assert.strictEqual(exportObject.templateIndex, -3);
  assert.strictEqual(exportObject.outerIndex, 0);
  assert.deepStrictEqual(exportObject.objectName, new MinimalName(8, 0));
  assert.strictEqual(exportObject.objectFlags, 11);
  assert.strictEqual(exportObject.serialSize, 22149n);
  assert.strictEqual(exportObject.serialOffset, 1193n);
  assert.strictEqual(exportObject.forcedExport, false);
  assert.strictEqual(exportObject.notForClient, false);
  assert.strictEqual(exportObject.notForServer, false);
  assert.strictEqual(exportObject.isInheritedInstance, false);
  assert.strictEqual(exportObject.packageFlags, 0);
  assert.strictEqual(exportObject.notAlwaysLoadedForEditorGame, true);
  assert.strictEqual(exportObject.isAsset, true);
  assert.strictEqual(exportObject.generatePublicHash, false);
  assert.strictEqual(exportObject.firstExportDependency, 0);
  assert.strictEqual(exportObject.serializationBeforeSerializationDependencies, 0);
  assert.strictEqual(exportObject.createBeforeSerializationDependencies, 0);
  assert.strictEqual(exportObject.serializationBeforeCreateDependencies, 2);
  assert.strictEqual(exportObject.createBeforeCreateDependencies, 0);

  assert.strictEqual(exportObject.scriptSerializationStartOffset, 0n);
  assert.strictEqual(exportObject.scriptSerializationEndOffset, 0n);

  // DependsMap
  assert.deepStrictEqual(uasset.dependsMap, [[]]);

  // PreloadDependencies
  assert.deepStrictEqual(uasset.preloadDependencies, [-1, -3]);

  // DataResourceMap
  assert.strictEqual(uasset.dataResourceVersion, ObjectDataResourceVersion.Initial);
  assert.strictEqual(uasset.dataResourceMap.length, 11);

  assert.strictEqual(uasset.dataResourceMap[0].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[0].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[0].serialOffset, 0n);
  assert.strictEqual(uasset.dataResourceMap[0].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[0].serialSize, 4194304n);
  assert.strictEqual(uasset.dataResourceMap[0].rawSize, 4194304n);
  assert.strictEqual(uasset.dataResourceMap[0].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[0].bulkDataFlags, expectedUbulkDataFlags);
  assert.strictEqual(uasset.dataResourceMap[0].bulkType, BulkType.Ubulk);

  assert.strictEqual(uasset.dataResourceMap[1].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[1].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[1].serialOffset, 4194304n);
  assert.strictEqual(uasset.dataResourceMap[1].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[1].serialSize, 1048576n);
  assert.strictEqual(uasset.dataResourceMap[1].rawSize, 1048576n);
  assert.strictEqual(uasset.dataResourceMap[1].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[1].bulkDataFlags, expectedUbulkDataFlags);
  assert.strictEqual(uasset.dataResourceMap[1].bulkType, BulkType.Ubulk);

  assert.strictEqual(uasset.dataResourceMap[2].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[2].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[2].serialOffset, 5242880n);
  assert.strictEqual(uasset.dataResourceMap[2].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[2].serialSize, 262144n);
  assert.strictEqual(uasset.dataResourceMap[2].rawSize, 262144n);
  assert.strictEqual(uasset.dataResourceMap[2].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[2].bulkDataFlags, expectedUbulkDataFlags);
  assert.strictEqual(uasset.dataResourceMap[2].bulkType, BulkType.Ubulk);

  assert.strictEqual(uasset.dataResourceMap[3].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[3].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[3].serialOffset, 5505024n);
  assert.strictEqual(uasset.dataResourceMap[3].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[3].serialSize, 65536n);
  assert.strictEqual(uasset.dataResourceMap[3].rawSize, 65536n);
  assert.strictEqual(uasset.dataResourceMap[3].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[3].bulkDataFlags, expectedUbulkDataFlags);
  assert.strictEqual(uasset.dataResourceMap[3].bulkType, BulkType.Ubulk);

  assert.strictEqual(uasset.dataResourceMap[4].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[4].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[4].serialOffset, 185n);
  assert.strictEqual(uasset.dataResourceMap[4].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[4].serialSize, 16384n);
  assert.strictEqual(uasset.dataResourceMap[4].rawSize, 16384n);
  assert.strictEqual(uasset.dataResourceMap[4].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[4].bulkDataFlags, expectedUexpDataFlags);
  assert.strictEqual(uasset.dataResourceMap[4].bulkType, BulkType.Uexp);

  assert.strictEqual(uasset.dataResourceMap[5].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[5].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[5].serialOffset, 16585n);
  assert.strictEqual(uasset.dataResourceMap[5].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[5].serialSize, 4096n);
  assert.strictEqual(uasset.dataResourceMap[5].rawSize, 4096n);
  assert.strictEqual(uasset.dataResourceMap[5].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[5].bulkDataFlags, expectedUexpDataFlags);
  assert.strictEqual(uasset.dataResourceMap[5].bulkType, BulkType.Uexp);

  assert.strictEqual(uasset.dataResourceMap[6].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[6].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[6].serialOffset, 20697n);
  assert.strictEqual(uasset.dataResourceMap[6].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[6].serialSize, 1024n);
  assert.strictEqual(uasset.dataResourceMap[6].rawSize, 1024n);
  assert.strictEqual(uasset.dataResourceMap[6].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[6].bulkDataFlags, expectedUexpDataFlags);
  assert.strictEqual(uasset.dataResourceMap[6].bulkType, BulkType.Uexp);

  assert.strictEqual(uasset.dataResourceMap[7].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[7].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[7].serialOffset, 21737n);
  assert.strictEqual(uasset.dataResourceMap[7].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[7].serialSize, 256n);
  assert.strictEqual(uasset.dataResourceMap[7].rawSize, 256n);
  assert.strictEqual(uasset.dataResourceMap[7].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[7].bulkDataFlags, expectedUexpDataFlags);
  assert.strictEqual(uasset.dataResourceMap[7].bulkType, BulkType.Uexp);

  assert.strictEqual(uasset.dataResourceMap[8].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[8].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[8].serialOffset, 22009n);
  assert.strictEqual(uasset.dataResourceMap[8].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[8].serialSize, 64n);
  assert.strictEqual(uasset.dataResourceMap[8].rawSize, 64n);
  assert.strictEqual(uasset.dataResourceMap[8].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[8].bulkDataFlags, expectedUexpDataFlags);
  assert.strictEqual(uasset.dataResourceMap[8].bulkType, BulkType.Uexp);

  assert.strictEqual(uasset.dataResourceMap[9].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[9].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[9].serialOffset, 22089n);
  assert.strictEqual(uasset.dataResourceMap[9].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[9].serialSize, 16n);
  assert.strictEqual(uasset.dataResourceMap[9].rawSize, 16n);
  assert.strictEqual(uasset.dataResourceMap[9].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[9].bulkDataFlags, expectedUexpDataFlags);
  assert.strictEqual(uasset.dataResourceMap[9].bulkType, BulkType.Uexp);

  assert.strictEqual(uasset.dataResourceMap[10].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[10].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[10].serialOffset, 22121n);
  assert.strictEqual(uasset.dataResourceMap[10].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[10].serialSize, 4n);
  assert.strictEqual(uasset.dataResourceMap[10].rawSize, 4n);
  assert.strictEqual(uasset.dataResourceMap[10].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[10].bulkDataFlags, expectedUexpDataFlags);
  assert.strictEqual(uasset.dataResourceMap[10].bulkType, BulkType.Uexp);

  // ======== .uexp ========
  const uexpPath = uassetPath.replace(".uasset", ".uexp");
  const uexpBytes = await readFile(new URL(uexpPath, import.meta.url));
  const uexpReader = new AssetReader(uexpBytes);
  const uexp = UExp.read(uexpReader, version, uasset);

  assert.strictEqual(uexp.exports.length, 1);
  const tex = uexp.exports[0];
  assert.strictEqual(tex.kind, "texture");

  assert.strictEqual(tex.serializeMipData, true);
  assert.deepStrictEqual(tex.pixelFormatName, new MinimalName(1, 0));
  assert.strictEqual(tex.skipOffset, 22084n);
  assert.strictEqual(tex.importedWidth, 1024);
  assert.strictEqual(tex.importedHeight, 1024);
  assert.strictEqual(tex.packedData, 1);
  assert.strictEqual(tex.pixelFormat, "PF_B8G8R8A8");
  assert.strictEqual(tex.firstMipToSerialize, 0);
  assert.strictEqual(tex.mipCount, 11);

  assert.strictEqual(tex.mips[0].inlineData.length, 0);
  assert.strictEqual(tex.mips[0].width, 1024);
  assert.strictEqual(tex.mips[0].height, 1024);
  assert.strictEqual(tex.mips[0].depth, 1);

  assert.strictEqual(tex.mips[1].inlineData.length, 0);
  assert.strictEqual(tex.mips[1].width, 512);
  assert.strictEqual(tex.mips[1].height, 512);
  assert.strictEqual(tex.mips[1].depth, 1);

  assert.strictEqual(tex.mips[2].inlineData.length, 0);
  assert.strictEqual(tex.mips[2].width, 256);
  assert.strictEqual(tex.mips[2].height, 256);
  assert.strictEqual(tex.mips[2].depth, 1);

  assert.strictEqual(tex.mips[3].inlineData.length, 0);
  assert.strictEqual(tex.mips[3].width, 128);
  assert.strictEqual(tex.mips[3].height, 128);
  assert.strictEqual(tex.mips[3].depth, 1);

  assert.strictEqual(tex.mips[4].inlineData.length, 64 * 64 * 4);
  assert.strictEqual(tex.mips[4].width, 64);
  assert.strictEqual(tex.mips[4].height, 64);
  assert.strictEqual(tex.mips[4].depth, 1);

  assert.strictEqual(tex.mips[5].inlineData.length, 32 * 32 * 4);
  assert.strictEqual(tex.mips[5].width, 32);
  assert.strictEqual(tex.mips[5].height, 32);
  assert.strictEqual(tex.mips[5].depth, 1);

  assert.strictEqual(tex.mips[6].inlineData.length, 16 * 16 * 4);
  assert.strictEqual(tex.mips[6].width, 16);
  assert.strictEqual(tex.mips[6].height, 16);
  assert.strictEqual(tex.mips[6].depth, 1);

  assert.strictEqual(tex.mips[7].inlineData.length, 8 * 8 * 4);
  assert.strictEqual(tex.mips[7].width, 8);
  assert.strictEqual(tex.mips[7].height, 8);
  assert.strictEqual(tex.mips[7].depth, 1);

  assert.strictEqual(tex.mips[8].inlineData.length, 4 * 4 * 4);
  assert.strictEqual(tex.mips[8].width, 4);
  assert.strictEqual(tex.mips[8].height, 4);
  assert.strictEqual(tex.mips[8].depth, 1);

  assert.strictEqual(tex.mips[9].inlineData.length, 2 * 2 * 4);
  assert.strictEqual(tex.mips[9].width, 2);
  assert.strictEqual(tex.mips[9].height, 2);
  assert.strictEqual(tex.mips[9].depth, 1);

  assert.strictEqual(tex.mips[10].inlineData.length, 4);
  assert.strictEqual(tex.mips[10].width, 1);
  assert.strictEqual(tex.mips[10].height, 1);
  assert.strictEqual(tex.mips[10].depth, 1);

  assert.strictEqual(tex.isVirtual, false);

  assert.deepStrictEqual(tex.noneName, new MinimalName(0, 0));
});

test("UE5_4__Texture2D_BC1", async () => {
  const version = UEVersion.UE5_4;

  // ======== .uasset ========
  const uassetPath = "./assets/ue5_4/T_Roof_1K_BC1_BC.uasset";
  const uassetBytes = await readFile(new URL(uassetPath, import.meta.url));
  const reader = new AssetReader(uassetBytes);
  const uasset = UAsset.read(reader, version);

  assert.strictEqual(uasset.fileSize, uassetBytes.length);
  assert.strictEqual(uasset.fileSize, 1168);

  // PackageFileSummary
  const summary = uasset.summary;

  assert.strictEqual(summary.tag, 0x9e2a83c1);
  assert.strictEqual(summary.legacyFileVersion, -8);

  assert.strictEqual(summary.fileVersionUE3, 0);
  assert.strictEqual(summary.fileVersionUE4, 0);
  assert.strictEqual(summary.fileVersionUE5, 0);
  assert.strictEqual(summary.fileVersionLicenseeUE, 0);
  assert.deepStrictEqual(summary.customVersions, []);

  assert.deepStrictEqual(summary.savedHash, new Uint8Array());
  assert.strictEqual(summary.totalHeaderSize, 1168);

  assert.strictEqual(summary.packageName, "/Game/Textures/T_Roof_1K_BC1_BC");

  const expectedFlags = (
    EPackageFlags.PKG_Cooked |
    EPackageFlags.PKG_UnversionedProperties |
    EPackageFlags.PKG_FilterEditorOnly
  ) >>> 0;
  assert.strictEqual(summary.packageFlags, expectedFlags);

  assert.strictEqual(summary.nameCount, 10);
  assert.strictEqual(summary.nameOffset, 248);

  assert.strictEqual(summary.softObjectPathsCount, 0);
  assert.strictEqual(summary.softObjectPathsOffset, 468);

  assert.strictEqual(summary.gatherableTextDataCount, 0);
  assert.strictEqual(summary.gatherableTextDataOffset, 0);

  assert.strictEqual(summary.exportCount, 1);
  assert.strictEqual(summary.exportOffset, 564);

  assert.strictEqual(summary.importCount, 3);
  assert.strictEqual(summary.importOffset, 468);

  assert.strictEqual(summary.cellExportCount, 0);
  assert.strictEqual(summary.cellExportOffset, 0);
  assert.strictEqual(summary.cellImportCount, 0);
  assert.strictEqual(summary.cellImportOffset, 0);

  assert.strictEqual(summary.metaDataOffset, 0);
  assert.strictEqual(summary.dependsOffset, 660);

  assert.strictEqual(summary.softPackageReferencesCount, 0);
  assert.strictEqual(summary.softPackageReferencesOffset, 0);

  assert.strictEqual(summary.searchableNamesOffset, 0);
  assert.strictEqual(summary.thumbnailTableOffset, 0);

  assert.strictEqual(summary.importTypeHierarchiesCount, 0);
  assert.strictEqual(summary.importTypeHierarchiesOffset, 0);

  assert.deepStrictEqual(summary.guid, {
    a: 456564088,
    b: 687622840,
    c: 2385462529,
    d: 2175688790,
  });

  assert.strictEqual(summary.generations.length, 1);
  const generation = summary.generations[0];
  assert.strictEqual(generation.exportCount, 1);
  assert.strictEqual(generation.nameCount, 10);

  const emptyEngine = new EngineVersion(0, 0, 0, 0, "");
  assert.deepStrictEqual(summary.savedByEngineVersion, emptyEngine);
  assert.deepStrictEqual(summary.compatibleWithEngineVersion, emptyEngine);

  assert.strictEqual(summary.compressionFlags, 0);
  assert.strictEqual(summary.compressedChunksCount, 0);

  assert.strictEqual(summary.packageSource, 1068590805);

  assert.deepStrictEqual(summary.additionalPackagesToCook, []);

  assert.strictEqual(summary.assetRegistryDataOffset, 664);
  assert.strictEqual(summary.bulkDataStartOffset, 4210n);
  assert.strictEqual(summary.worldTileInfoDataOffset, 0);
  assert.deepStrictEqual(summary.chunkIds, []);

  assert.strictEqual(summary.preloadDependencyCount, 2);
  assert.strictEqual(summary.preloadDependencyOffset, 668);

  assert.strictEqual(summary.namesReferencedFromExportDataCount, 2);
  assert.strictEqual(summary.payloadTocOffset, -1n);

  assert.strictEqual(summary.dataResourceOffset, 676);

  // NameMap
  const expectedNames = [
    "None",
    "PF_DXT1",
    "/Game/Textures/T_Roof_1K_BC1_BC",
    "/Script/CoreUObject",
    "/Script/Engine",
    "Class",
    "Default__Texture2D",
    "Package",
    "T_Roof_1K_BC1_BC",
    "Texture2D",
  ];
  assert.deepStrictEqual(uasset.nameMap.map(x => x.name), expectedNames);

  // ImportMap
  assert.strictEqual(uasset.importMap.length, 3);

  assert.deepStrictEqual(uasset.importMap[0].classPackage, new MinimalName(3, 0));
  assert.deepStrictEqual(uasset.importMap[0].className, new MinimalName(5, 0));
  assert.strictEqual(uasset.importMap[0].outerIndex, -2);
  assert.deepStrictEqual(uasset.importMap[0].objectName, new MinimalName(9, 0));
  assert.strictEqual(uasset.importMap[0].importOptional, false);

  assert.deepStrictEqual(uasset.importMap[1].classPackage, new MinimalName(3, 0));
  assert.deepStrictEqual(uasset.importMap[1].className, new MinimalName(7, 0));
  assert.strictEqual(uasset.importMap[1].outerIndex, 0);
  assert.deepStrictEqual(uasset.importMap[1].objectName, new MinimalName(4, 0));
  assert.strictEqual(uasset.importMap[1].importOptional, false);

  assert.deepStrictEqual(uasset.importMap[2].classPackage, new MinimalName(4, 0));
  assert.deepStrictEqual(uasset.importMap[2].className, new MinimalName(9, 0));
  assert.strictEqual(uasset.importMap[2].outerIndex, -2);
  assert.deepStrictEqual(uasset.importMap[2].objectName, new MinimalName(6, 0));
  assert.strictEqual(uasset.importMap[2].importOptional, false);

  // ExportMap
  assert.strictEqual(uasset.exportMap.length, 1);

  const exportObject = uasset.exportMap[0];
  assert.strictEqual(exportObject.classIndex, -1);
  assert.strictEqual(exportObject.superIndex, 0);
  assert.strictEqual(exportObject.templateIndex, -3);
  assert.strictEqual(exportObject.outerIndex, 0);
  assert.deepStrictEqual(exportObject.objectName, new MinimalName(8, 0));
  assert.strictEqual(exportObject.objectFlags, 11);
  assert.strictEqual(exportObject.serialSize, 3042n);
  assert.strictEqual(exportObject.serialOffset, 1168n);
  assert.strictEqual(exportObject.forcedExport, false);
  assert.strictEqual(exportObject.notForClient, false);
  assert.strictEqual(exportObject.notForServer, false);
  assert.strictEqual(exportObject.isInheritedInstance, false);
  assert.strictEqual(exportObject.packageFlags, 0);
  assert.strictEqual(exportObject.notAlwaysLoadedForEditorGame, true);
  assert.strictEqual(exportObject.isAsset, true);
  assert.strictEqual(exportObject.generatePublicHash, false);
  assert.strictEqual(exportObject.firstExportDependency, 0);
  assert.strictEqual(exportObject.serializationBeforeSerializationDependencies, 0);
  assert.strictEqual(exportObject.createBeforeSerializationDependencies, 0);
  assert.strictEqual(exportObject.serializationBeforeCreateDependencies, 2);
  assert.strictEqual(exportObject.createBeforeCreateDependencies, 0);

  assert.strictEqual(exportObject.scriptSerializationStartOffset, 0n);
  assert.strictEqual(exportObject.scriptSerializationEndOffset, 0n);

  // DependsMap
  assert.deepStrictEqual(uasset.dependsMap, [[]]);

  // PreloadDependencies
  assert.deepStrictEqual(uasset.preloadDependencies, [-1, -3]);

  // DataResourceMap
  assert.strictEqual(uasset.dataResourceVersion, ObjectDataResourceVersion.Initial);
  assert.strictEqual(uasset.dataResourceMap.length, 11);

  assert.strictEqual(uasset.dataResourceMap[0].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[0].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[0].serialOffset, 0n);
  assert.strictEqual(uasset.dataResourceMap[0].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[0].serialSize, 524288n);
  assert.strictEqual(uasset.dataResourceMap[0].rawSize, 524288n);
  assert.strictEqual(uasset.dataResourceMap[0].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[0].bulkDataFlags, expectedUbulkDataFlags);
  assert.strictEqual(uasset.dataResourceMap[0].bulkType, BulkType.Ubulk);

  assert.strictEqual(uasset.dataResourceMap[1].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[1].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[1].serialOffset, 524288n);
  assert.strictEqual(uasset.dataResourceMap[1].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[1].serialSize, 131072n);
  assert.strictEqual(uasset.dataResourceMap[1].rawSize, 131072n);
  assert.strictEqual(uasset.dataResourceMap[1].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[1].bulkDataFlags, expectedUbulkDataFlags);
  assert.strictEqual(uasset.dataResourceMap[1].bulkType, BulkType.Ubulk);

  assert.strictEqual(uasset.dataResourceMap[2].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[2].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[2].serialOffset, 655360n);
  assert.strictEqual(uasset.dataResourceMap[2].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[2].serialSize, 32768n);
  assert.strictEqual(uasset.dataResourceMap[2].rawSize, 32768n);
  assert.strictEqual(uasset.dataResourceMap[2].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[2].bulkDataFlags, expectedUbulkDataFlags);
  assert.strictEqual(uasset.dataResourceMap[2].bulkType, BulkType.Ubulk);

  assert.strictEqual(uasset.dataResourceMap[3].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[3].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[3].serialOffset, 688128n);
  assert.strictEqual(uasset.dataResourceMap[3].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[3].serialSize, 8192n);
  assert.strictEqual(uasset.dataResourceMap[3].rawSize, 8192n);
  assert.strictEqual(uasset.dataResourceMap[3].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[3].bulkDataFlags, expectedUbulkDataFlags);
  assert.strictEqual(uasset.dataResourceMap[3].bulkType, BulkType.Ubulk);

  assert.strictEqual(uasset.dataResourceMap[4].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[4].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[4].serialOffset, 178n);
  assert.strictEqual(uasset.dataResourceMap[4].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[4].serialSize, 2048n);
  assert.strictEqual(uasset.dataResourceMap[4].rawSize, 2048n);
  assert.strictEqual(uasset.dataResourceMap[4].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[4].bulkDataFlags, expectedUexpDataFlags);
  assert.strictEqual(uasset.dataResourceMap[4].bulkType, BulkType.Uexp);

  assert.strictEqual(uasset.dataResourceMap[5].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[5].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[5].serialOffset, 2242n);
  assert.strictEqual(uasset.dataResourceMap[5].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[5].serialSize, 512n);
  assert.strictEqual(uasset.dataResourceMap[5].rawSize, 512n);
  assert.strictEqual(uasset.dataResourceMap[5].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[5].bulkDataFlags, expectedUexpDataFlags);
  assert.strictEqual(uasset.dataResourceMap[5].bulkType, BulkType.Uexp);

  assert.strictEqual(uasset.dataResourceMap[6].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[6].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[6].serialOffset, 2770n);
  assert.strictEqual(uasset.dataResourceMap[6].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[6].serialSize, 128n);
  assert.strictEqual(uasset.dataResourceMap[6].rawSize, 128n);
  assert.strictEqual(uasset.dataResourceMap[6].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[6].bulkDataFlags, expectedUexpDataFlags);
  assert.strictEqual(uasset.dataResourceMap[6].bulkType, BulkType.Uexp);

  assert.strictEqual(uasset.dataResourceMap[7].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[7].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[7].serialOffset, 2914n);
  assert.strictEqual(uasset.dataResourceMap[7].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[7].serialSize, 32n);
  assert.strictEqual(uasset.dataResourceMap[7].rawSize, 32n);
  assert.strictEqual(uasset.dataResourceMap[7].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[7].bulkDataFlags, expectedUexpDataFlags);
  assert.strictEqual(uasset.dataResourceMap[7].bulkType, BulkType.Uexp);

  assert.strictEqual(uasset.dataResourceMap[8].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[8].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[8].serialOffset, 2962n);
  assert.strictEqual(uasset.dataResourceMap[8].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[8].serialSize, 8n);
  assert.strictEqual(uasset.dataResourceMap[8].rawSize, 8n);
  assert.strictEqual(uasset.dataResourceMap[8].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[8].bulkDataFlags, expectedUexpDataFlags);
  assert.strictEqual(uasset.dataResourceMap[8].bulkType, BulkType.Uexp);

  assert.strictEqual(uasset.dataResourceMap[9].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[9].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[9].serialOffset, 2986n);
  assert.strictEqual(uasset.dataResourceMap[9].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[9].serialSize, 8n);
  assert.strictEqual(uasset.dataResourceMap[9].rawSize, 8n);
  assert.strictEqual(uasset.dataResourceMap[9].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[9].bulkDataFlags, expectedUexpDataFlags);
  assert.strictEqual(uasset.dataResourceMap[9].bulkType, BulkType.Uexp);

  assert.strictEqual(uasset.dataResourceMap[10].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[10].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[10].serialOffset, 3010n);
  assert.strictEqual(uasset.dataResourceMap[10].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[10].serialSize, 8n);
  assert.strictEqual(uasset.dataResourceMap[10].rawSize, 8n);
  assert.strictEqual(uasset.dataResourceMap[10].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[10].bulkDataFlags, expectedUexpDataFlags);
  assert.strictEqual(uasset.dataResourceMap[10].bulkType, BulkType.Uexp);

  // ======== .uexp ========
  const uexpPath = uassetPath.replace(".uasset", ".uexp");
  const uexpBytes = await readFile(new URL(uexpPath, import.meta.url));
  const uexpReader = new AssetReader(uexpBytes);
  const uexp = UExp.read(uexpReader, version, uasset);

  assert.strictEqual(uexp.exports.length, 1);
  const tex = uexp.exports[0];
  assert.strictEqual(tex.kind, "texture");

  assert.strictEqual(tex.serializeMipData, true);
  assert.deepStrictEqual(tex.pixelFormatName, new MinimalName(1, 0));
  assert.strictEqual(tex.skipOffset, 2980n);
  assert.strictEqual(tex.importedWidth, 1024);
  assert.strictEqual(tex.importedHeight, 1024);
  assert.strictEqual(tex.packedData, 1);
  assert.strictEqual(tex.pixelFormat, "PF_DXT1");
  assert.strictEqual(tex.firstMipToSerialize, 0);
  assert.strictEqual(tex.mipCount, 11);

  assert.strictEqual(tex.mips[0].inlineData.length, 0);
  assert.strictEqual(tex.mips[0].width, 1024);
  assert.strictEqual(tex.mips[0].height, 1024);
  assert.strictEqual(tex.mips[0].depth, 1);

  assert.strictEqual(tex.mips[1].inlineData.length, 0);
  assert.strictEqual(tex.mips[1].width, 512);
  assert.strictEqual(tex.mips[1].height, 512);
  assert.strictEqual(tex.mips[1].depth, 1);

  assert.strictEqual(tex.mips[2].inlineData.length, 0);
  assert.strictEqual(tex.mips[2].width, 256);
  assert.strictEqual(tex.mips[2].height, 256);
  assert.strictEqual(tex.mips[2].depth, 1);

  assert.strictEqual(tex.mips[3].inlineData.length, 0);
  assert.strictEqual(tex.mips[3].width, 128);
  assert.strictEqual(tex.mips[3].height, 128);
  assert.strictEqual(tex.mips[3].depth, 1);

  assert.strictEqual(tex.mips[4].inlineData.length, 64 * 64 / 2);
  assert.strictEqual(tex.mips[4].width, 64);
  assert.strictEqual(tex.mips[4].height, 64);
  assert.strictEqual(tex.mips[4].depth, 1);

  assert.strictEqual(tex.mips[5].inlineData.length, 32 * 32 / 2);
  assert.strictEqual(tex.mips[5].width, 32);
  assert.strictEqual(tex.mips[5].height, 32);
  assert.strictEqual(tex.mips[5].depth, 1);

  assert.strictEqual(tex.mips[6].inlineData.length, 16 * 16 / 2);
  assert.strictEqual(tex.mips[6].width, 16);
  assert.strictEqual(tex.mips[6].height, 16);
  assert.strictEqual(tex.mips[6].depth, 1);

  assert.strictEqual(tex.mips[7].inlineData.length, 8 * 8 / 2);
  assert.strictEqual(tex.mips[7].width, 8);
  assert.strictEqual(tex.mips[7].height, 8);
  assert.strictEqual(tex.mips[7].depth, 1);

  assert.strictEqual(tex.mips[8].inlineData.length, 4 * 4 / 2);
  assert.strictEqual(tex.mips[8].width, 4);
  assert.strictEqual(tex.mips[8].height, 4);
  assert.strictEqual(tex.mips[8].depth, 1);

  assert.strictEqual(tex.mips[9].inlineData.length, 8);
  assert.strictEqual(tex.mips[9].width, 2);
  assert.strictEqual(tex.mips[9].height, 2);
  assert.strictEqual(tex.mips[9].depth, 1);

  assert.strictEqual(tex.mips[10].inlineData.length, 8);
  assert.strictEqual(tex.mips[10].width, 1);
  assert.strictEqual(tex.mips[10].height, 1);
  assert.strictEqual(tex.mips[10].depth, 1);

  assert.strictEqual(tex.isVirtual, false);

  assert.deepStrictEqual(tex.noneName, new MinimalName(0, 0));
});

test("UE5_4__Texture2D_BC1_VT", async () => {
  const version = UEVersion.UE5_4;

  // ======== .uasset ========
  const uassetPath = "./assets/ue5_4/T_Blocks2_1K_BC1_VT_BC.uasset";
  const uassetBytes = await readFile(new URL(uassetPath, import.meta.url));
  const reader = new AssetReader(uassetBytes);
  const uasset = UAsset.read(reader, version);

  assert.strictEqual(uasset.fileSize, uassetBytes.length);
  assert.strictEqual(uasset.fileSize, 790);

  // PackageFileSummary
  const summary = uasset.summary;

  assert.strictEqual(summary.tag, 0x9e2a83c1);
  assert.strictEqual(summary.legacyFileVersion, -8);

  assert.strictEqual(summary.fileVersionUE3, 0);
  assert.strictEqual(summary.fileVersionUE4, 0);
  assert.strictEqual(summary.fileVersionUE5, 0);
  assert.strictEqual(summary.fileVersionLicenseeUE, 0);
  assert.deepStrictEqual(summary.customVersions, []);

  assert.deepStrictEqual(summary.savedHash, new Uint8Array());
  assert.strictEqual(summary.totalHeaderSize, 790);

  assert.strictEqual(summary.packageName, "/Game/Textures/T_Blocks2_1K_BC1_VT_BC");

  const expectedFlags = (
    EPackageFlags.PKG_Cooked |
    EPackageFlags.PKG_UnversionedProperties |
    EPackageFlags.PKG_FilterEditorOnly
  ) >>> 0;
  assert.strictEqual(summary.packageFlags, expectedFlags);

  assert.strictEqual(summary.nameCount, 10);
  assert.strictEqual(summary.nameOffset, 254);

  assert.strictEqual(summary.softObjectPathsCount, 0);
  assert.strictEqual(summary.softObjectPathsOffset, 486);

  assert.strictEqual(summary.gatherableTextDataCount, 0);
  assert.strictEqual(summary.gatherableTextDataOffset, 0);

  assert.strictEqual(summary.exportCount, 1);
  assert.strictEqual(summary.exportOffset, 582);

  assert.strictEqual(summary.importCount, 3);
  assert.strictEqual(summary.importOffset, 486);

  assert.strictEqual(summary.cellExportCount, 0);
  assert.strictEqual(summary.cellExportOffset, 0);
  assert.strictEqual(summary.cellImportCount, 0);
  assert.strictEqual(summary.cellImportOffset, 0);

  assert.strictEqual(summary.metaDataOffset, 0);
  assert.strictEqual(summary.dependsOffset, 678);

  assert.strictEqual(summary.softPackageReferencesCount, 0);
  assert.strictEqual(summary.softPackageReferencesOffset, 0);

  assert.strictEqual(summary.searchableNamesOffset, 0);
  assert.strictEqual(summary.thumbnailTableOffset, 0);

  assert.strictEqual(summary.importTypeHierarchiesCount, 0);
  assert.strictEqual(summary.importTypeHierarchiesOffset, 0);

  assert.deepStrictEqual(summary.guid, {
    a: 1872114981,
    b: 3285010284,
    c: 2265430258,
    d: 560744264,
  });

  assert.strictEqual(summary.generations.length, 1);
  const generation = summary.generations[0];
  assert.strictEqual(generation.exportCount, 1);
  assert.strictEqual(generation.nameCount, 10);

  const emptyEngine = new EngineVersion(0, 0, 0, 0, "");
  assert.deepStrictEqual(summary.savedByEngineVersion, emptyEngine);
  assert.deepStrictEqual(summary.compatibleWithEngineVersion, emptyEngine);

  assert.strictEqual(summary.compressionFlags, 0);
  assert.strictEqual(summary.compressedChunksCount, 0);

  assert.strictEqual(summary.packageSource, -45468185);

  assert.deepStrictEqual(summary.additionalPackagesToCook, []);

  assert.strictEqual(summary.assetRegistryDataOffset, 682);
  assert.strictEqual(summary.bulkDataStartOffset, 1485n);
  assert.strictEqual(summary.worldTileInfoDataOffset, 0);
  assert.deepStrictEqual(summary.chunkIds, []);

  assert.strictEqual(summary.preloadDependencyCount, 2);
  assert.strictEqual(summary.preloadDependencyOffset, 686);

  assert.strictEqual(summary.namesReferencedFromExportDataCount, 2);
  assert.strictEqual(summary.payloadTocOffset, -1n);

  assert.strictEqual(summary.dataResourceOffset, 694);

  // NameMap
  const expectedNames = [
    "None",
    "PF_DXT1",
    "/Game/Textures/T_Blocks2_1K_BC1_VT_BC",
    "/Script/CoreUObject",
    "/Script/Engine",
    "Class",
    "Default__Texture2D",
    "Package",
    "T_Blocks2_1K_BC1_VT_BC",
    "Texture2D",
  ];
  assert.deepStrictEqual(uasset.nameMap.map(x => x.name), expectedNames);

  // ImportMap
  assert.strictEqual(uasset.importMap.length, 3);

  assert.deepStrictEqual(uasset.importMap[0].classPackage, new MinimalName(3, 0));
  assert.deepStrictEqual(uasset.importMap[0].className, new MinimalName(5, 0));
  assert.strictEqual(uasset.importMap[0].outerIndex, -2);
  assert.deepStrictEqual(uasset.importMap[0].objectName, new MinimalName(9, 0));
  assert.strictEqual(uasset.importMap[0].importOptional, false);

  assert.deepStrictEqual(uasset.importMap[1].classPackage, new MinimalName(3, 0));
  assert.deepStrictEqual(uasset.importMap[1].className, new MinimalName(7, 0));
  assert.strictEqual(uasset.importMap[1].outerIndex, 0);
  assert.deepStrictEqual(uasset.importMap[1].objectName, new MinimalName(4, 0));
  assert.strictEqual(uasset.importMap[1].importOptional, false);

  assert.deepStrictEqual(uasset.importMap[2].classPackage, new MinimalName(4, 0));
  assert.deepStrictEqual(uasset.importMap[2].className, new MinimalName(9, 0));
  assert.strictEqual(uasset.importMap[2].outerIndex, -2);
  assert.deepStrictEqual(uasset.importMap[2].objectName, new MinimalName(6, 0));
  assert.strictEqual(uasset.importMap[2].importOptional, false);

  // ExportMap
  assert.strictEqual(uasset.exportMap.length, 1);

  const exportObject = uasset.exportMap[0];
  assert.strictEqual(exportObject.classIndex, -1);
  assert.strictEqual(exportObject.superIndex, 0);
  assert.strictEqual(exportObject.templateIndex, -3);
  assert.strictEqual(exportObject.outerIndex, 0);
  assert.deepStrictEqual(exportObject.objectName, new MinimalName(8, 0));
  assert.strictEqual(exportObject.objectFlags, 3);
  assert.strictEqual(exportObject.serialSize, 695n);
  assert.strictEqual(exportObject.serialOffset, 790n);
  assert.strictEqual(exportObject.forcedExport, false);
  assert.strictEqual(exportObject.notForClient, false);
  assert.strictEqual(exportObject.notForServer, false);
  assert.strictEqual(exportObject.isInheritedInstance, false);
  assert.strictEqual(exportObject.packageFlags, 0);
  assert.strictEqual(exportObject.notAlwaysLoadedForEditorGame, true);
  assert.strictEqual(exportObject.isAsset, true);
  assert.strictEqual(exportObject.generatePublicHash, false);
  assert.strictEqual(exportObject.firstExportDependency, 0);
  assert.strictEqual(exportObject.serializationBeforeSerializationDependencies, 0);
  assert.strictEqual(exportObject.createBeforeSerializationDependencies, 0);
  assert.strictEqual(exportObject.serializationBeforeCreateDependencies, 2);
  assert.strictEqual(exportObject.createBeforeCreateDependencies, 0);

  assert.strictEqual(exportObject.scriptSerializationStartOffset, 0n);
  assert.strictEqual(exportObject.scriptSerializationEndOffset, 0n);

  // DependsMap
  assert.deepStrictEqual(uasset.dependsMap, [[]]);

  // PreloadDependencies
  assert.deepStrictEqual(uasset.preloadDependencies, [-1, -3]);

  // DataResourceMap
  assert.strictEqual(uasset.dataResourceVersion, ObjectDataResourceVersion.Initial);
  assert.strictEqual(uasset.dataResourceMap.length, 2);

  assert.strictEqual(uasset.dataResourceMap[0].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[0].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[0].serialOffset, 0n);
  assert.strictEqual(uasset.dataResourceMap[0].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[0].serialSize, 591876n);
  assert.strictEqual(uasset.dataResourceMap[0].rawSize, 591876n);
  assert.strictEqual(uasset.dataResourceMap[0].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[0].bulkDataFlags, expectedUbulkDataFlags);
  assert.strictEqual(uasset.dataResourceMap[0].bulkType, BulkType.Ubulk);

  assert.strictEqual(uasset.dataResourceMap[1].flags, 0);
  assert.strictEqual(uasset.dataResourceMap[1].cookedIndex, 0);
  assert.strictEqual(uasset.dataResourceMap[1].serialOffset, 591876n);
  assert.strictEqual(uasset.dataResourceMap[1].duplicateSerialOffset, -1n);
  assert.strictEqual(uasset.dataResourceMap[1].serialSize, 258948n);
  assert.strictEqual(uasset.dataResourceMap[1].rawSize, 258948n);
  assert.strictEqual(uasset.dataResourceMap[1].outerIndex, 1);
  assert.strictEqual(uasset.dataResourceMap[1].bulkDataFlags, expectedUbulkDataFlags);
  assert.strictEqual(uasset.dataResourceMap[1].bulkType, BulkType.Ubulk);

  // ======== .uexp ========
  const uexpPath = uassetPath.replace(".uasset", ".uexp");
  const uexpBytes = await readFile(new URL(uexpPath, import.meta.url));
  const uexpReader = new AssetReader(uexpBytes);
  const uexp = UExp.read(uexpReader, version, uasset);

  assert.strictEqual(uexp.exports.length, 1);
  const tex = uexp.exports[0];
  assert.strictEqual(tex.kind, "texture");

  assert.strictEqual(tex.serializeMipData, true);
  assert.deepStrictEqual(tex.pixelFormatName, new MinimalName(1, 0));
  assert.strictEqual(tex.skipOffset, 630n);
  assert.strictEqual(tex.importedWidth, 1024);
  assert.strictEqual(tex.importedHeight, 1024);
  assert.strictEqual(tex.packedData, 1);
  assert.strictEqual(tex.pixelFormat, "PF_DXT1");
  assert.strictEqual(tex.firstMipToSerialize, 0);
  assert.strictEqual(tex.mipCount, 0);

  assert.strictEqual(tex.mips.length, 0);

  assert.strictEqual(tex.isVirtual, true);

  // VirtualTextureBuiltData
  assert.ok(tex.virtualTextureData !== null);
  assert.strictEqual(tex.virtualTextureData.isCooked, true);
  assert.strictEqual(tex.virtualTextureData.numLayers, 1);
  assert.strictEqual(tex.virtualTextureData.widthInBlocks, 1);
  assert.strictEqual(tex.virtualTextureData.heightInBlocks, 1);
  assert.strictEqual(tex.virtualTextureData.tileSize, 128);
  assert.strictEqual(tex.virtualTextureData.tileBorderSize, 4);

  assert.strictEqual(tex.virtualTextureData.numMips, 11);
  assert.strictEqual(tex.virtualTextureData.width, 1024);
  assert.strictEqual(tex.virtualTextureData.height, 1024);

  assert.deepStrictEqual(
    tex.virtualTextureData.chunkIndexPerMip,
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  );

  assert.deepStrictEqual(
    tex.virtualTextureData.baseOffsetPerMip,
    [4, 4, 147972, 184964, 194212, 203460, 212708, 221956, 231204, 240452, 249700]
  );

  const expectedTileOffsets = [
    {width: 8, height: 8, maxAddress: 64, addresses: [0], offsets: [0]},
    {width: 4, height: 4, maxAddress: 16, addresses: [0], offsets: [0]},
    {width: 2, height: 2, maxAddress: 4, addresses: [0], offsets: [0]},
    {width: 1, height: 1, maxAddress: 1, addresses: [0], offsets: [0]},
    {width: 1, height: 1, maxAddress: 1, addresses: [0], offsets: [0]},
    {width: 1, height: 1, maxAddress: 1, addresses: [0], offsets: [0]},
    {width: 1, height: 1, maxAddress: 1, addresses: [0], offsets: [0]},
    {width: 1, height: 1, maxAddress: 1, addresses: [0], offsets: [0]},
    {width: 1, height: 1, maxAddress: 1, addresses: [0], offsets: [0]},
    {width: 1, height: 1, maxAddress: 1, addresses: [0], offsets: [0]},
    {width: 1, height: 1, maxAddress: 1, addresses: [0], offsets: [0]},
  ];

  assert.strictEqual(tex.virtualTextureData.tileOffsetData.length, expectedTileOffsets.length);
  for (let i = 0; i < expectedTileOffsets.length; i++) {
    const actual: VirtualTextureTileOffsetData = tex.virtualTextureData.tileOffsetData[i];
    const expected = expectedTileOffsets[i];

    assert.strictEqual(actual.width, expected.width);
    assert.strictEqual(actual.height, expected.height);
    assert.strictEqual(actual.maxAddress, expected.maxAddress);
    assert.deepStrictEqual(actual.addresses, expected.addresses);
    assert.deepStrictEqual(actual.offsets, expected.offsets);
  }

  assert.strictEqual(tex.virtualTextureData.tileIndexPerChunk.length, 0);
  assert.strictEqual(tex.virtualTextureData.tileIndexPerMip.length, 0);
  assert.strictEqual(tex.virtualTextureData.tileOffsetInChunk.length, 0);

  assert.deepStrictEqual(tex.virtualTextureData.layerTypes, ["PF_DXT1"]);

  assert.deepStrictEqual(tex.virtualTextureData.layerFallbackColors.length, 1);
  const fallbackColor = tex.virtualTextureData.layerFallbackColors[0];
  assert.ok(Math.abs(fallbackColor.r - 0.31854677) <= 1e-6);
  assert.ok(Math.abs(fallbackColor.g - 0.31398872) <= 1e-6);
  assert.ok(Math.abs(fallbackColor.b - 0.31854677) <= 1e-6);
  assert.equal(fallbackColor.a, 1.0);

  assert.strictEqual(tex.virtualTextureData.chunks.length, 2);

  const chunk0 = tex.virtualTextureData.chunks[0];
  assert.strictEqual(chunk0.sizeInBytes, 591876);
  assert.strictEqual(chunk0.codecPayloadSize, 4);
  assert.strictEqual(chunk0.layerInfos.length, 1);
  assert.strictEqual(chunk0.layerInfos[0].codec, EVirtualTextureCodec.RawGPU);
  assert.strictEqual(chunk0.layerInfos[0].payloadOffset, 4);

  const chunk1 = tex.virtualTextureData.chunks[1];
  assert.strictEqual(chunk1.sizeInBytes, 258948);
  assert.strictEqual(chunk1.codecPayloadSize, 4);
  assert.strictEqual(chunk1.layerInfos.length, 1);
  assert.strictEqual(chunk1.layerInfos[0].codec, EVirtualTextureCodec.RawGPU);
  assert.strictEqual(chunk1.layerInfos[0].payloadOffset, 4);

  assert.deepStrictEqual(tex.noneName, new MinimalName(0, 0));
});

test("UE5_5__Texture2D_BC1", async () => {
  const version = UEVersion.UE5_5;

  // ======== .uasset ========
  const uassetPath = "./assets/ue5_5/T_Blocks2_1K_BC1_BC.uasset";
  const uassetBytes = await readFile(new URL(uassetPath, import.meta.url));
  const reader = new AssetReader(uassetBytes);
  const uasset = UAsset.read(reader, version);

  assert.strictEqual(uasset.fileSize, uassetBytes.length);
  assert.strictEqual(uasset.fileSize, 1188);

  // PackageFileSummary
  const summary = uasset.summary;

  assert.strictEqual(summary.tag, 0x9e2a83c1);
  assert.strictEqual(summary.legacyFileVersion, -8);

  assert.strictEqual(summary.fileVersionUE3, 0);
  assert.strictEqual(summary.fileVersionUE4, 0);
  assert.strictEqual(summary.fileVersionUE5, 0);
  assert.strictEqual(summary.fileVersionLicenseeUE, 0);
  assert.deepStrictEqual(summary.customVersions, []);

  assert.deepStrictEqual(summary.savedHash, new Uint8Array());
  assert.strictEqual(summary.totalHeaderSize, 1188);

  assert.strictEqual(summary.packageName, "/Game/Textures/T_Blocks2_1K_BC1_BC");

  const expectedFlags = (
    EPackageFlags.PKG_Cooked |
    EPackageFlags.PKG_UnversionedProperties |
    EPackageFlags.PKG_FilterEditorOnly
  ) >>> 0;
  assert.strictEqual(summary.packageFlags, expectedFlags);

  assert.strictEqual(summary.nameCount, 10);
  assert.strictEqual(summary.nameOffset, 251);

  assert.strictEqual(summary.softObjectPathsCount, 0);
  assert.strictEqual(summary.softObjectPathsOffset, 477);

  assert.strictEqual(summary.gatherableTextDataCount, 0);
  assert.strictEqual(summary.gatherableTextDataOffset, 0);

  assert.strictEqual(summary.exportCount, 1);
  assert.strictEqual(summary.exportOffset, 573);

  assert.strictEqual(summary.importCount, 3);
  assert.strictEqual(summary.importOffset, 477);

  assert.strictEqual(summary.cellExportCount, 0);
  assert.strictEqual(summary.cellExportOffset, 0);
  assert.strictEqual(summary.cellImportCount, 0);
  assert.strictEqual(summary.cellImportOffset, 0);

  assert.strictEqual(summary.metaDataOffset, 0);
  assert.strictEqual(summary.dependsOffset, 669);

  assert.strictEqual(summary.softPackageReferencesCount, 0);
  assert.strictEqual(summary.softPackageReferencesOffset, 0);

  assert.strictEqual(summary.searchableNamesOffset, 0);
  assert.strictEqual(summary.thumbnailTableOffset, 0);

  assert.strictEqual(summary.importTypeHierarchiesCount, 0);
  assert.strictEqual(summary.importTypeHierarchiesOffset, 0);

  assert.deepStrictEqual(summary.guid, {
    a: 3704557706,
    b: 472073475,
    c: 2832342837,
    d: 2734481239,
  });

  assert.strictEqual(summary.generations.length, 1);
  const generation = summary.generations[0];
  assert.strictEqual(generation.exportCount, 1);
  assert.strictEqual(generation.nameCount, 10);

  const emptyEngine = new EngineVersion(0, 0, 0, 0, "");
  assert.deepStrictEqual(summary.savedByEngineVersion, emptyEngine);
  assert.deepStrictEqual(summary.compatibleWithEngineVersion, emptyEngine);

  assert.strictEqual(summary.compressionFlags, 0);
  assert.strictEqual(summary.compressedChunksCount, 0);

  assert.strictEqual(summary.packageSource, -980866167);

  assert.deepStrictEqual(summary.additionalPackagesToCook, []);

  assert.strictEqual(summary.assetRegistryDataOffset, 673);
  assert.strictEqual(summary.bulkDataStartOffset, 4226n);
  assert.strictEqual(summary.worldTileInfoDataOffset, 0);
  assert.deepStrictEqual(summary.chunkIds, []);

  assert.strictEqual(summary.preloadDependencyCount, 2);
  assert.strictEqual(summary.preloadDependencyOffset, 677);

  assert.strictEqual(summary.namesReferencedFromExportDataCount, 2);
  assert.strictEqual(summary.payloadTocOffset, -1n);

  assert.strictEqual(summary.dataResourceOffset, 685);

  // NameMap
  const expectedNames = [
    "None",
    "PF_DXT1",
    "/Game/Textures/T_Blocks2_1K_BC1_BC",
    "/Script/CoreUObject",
    "/Script/Engine",
    "Class",
    "Default__Texture2D",
    "Package",
    "T_Blocks2_1K_BC1_BC",
    "Texture2D",
  ];
  assert.deepStrictEqual(uasset.nameMap.map(x => x.name), expectedNames);
  // Name entry hashes are not included in the .uasset fixture's decoded values.

  // ImportMap
  assert.strictEqual(uasset.importMap.length, 3);

  assert.deepStrictEqual(uasset.importMap[0].classPackage, new MinimalName(3, 0));
  assert.deepStrictEqual(uasset.importMap[0].className, new MinimalName(5, 0));
  assert.strictEqual(uasset.importMap[0].outerIndex, -2);
  assert.deepStrictEqual(uasset.importMap[0].objectName, new MinimalName(9, 0));
  assert.strictEqual(uasset.importMap[0].importOptional, false);

  assert.deepStrictEqual(uasset.importMap[1].classPackage, new MinimalName(3, 0));
  assert.deepStrictEqual(uasset.importMap[1].className, new MinimalName(7, 0));
  assert.strictEqual(uasset.importMap[1].outerIndex, 0);
  assert.deepStrictEqual(uasset.importMap[1].objectName, new MinimalName(4, 0));
  assert.strictEqual(uasset.importMap[1].importOptional, false);

  assert.deepStrictEqual(uasset.importMap[2].classPackage, new MinimalName(4, 0));
  assert.deepStrictEqual(uasset.importMap[2].className, new MinimalName(9, 0));
  assert.strictEqual(uasset.importMap[2].outerIndex, -2);
  assert.deepStrictEqual(uasset.importMap[2].objectName, new MinimalName(6, 0));
  assert.strictEqual(uasset.importMap[2].importOptional, false);

  // ExportMap
  assert.strictEqual(uasset.exportMap.length, 1);

  const exportObject = uasset.exportMap[0];
  assert.strictEqual(exportObject.classIndex, -1);
  assert.strictEqual(exportObject.superIndex, 0);
  assert.strictEqual(exportObject.templateIndex, -3);
  assert.strictEqual(exportObject.outerIndex, 0);
  assert.deepStrictEqual(exportObject.objectName, new MinimalName(8, 0));
  assert.strictEqual(exportObject.objectFlags, 3);
  assert.strictEqual(exportObject.serialSize, 3038n);
  assert.strictEqual(exportObject.serialOffset, 1188n);
  assert.strictEqual(exportObject.forcedExport, false);
  assert.strictEqual(exportObject.notForClient, false);
  assert.strictEqual(exportObject.notForServer, false);
  assert.strictEqual(exportObject.isInheritedInstance, false);
  assert.strictEqual(exportObject.packageFlags, 0);
  assert.strictEqual(exportObject.notAlwaysLoadedForEditorGame, true);
  assert.strictEqual(exportObject.isAsset, true);
  assert.strictEqual(exportObject.generatePublicHash, false);
  assert.strictEqual(exportObject.firstExportDependency, 0);
  assert.strictEqual(exportObject.serializationBeforeSerializationDependencies, 0);
  assert.strictEqual(exportObject.createBeforeSerializationDependencies, 0);
  assert.strictEqual(exportObject.serializationBeforeCreateDependencies, 2);
  assert.strictEqual(exportObject.createBeforeCreateDependencies, 0);

  assert.strictEqual(exportObject.scriptSerializationStartOffset, 0n);
  assert.strictEqual(exportObject.scriptSerializationEndOffset, 0n);

  // DependsMap
  assert.deepStrictEqual(uasset.dependsMap, [[]]);

  // PreloadDependencies
  assert.deepStrictEqual(uasset.preloadDependencies, [-1, -3]);

  // DataResourceMap. UE 5.5 adds cookedIndex to each resource.
  const expectedDataResources = [
    {serialOffset: 0n, serialSize: 524288n, rawSize: 524288n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialOffset: 524288n, serialSize: 131072n, rawSize: 131072n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialOffset: 655360n, serialSize: 32768n, rawSize: 32768n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialOffset: 688128n, serialSize: 8192n, rawSize: 8192n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialOffset: 174n, serialSize: 2048n, rawSize: 2048n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2238n, serialSize: 512n, rawSize: 512n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2766n, serialSize: 128n, rawSize: 128n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2910n, serialSize: 32n, rawSize: 32n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2958n, serialSize: 8n, rawSize: 8n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2982n, serialSize: 8n, rawSize: 8n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 3006n, serialSize: 8n, rawSize: 8n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
  ];

  assert.strictEqual(uasset.dataResourceVersion, ObjectDataResourceVersion.AddedCookedIndex);
  assert.strictEqual(uasset.dataResourceMap.length, expectedDataResources.length);
  for (let i = 0; i < expectedDataResources.length; i++) {
    const actual = uasset.dataResourceMap[i];
    const expected = expectedDataResources[i];

    assert.strictEqual(actual.flags, 0);
    assert.strictEqual(actual.cookedIndex, 0);
    assert.strictEqual(actual.serialOffset, expected.serialOffset);
    assert.strictEqual(actual.duplicateSerialOffset, -1n);
    assert.strictEqual(actual.serialSize, expected.serialSize);
    assert.strictEqual(actual.rawSize, expected.rawSize);
    assert.strictEqual(actual.outerIndex, 1);
    assert.strictEqual(actual.bulkDataFlags, expected.bulkDataFlags);
    assert.strictEqual(actual.bulkType, expected.bulkType);
  }

  // ======== .uexp ========
  const uexpPath = uassetPath.replace(".uasset", ".uexp");
  const uexpBytes = await readFile(new URL(uexpPath, import.meta.url));
  const uexpReader = new AssetReader(uexpBytes);
  const uexp = UExp.read(uexpReader, version, uasset);

  assert.strictEqual(uexp.exports.length, 1);
  const tex = uexp.exports[0];
  assert.strictEqual(tex.kind, "texture");
  assert.strictEqual(tex.className, "Texture2D");

  assert.strictEqual(tex.serializeMipData, true);
  assert.deepStrictEqual(tex.pixelFormatName, new MinimalName(1, 0));
  assert.strictEqual(tex.skipOffset, 2980n);
  assert.strictEqual(tex.importedWidth, 1024);
  assert.strictEqual(tex.importedHeight, 1024);
  assert.strictEqual(tex.packedData, 1);
  assert.strictEqual(tex.pixelFormat, "PF_DXT1");
  assert.strictEqual(tex.firstMipToSerialize, 0);
  assert.strictEqual(tex.mipCount, 11);

  const expectedMips = [
    {inlineDataLength: 0, width: 1024, height: 1024},
    {inlineDataLength: 0, width: 512, height: 512},
    {inlineDataLength: 0, width: 256, height: 256},
    {inlineDataLength: 0, width: 128, height: 128},
    {inlineDataLength: 2048, width: 64, height: 64},
    {inlineDataLength: 512, width: 32, height: 32},
    {inlineDataLength: 128, width: 16, height: 16},
    {inlineDataLength: 32, width: 8, height: 8},
    {inlineDataLength: 8, width: 4, height: 4},
    {inlineDataLength: 8, width: 2, height: 2},
    {inlineDataLength: 8, width: 1, height: 1},
  ];

  assert.strictEqual(tex.mips.length, expectedMips.length);
  for (let i = 0; i < expectedMips.length; i++) {
    const mip: Mip = tex.mips[i]!;
    const expected = expectedMips[i];

    assert.strictEqual(mip.dataResourceIndex, i);
    assert.strictEqual(mip.inlineData.length, expected.inlineDataLength);
    assert.strictEqual(mip.width, expected.width);
    assert.strictEqual(mip.height, expected.height);
    assert.strictEqual(mip.depth, 1);
  }

  assert.strictEqual(tex.isVirtual, false);

  assert.deepStrictEqual(tex.noneName, new MinimalName(0, 0));
});

test("UE5_6__Texture2D_BC1", async () => {
  const version = UEVersion.UE5_6;

  // ======== .uasset ========
  const uassetPath = "./assets/ue5_6/T_Blocks2_1K_BC1_BC.uasset";
  const uassetBytes = await readFile(new URL(uassetPath, import.meta.url));
  const reader = new AssetReader(uassetBytes);
  const uasset = UAsset.read(reader, version);

  assert.strictEqual(uasset.fileSize, uassetBytes.length);
  assert.strictEqual(uasset.fileSize, 1212);

  // PackageFileSummary
  const summary = uasset.summary;

  assert.strictEqual(summary.tag, 0x9e2a83c1);
  assert.strictEqual(summary.legacyFileVersion, -9);

  assert.strictEqual(summary.fileVersionUE3, 0);
  assert.strictEqual(summary.fileVersionUE4, 0);
  assert.strictEqual(summary.fileVersionUE5, 0);
  assert.strictEqual(summary.fileVersionLicenseeUE, 0);
  assert.deepStrictEqual(summary.customVersions, []);

  assert.deepStrictEqual(
    Array.from(summary.savedHash),
    [
      0x0a, 0x40, 0x40, 0x68, 0x9b, 0x43, 0xdb, 0xf2, 0x69, 0x78,
      0x7d, 0xdc, 0x1c, 0x2a, 0xa7, 0x6d, 0xc0, 0x2f, 0x04, 0xd2,
    ],
  );
  assert.strictEqual(summary.totalHeaderSize, 1212);

  assert.strictEqual(summary.packageName, "/Game/Textures/T_Blocks2_1K_BC1_BC");

  const expectedFlags = (
    EPackageFlags.PKG_Cooked |
    EPackageFlags.PKG_UnversionedProperties |
    EPackageFlags.PKG_FilterEditorOnly
  ) >>> 0;
  assert.strictEqual(summary.packageFlags, expectedFlags);

  assert.strictEqual(summary.nameCount, 10);
  assert.strictEqual(summary.nameOffset, 275);

  assert.strictEqual(summary.softObjectPathsCount, 0);
  assert.strictEqual(summary.softObjectPathsOffset, 501);

  assert.strictEqual(summary.gatherableTextDataCount, 0);
  assert.strictEqual(summary.gatherableTextDataOffset, 0);

  assert.strictEqual(summary.exportCount, 1);
  assert.strictEqual(summary.exportOffset, 597);

  assert.strictEqual(summary.importCount, 3);
  assert.strictEqual(summary.importOffset, 501);

  assert.strictEqual(summary.cellExportCount, 0);
  assert.strictEqual(summary.cellExportOffset, 693);
  assert.strictEqual(summary.cellImportCount, 0);
  assert.strictEqual(summary.cellImportOffset, 693);

  assert.strictEqual(summary.metaDataOffset, 0);
  assert.strictEqual(summary.dependsOffset, 693);

  assert.strictEqual(summary.softPackageReferencesCount, 0);
  assert.strictEqual(summary.softPackageReferencesOffset, 0);

  assert.strictEqual(summary.searchableNamesOffset, 0);
  assert.strictEqual(summary.thumbnailTableOffset, 0);

  assert.strictEqual(summary.importTypeHierarchiesCount, 0);
  assert.strictEqual(summary.importTypeHierarchiesOffset, 0);

  assert.deepStrictEqual(summary.guid, {
    a: 0,
    b: 0,
    c: 0,
    d: 0,
  });

  assert.strictEqual(summary.generations.length, 1);
  const generation = summary.generations[0];
  assert.strictEqual(generation.exportCount, 1);
  assert.strictEqual(generation.nameCount, 10);

  const emptyEngine = new EngineVersion(0, 0, 0, 0, "");
  assert.deepStrictEqual(summary.savedByEngineVersion, emptyEngine);
  assert.deepStrictEqual(summary.compatibleWithEngineVersion, emptyEngine);

  assert.strictEqual(summary.compressionFlags, 0);
  assert.strictEqual(summary.compressedChunksCount, 0);

  assert.strictEqual(summary.packageSource, -980866167);

  assert.deepStrictEqual(summary.additionalPackagesToCook, []);

  assert.strictEqual(summary.assetRegistryDataOffset, 697);
  assert.strictEqual(summary.bulkDataStartOffset, 4250n);
  assert.strictEqual(summary.worldTileInfoDataOffset, 0);
  assert.deepStrictEqual(summary.chunkIds, []);

  assert.strictEqual(summary.preloadDependencyCount, 2);
  assert.strictEqual(summary.preloadDependencyOffset, 701);

  assert.strictEqual(summary.namesReferencedFromExportDataCount, 2);
  assert.strictEqual(summary.payloadTocOffset, -1n);

  assert.strictEqual(summary.dataResourceOffset, 709);

  // NameMap
  const expectedNames = [
    "None",
    "PF_DXT1",
    "/Game/Textures/T_Blocks2_1K_BC1_BC",
    "/Script/CoreUObject",
    "/Script/Engine",
    "Class",
    "Default__Texture2D",
    "Package",
    "T_Blocks2_1K_BC1_BC",
    "Texture2D",
  ];
  assert.deepStrictEqual(uasset.nameMap.map(x => x.name), expectedNames);
  // Name entry hashes are not included in the .uasset fixture's decoded values.

  // ImportMap
  assert.strictEqual(uasset.importMap.length, 3);

  assert.deepStrictEqual(uasset.importMap[0].classPackage, new MinimalName(3, 0));
  assert.deepStrictEqual(uasset.importMap[0].className, new MinimalName(5, 0));
  assert.strictEqual(uasset.importMap[0].outerIndex, -2);
  assert.deepStrictEqual(uasset.importMap[0].objectName, new MinimalName(9, 0));
  assert.strictEqual(uasset.importMap[0].importOptional, false);

  assert.deepStrictEqual(uasset.importMap[1].classPackage, new MinimalName(3, 0));
  assert.deepStrictEqual(uasset.importMap[1].className, new MinimalName(7, 0));
  assert.strictEqual(uasset.importMap[1].outerIndex, 0);
  assert.deepStrictEqual(uasset.importMap[1].objectName, new MinimalName(4, 0));
  assert.strictEqual(uasset.importMap[1].importOptional, false);

  assert.deepStrictEqual(uasset.importMap[2].classPackage, new MinimalName(4, 0));
  assert.deepStrictEqual(uasset.importMap[2].className, new MinimalName(9, 0));
  assert.strictEqual(uasset.importMap[2].outerIndex, -2);
  assert.deepStrictEqual(uasset.importMap[2].objectName, new MinimalName(6, 0));
  assert.strictEqual(uasset.importMap[2].importOptional, false);

  // ExportMap
  assert.strictEqual(uasset.exportMap.length, 1);

  const exportObject = uasset.exportMap[0];
  assert.strictEqual(exportObject.classIndex, -1);
  assert.strictEqual(exportObject.superIndex, 0);
  assert.strictEqual(exportObject.templateIndex, -3);
  assert.strictEqual(exportObject.outerIndex, 0);
  assert.deepStrictEqual(exportObject.objectName, new MinimalName(8, 0));
  assert.strictEqual(exportObject.objectFlags, 3);
  assert.strictEqual(exportObject.serialSize, 3038n);
  assert.strictEqual(exportObject.serialOffset, 1212n);
  assert.strictEqual(exportObject.forcedExport, false);
  assert.strictEqual(exportObject.notForClient, false);
  assert.strictEqual(exportObject.notForServer, false);
  assert.strictEqual(exportObject.isInheritedInstance, false);
  assert.strictEqual(exportObject.packageFlags, 0);
  assert.strictEqual(exportObject.notAlwaysLoadedForEditorGame, true);
  assert.strictEqual(exportObject.isAsset, true);
  assert.strictEqual(exportObject.generatePublicHash, false);
  assert.strictEqual(exportObject.firstExportDependency, 0);
  assert.strictEqual(exportObject.serializationBeforeSerializationDependencies, 0);
  assert.strictEqual(exportObject.createBeforeSerializationDependencies, 0);
  assert.strictEqual(exportObject.serializationBeforeCreateDependencies, 2);
  assert.strictEqual(exportObject.createBeforeCreateDependencies, 0);

  assert.strictEqual(exportObject.scriptSerializationStartOffset, 0n);
  assert.strictEqual(exportObject.scriptSerializationEndOffset, 0n);

  // DependsMap
  assert.deepStrictEqual(uasset.dependsMap, [[]]);

  // PreloadDependencies
  assert.deepStrictEqual(uasset.preloadDependencies, [-1, -3]);

  // DataResourceMap
  const expectedDataResources = [
    {serialOffset: 0n, serialSize: 524288n, rawSize: 524288n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialOffset: 524288n, serialSize: 131072n, rawSize: 131072n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialOffset: 655360n, serialSize: 32768n, rawSize: 32768n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialOffset: 688128n, serialSize: 8192n, rawSize: 8192n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialOffset: 174n, serialSize: 2048n, rawSize: 2048n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2238n, serialSize: 512n, rawSize: 512n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2766n, serialSize: 128n, rawSize: 128n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2910n, serialSize: 32n, rawSize: 32n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2958n, serialSize: 8n, rawSize: 8n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 2982n, serialSize: 8n, rawSize: 8n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialOffset: 3006n, serialSize: 8n, rawSize: 8n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
  ];

  assert.strictEqual(uasset.dataResourceVersion, ObjectDataResourceVersion.AddedCookedIndex);
  assert.strictEqual(uasset.dataResourceMap.length, expectedDataResources.length);
  for (let i = 0; i < expectedDataResources.length; i++) {
    const actual = uasset.dataResourceMap[i];
    const expected = expectedDataResources[i];

    assert.strictEqual(actual.flags, 0);
    assert.strictEqual(actual.cookedIndex, 0);
    assert.strictEqual(actual.serialOffset, expected.serialOffset);
    assert.strictEqual(actual.duplicateSerialOffset, -1n);
    assert.strictEqual(actual.serialSize, expected.serialSize);
    assert.strictEqual(actual.rawSize, expected.rawSize);
    assert.strictEqual(actual.outerIndex, 1);
    assert.strictEqual(actual.bulkDataFlags, expected.bulkDataFlags);
    assert.strictEqual(actual.bulkType, expected.bulkType);
  }

  // ======== .uexp ========
  const uexpPath = uassetPath.replace(".uasset", ".uexp");
  const uexpBytes = await readFile(new URL(uexpPath, import.meta.url));
  const uexpReader = new AssetReader(uexpBytes);
  const uexp = UExp.read(uexpReader, version, uasset);

  assert.strictEqual(uexp.exports.length, 1);
  const tex = uexp.exports[0];
  assert.strictEqual(tex.kind, "texture");
  assert.strictEqual(tex.className, "Texture2D");

  assert.strictEqual(tex.serializeMipData, true);
  assert.deepStrictEqual(tex.pixelFormatName, new MinimalName(1, 0));
  assert.strictEqual(tex.skipOffset, 2980n);
  assert.strictEqual(tex.importedWidth, 1024);
  assert.strictEqual(tex.importedHeight, 1024);
  assert.strictEqual(tex.packedData, 1);
  assert.strictEqual(tex.pixelFormat, "PF_DXT1");
  assert.strictEqual(tex.firstMipToSerialize, 0);
  assert.strictEqual(tex.mipCount, 11);

  const expectedMips = [
    {inlineDataLength: 0, width: 1024, height: 1024},
    {inlineDataLength: 0, width: 512, height: 512},
    {inlineDataLength: 0, width: 256, height: 256},
    {inlineDataLength: 0, width: 128, height: 128},
    {inlineDataLength: 2048, width: 64, height: 64},
    {inlineDataLength: 512, width: 32, height: 32},
    {inlineDataLength: 128, width: 16, height: 16},
    {inlineDataLength: 32, width: 8, height: 8},
    {inlineDataLength: 8, width: 4, height: 4},
    {inlineDataLength: 8, width: 2, height: 2},
    {inlineDataLength: 8, width: 1, height: 1},
  ];

  assert.strictEqual(tex.mips.length, expectedMips.length);
  for (let i = 0; i < expectedMips.length; i++) {
    const mip: Mip = tex.mips[i]!;
    const expected = expectedMips[i];

    assert.strictEqual(mip.dataResourceIndex, i);
    assert.strictEqual(mip.inlineData.length, expected.inlineDataLength);
    assert.strictEqual(mip.width, expected.width);
    assert.strictEqual(mip.height, expected.height);
    assert.strictEqual(mip.depth, 1);
  }

  assert.strictEqual(tex.isVirtual, false);

  assert.deepStrictEqual(tex.noneName, new MinimalName(0, 0));
});

test("UE5_7__Texture2D_BC1", async () => {
  const version = UEVersion.UE5_7;

  // ======== .uasset ========
  const uassetPath = "./assets/ue5_7/T_Blocks2_1K_BC1_BC.uasset";
  const uassetBytes = await readFile(new URL(uassetPath, import.meta.url));
  const reader = new AssetReader(uassetBytes);
  const uasset = UAsset.read(reader, version);

  assert.strictEqual(uasset.fileSize, uassetBytes.length);
  assert.strictEqual(uasset.fileSize, 1220);

  // PackageFileSummary
  const summary = uasset.summary;

  assert.strictEqual(summary.tag, 0x9e2a83c1);
  assert.strictEqual(summary.legacyFileVersion, -9);

  assert.strictEqual(summary.fileVersionUE3, 0);
  assert.strictEqual(summary.fileVersionUE4, 0);
  assert.strictEqual(summary.fileVersionUE5, 0);
  assert.strictEqual(summary.fileVersionLicenseeUE, 0);
  assert.deepStrictEqual(summary.customVersions, []);

  assert.deepStrictEqual(
    Array.from(summary.savedHash),
    [
      0x97, 0x4c, 0xfb, 0x12, 0x8e, 0x36, 0x21, 0xf5, 0x5a, 0x9f,
      0x85, 0x5e, 0xac, 0xcb, 0x9d, 0xe7, 0x21, 0x8e, 0x94, 0xfc,
    ],
  );
  assert.strictEqual(summary.totalHeaderSize, 1220);

  assert.strictEqual(summary.packageName, "/Game/Textures/T_Blocks2_1K_BC1_BC");

  const expectedFlags = (
    EPackageFlags.PKG_Cooked |
    EPackageFlags.PKG_UnversionedProperties |
    EPackageFlags.PKG_FilterEditorOnly
  ) >>> 0;
  assert.strictEqual(summary.packageFlags, expectedFlags);

  assert.strictEqual(summary.nameCount, 10);
  assert.strictEqual(summary.softObjectPathsCount, 0);
  assert.strictEqual(summary.gatherableTextDataCount, 0);
  assert.strictEqual(summary.exportCount, 1);
  assert.strictEqual(summary.importCount, 3);
  assert.strictEqual(summary.cellExportCount, 0);
  assert.strictEqual(summary.cellImportCount, 0);
  assert.strictEqual(summary.softPackageReferencesCount, 0);
  assert.strictEqual(summary.importTypeHierarchiesCount, 0);

  assert.deepStrictEqual(summary.guid, {
    a: 0,
    b: 0,
    c: 0,
    d: 0,
  });

  assert.strictEqual(summary.generations.length, 1);
  const generation = summary.generations[0];
  assert.strictEqual(generation.exportCount, 1);
  assert.strictEqual(generation.nameCount, 10);

  const emptyEngine = new EngineVersion(0, 0, 0, 0, "");
  assert.deepStrictEqual(summary.savedByEngineVersion, emptyEngine);
  assert.deepStrictEqual(summary.compatibleWithEngineVersion, emptyEngine);

  assert.strictEqual(summary.compressionFlags, 0);
  assert.strictEqual(summary.compressedChunksCount, 0);
  assert.strictEqual(summary.packageSource, -980866167);
  assert.deepStrictEqual(summary.additionalPackagesToCook, []);
  assert.strictEqual(summary.preloadDependencyCount, 2);
  assert.strictEqual(summary.namesReferencedFromExportDataCount, 2);

  // NameMap
  const expectedNames = [
    "None",
    "PF_DXT1",
    "/Game/Textures/T_Blocks2_1K_BC1_BC",
    "/Script/CoreUObject",
    "/Script/Engine",
    "Class",
    "Default__Texture2D",
    "Package",
    "T_Blocks2_1K_BC1_BC",
    "Texture2D",
  ];
  assert.deepStrictEqual(uasset.nameMap.map(x => x.name), expectedNames);
  // Name entry hashes are not included in the expected decoded values.

  // ImportMap
  assert.strictEqual(uasset.importMap.length, 3);

  assert.deepStrictEqual(uasset.importMap[0].classPackage, new MinimalName(3, 0));
  assert.deepStrictEqual(uasset.importMap[0].className, new MinimalName(5, 0));
  assert.strictEqual(uasset.importMap[0].outerIndex, -2);
  assert.deepStrictEqual(uasset.importMap[0].objectName, new MinimalName(9, 0));
  assert.strictEqual(uasset.importMap[0].importOptional, false);

  assert.deepStrictEqual(uasset.importMap[1].classPackage, new MinimalName(3, 0));
  assert.deepStrictEqual(uasset.importMap[1].className, new MinimalName(7, 0));
  assert.strictEqual(uasset.importMap[1].outerIndex, 0);
  assert.deepStrictEqual(uasset.importMap[1].objectName, new MinimalName(4, 0));
  assert.strictEqual(uasset.importMap[1].importOptional, false);

  assert.deepStrictEqual(uasset.importMap[2].classPackage, new MinimalName(4, 0));
  assert.deepStrictEqual(uasset.importMap[2].className, new MinimalName(9, 0));
  assert.strictEqual(uasset.importMap[2].outerIndex, -2);
  assert.deepStrictEqual(uasset.importMap[2].objectName, new MinimalName(6, 0));
  assert.strictEqual(uasset.importMap[2].importOptional, false);

  // ExportMap
  assert.strictEqual(uasset.exportMap.length, 1);

  const exportObject = uasset.exportMap[0];
  assert.strictEqual(exportObject.classIndex, -1);
  assert.strictEqual(exportObject.superIndex, 0);
  assert.strictEqual(exportObject.templateIndex, -3);
  assert.strictEqual(exportObject.outerIndex, 0);
  assert.deepStrictEqual(exportObject.objectName, new MinimalName(8, 0));
  assert.strictEqual(exportObject.objectFlags, 3);
  assert.strictEqual(exportObject.serialSize, 3038n);
  assert.strictEqual(exportObject.forcedExport, false);
  assert.strictEqual(exportObject.notForClient, false);
  assert.strictEqual(exportObject.notForServer, false);
  assert.strictEqual(exportObject.isInheritedInstance, false);
  assert.strictEqual(exportObject.packageFlags, 0);
  assert.strictEqual(exportObject.notAlwaysLoadedForEditorGame, true);
  assert.strictEqual(exportObject.isAsset, true);
  assert.strictEqual(exportObject.generatePublicHash, false);
  assert.strictEqual(exportObject.firstExportDependency, 0);
  assert.strictEqual(exportObject.serializationBeforeSerializationDependencies, 0);
  assert.strictEqual(exportObject.createBeforeSerializationDependencies, 0);
  assert.strictEqual(exportObject.serializationBeforeCreateDependencies, 2);
  assert.strictEqual(exportObject.createBeforeCreateDependencies, 0);

  // DependsMap
  assert.deepStrictEqual(uasset.dependsMap, [[]]);

  // PreloadDependencies
  assert.deepStrictEqual(uasset.preloadDependencies, [-1, -3]);

  // DataResourceMap
  const expectedDataResources = [
    {serialSize: 524288n, rawSize: 524288n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialSize: 131072n, rawSize: 131072n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialSize: 32768n, rawSize: 32768n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialSize: 8192n, rawSize: 8192n, bulkDataFlags: expectedUbulkDataFlags, bulkType: BulkType.Ubulk},
    {serialSize: 2048n, rawSize: 2048n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialSize: 512n, rawSize: 512n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialSize: 128n, rawSize: 128n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialSize: 32n, rawSize: 32n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialSize: 8n, rawSize: 8n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialSize: 8n, rawSize: 8n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
    {serialSize: 8n, rawSize: 8n, bulkDataFlags: expectedUexpDataFlags, bulkType: BulkType.Uexp},
  ];

  assert.strictEqual(uasset.dataResourceVersion, ObjectDataResourceVersion.AddedCookedIndex);
  assert.strictEqual(uasset.dataResourceMap.length, expectedDataResources.length);
  for (let i = 0; i < expectedDataResources.length; i++) {
    const actual = uasset.dataResourceMap[i];
    const expected = expectedDataResources[i];

    assert.strictEqual(actual.flags, 0);
    assert.strictEqual(actual.cookedIndex, 0);
    assert.strictEqual(actual.duplicateSerialOffset, -1n);
    assert.strictEqual(actual.serialSize, expected.serialSize);
    assert.strictEqual(actual.rawSize, expected.rawSize);
    assert.strictEqual(actual.outerIndex, 1);
    assert.strictEqual(actual.bulkDataFlags, expected.bulkDataFlags);
    assert.strictEqual(actual.bulkType, expected.bulkType);
  }

  // ======== .uexp ========
  const uexpPath = uassetPath.replace(".uasset", ".uexp");
  const uexpBytes = await readFile(new URL(uexpPath, import.meta.url));
  const uexpReader = new AssetReader(uexpBytes);
  const uexp = UExp.read(uexpReader, version, uasset);

  assert.strictEqual(uexp.exports.length, 1);
  const tex = uexp.exports[0];
  assert.strictEqual(tex.kind, "texture");
  assert.strictEqual(tex.className, "Texture2D");

  assert.strictEqual(tex.serializeMipData, true);
  assert.deepStrictEqual(tex.pixelFormatName, new MinimalName(1, 0));
  assert.strictEqual(tex.importedWidth, 1024);
  assert.strictEqual(tex.importedHeight, 1024);
  assert.strictEqual(tex.packedData, 1);
  assert.strictEqual(tex.pixelFormat, "PF_DXT1");
  assert.strictEqual(tex.firstMipToSerialize, 0);
  assert.strictEqual(tex.mipCount, 11);

  const expectedMips = [
    {inlineDataLength: 0, width: 1024, height: 1024},
    {inlineDataLength: 0, width: 512, height: 512},
    {inlineDataLength: 0, width: 256, height: 256},
    {inlineDataLength: 0, width: 128, height: 128},
    {inlineDataLength: 2048, width: 64, height: 64},
    {inlineDataLength: 512, width: 32, height: 32},
    {inlineDataLength: 128, width: 16, height: 16},
    {inlineDataLength: 32, width: 8, height: 8},
    {inlineDataLength: 8, width: 4, height: 4},
    {inlineDataLength: 8, width: 2, height: 2},
    {inlineDataLength: 8, width: 1, height: 1},
  ];

  assert.strictEqual(tex.mips.length, expectedMips.length);
  for (let i = 0; i < expectedMips.length; i++) {
    const mip: Mip = tex.mips[i]!;
    const expected = expectedMips[i];

    assert.strictEqual(mip.dataResourceIndex, i);
    assert.strictEqual(mip.inlineData.length, expected.inlineDataLength);
    assert.strictEqual(mip.width, expected.width);
    assert.strictEqual(mip.height, expected.height);
    assert.strictEqual(mip.depth, 1);
  }

  assert.strictEqual(tex.isVirtual, false);

  assert.deepStrictEqual(tex.noneName, new MinimalName(0, 0));
});

test("Ad-hoc parsing test", async () => {
  const version = UEVersion.UE5_2;

  const uassetPath = "./assets/ue5_2/T_Blocks_1K_BC1_BC.uasset";
  const uassetBytes = await readFile(new URL(uassetPath, import.meta.url));
  const reader = new AssetReader(uassetBytes);
  const uasset = UAsset.read(reader, version);

  assert.ok(true);
});