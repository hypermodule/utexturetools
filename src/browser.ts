import {decodeTextureMip, reconstructNormalMapBlue} from "./texture/decoding.ts";
import {getTextureBcFormat} from "./texture/formats.ts";
import {replaceTexture} from "./texture/replacement.ts";
import {parseAsset} from "./ue/cooked-asset.ts";
import type {CookedAsset, CookedAssetBundle} from "./ue/cooked-asset.ts";
import type {TextureExport} from "./ue/uexp.ts";
import {UEVersion} from "./ue/versioning.ts";
import {BcWasmWorker} from "./wasm/worker.ts";

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing #${id} element.`);
  }

  return element as T;
}

const versionSelect = getElement<HTMLSelectElement>("version");
const fileInput = getElement<HTMLInputElement>("files");
const dropZone = getElement<HTMLLabelElement>("drop-zone");
const mipSelect = getElement<HTMLSelectElement>("mip");
const normalMapControl = getElement<HTMLElement>("normal-map-control");
const isNormalMapCheckbox = getElement<HTMLInputElement>("is-normal-map");
const canvas = getElement<HTMLCanvasElement>("preview");
const textureDetails = getElement<HTMLElement>("texture-details");
const replacementInput = getElement<HTMLInputElement>("replacement-png");
const selectPngButton = getElement<HTMLButtonElement>("select-png");
const qualityControl = getElement<HTMLLabelElement>("quality-control");
const encodingQuality = getElement<HTMLInputElement>("encoding-quality");
const encodingQualityValue = getElement<HTMLOutputElement>("encoding-quality-value");
const downloadButton = getElement<HTMLButtonElement>("download");
const progressPanel = getElement<HTMLElement>("progress-panel");
const progressLabel = getElement<HTMLElement>("progress-label");
const progressValue = getElement<HTMLElement>("progress-value");
const operationProgress = getElement<HTMLProgressElement>("operation-progress");
const messages = getElement<HTMLUListElement>("messages");
const assetName = getElement<HTMLElement>("asset-name");
const dropMessage = getElement<HTMLElement>("drop-message");
const fileItems = {
  uasset: getElement<HTMLLIElement>("file-uasset"),
  uexp: getElement<HTMLLIElement>("file-uexp"),
  ubulk: getElement<HTMLLIElement>("file-ubulk"),
} as const;

const state: BrowserState = {
  originalAsset: undefined,
  parsedAsset: undefined,
  texture: undefined,
  inputFiles: [],
  selectedFiles: undefined,
  editedFiles: undefined,
  replacementImage: undefined,
  canReplaceTexture: false,
  operationInProgress: false,
};
let bcWasmWorker: BcWasmWorker | undefined;
let nextProgressId = 1;
let activeProgressId: number | undefined;

versionSelect.add(new Option("Select UE version", "", true, true));

for (const [value, label] of [
  // [UEVersion.UE5_0, "5.0"],
  // [UEVersion.UE5_1, "5.1"],
  [UEVersion.UE5_2, "5.2"],
  [UEVersion.UE5_3, "5.3"],
  [UEVersion.UE5_4, "5.4"],
  [UEVersion.UE5_5, "5.5"],
  [UEVersion.UE5_6, "5.6"],
  [UEVersion.UE5_7, "5.7"],
] as const) {
  versionSelect.add(new Option(label, String(value)));
}
versionSelect.value = "";
setAssetUploadEnabled(false);
setReplacementEnabled(false);

fileInput.addEventListener("change", () => {
  if (fileInput.files !== null) {
    void loadFiles([...fileInput.files]);
  }
});

selectPngButton.addEventListener("click", () => {
  replacementInput.click();
});

replacementInput.addEventListener("change", () => {
  const png = getPngFile(replacementInput.files);
  if (png !== undefined) {
    void applyReplacementPng(png);
  }
});

encodingQuality.addEventListener("input", () => {
  encodingQualityValue.value = encodingQuality.value;
});

encodingQuality.addEventListener("change", () => {
  const image = state.replacementImage;
  if (image !== undefined) {
    void reencodeReplacement(image, Number(encodingQuality.value));
  }
});

dropZone.addEventListener("dragover", event => {
  if (!isVersionSelected()) {
    return;
  }

  event.preventDefault();
  dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-dragging");
});

dropZone.addEventListener("drop", event => {
  if (!isVersionSelected()) {
    return;
  }

  event.preventDefault();
  dropZone.classList.remove("is-dragging");

  if (event.dataTransfer !== null) {
    void loadFiles([...event.dataTransfer.files]);
  }
});

downloadButton.addEventListener("click", () => {
  void downloadEditedAsset();
});

mipSelect.addEventListener("change", renderSelectedMip);
isNormalMapCheckbox.addEventListener("change", renderSelectedMip);

versionSelect.addEventListener("change", () => {
  const versionSelected = isVersionSelected();
  setAssetUploadEnabled(versionSelected);

  if (versionSelected && state.inputFiles.length > 0) {
    void loadFiles(state.inputFiles);
  }
});

async function loadFiles(files: File[]): Promise<void> {
  state.inputFiles = files;
  state.selectedFiles = undefined;
  clearReplacement();
  setReplacementEnabled(false);
  updateFileItems(files);
  setFileItemsEdited(false);
  setAssetName(undefined);
  configureNormalMapControl(undefined);

  try {
    const selected = chooseAssetFiles([...files]);
    state.selectedFiles = selected;
    setAssetName(selected.baseName);
    addMessage(`Reading ${selected.uasset.name}…`, "info");

    const [uasset, uexp, ubulk, uptnl] = await Promise.all([
      readFile(selected.uasset),
      readFile(selected.uexp),
      selected.ubulk === undefined ? undefined : readFile(selected.ubulk),
      selected.uptnl === undefined ? undefined : readFile(selected.uptnl),
    ]);
    const bundle: CookedAssetBundle = {
      uasset,
      uexp,
      ...(ubulk === undefined ? {} : {ubulk}),
      ...(uptnl === undefined ? {} : {uptnl}),
    };

    const asset = parseAsset(bundle, Number(versionSelect.value) as UEVersion);
    const parsedTexture = asset.getTextureExport();

    state.originalAsset = asset;
    state.parsedAsset = asset;
    state.texture = parsedTexture;
    populateMipSelect(parsedTexture);
    configureNormalMapControl(parsedTexture, true);
    await renderMip(asset, parsedTexture, 0);

    setReplacementEnabled(true);

    addMessage(`Loaded ${selected.baseName}`, "success");
  } catch (error: unknown) {
    state.originalAsset = undefined;
    state.parsedAsset = undefined;
    state.texture = undefined;
    state.selectedFiles = undefined;
    setReplacementEnabled(false);
    mipSelect.replaceChildren();
    mipSelect.disabled = true;
    configureNormalMapControl(undefined);
    clearPreview();
    showError(error instanceof Error ? error.message : String(error));
  }
}

function chooseAssetFiles(files: File[]): SelectedFiles {
  const groups = new Map<string, Partial<Record<AssetExtension, File>>>();

  for (const file of files) {
    const extension = getExtension(file.name);
    if (extension === undefined) {
      continue;
    }

    const baseName = file.name.slice(0, -(extension.length + 1));
    const group = groups.get(baseName) ?? {};
    group[extension] = file;
    groups.set(baseName, group);
  }

  const candidate = [...groups.entries()].find(([, group]) => (
    group.uasset !== undefined && group.uexp !== undefined
  ));

  if (candidate === undefined) {
    throw new Error("Drop a matching .uasset and .uexp pair (and its optional .ubulk file).");
  }

  const [baseName, group] = candidate;
  return {
    baseName,
    uasset: group.uasset as File,
    uexp: group.uexp as File,
    ...(group.ubulk === undefined ? {} : {ubulk: group.ubulk}),
    ...(group.uptnl === undefined ? {} : {uptnl: group.uptnl}),
  };
}

function populateMipSelect(parsedTexture: TextureExport): void {
  mipSelect.replaceChildren();

  const virtualTexture = parsedTexture.virtualTextureData;
  const mips = virtualTexture === null
    ? parsedTexture.mips.map(mip => ({width: mip.width, height: mip.height}))
    : Array.from({length: virtualTexture.numMips}, (_, index) => ({
      width: Math.max(1, Math.floor(virtualTexture.width / 2 ** index)),
      height: Math.max(1, Math.floor(virtualTexture.height / 2 ** index)),
    }));

  mips.forEach((mip, index) => {
    mipSelect.add(new Option(
      `Mip ${index} · ${mip.width} × ${mip.height}`,
      String(index),
    ));
  });

  mipSelect.value = "0";
  mipSelect.disabled = mips.length === 0;
}

function configureNormalMapControl(
  texture: TextureExport | undefined,
  reset = false,
): void {
  const isBc5 = texture !== undefined && texture.resolvePixelFormat() === "PF_BC5";
  normalMapControl.hidden = !isBc5;
  if (isBc5 && reset) {
    isNormalMapCheckbox.checked = true;
  }
}

function renderSelectedMip(): void {
  if (state.parsedAsset !== undefined && state.texture !== undefined) {
    void renderMip(state.parsedAsset, state.texture, Number(mipSelect.value)).catch(
      (error: unknown) => {
        showError(error instanceof Error ? error.message : String(error));
      },
    );
  }
}

async function renderMip(
  asset: CookedAsset,
  parsedTexture: TextureExport,
  mipIndex: number,
): Promise<void> {
  const pixelFormat = parsedTexture.resolvePixelFormat();
  const codecs = getTextureBcFormat(pixelFormat) === undefined ? undefined : loadBcWasm();

  const progressId = beginProgress(`Decoding mip ${mipIndex}…`);

  let decoded;
  try {
    decoded = await decodeTextureMip(asset, mipIndex, codecs, (completed, total) => {
      reportProgress(progressId, completed, total);
    });
  } finally {
    endProgress(progressId);
  }

  // BC5 throws away blue channel, so we reconstruct it here
  if (pixelFormat === "PF_BC5" && isNormalMapCheckbox.checked) {
    reconstructNormalMapBlue(decoded.rgba);
  }

  canvas.width = decoded.width;
  canvas.height = decoded.height;

  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("The browser could not create a 2D canvas context.");
  }

  const image = context.createImageData(decoded.width, decoded.height);
  image.data.set(decoded.rgba);

  context.putImageData(image, 0, 0);
  textureDetails.textContent =
    `${pixelFormat} · ${decoded.width} × ${decoded.height} · ` +
    formatBytes(decoded.encodedByteLength);
}

function loadBcWasm(): BcWasmWorker {
  bcWasmWorker ??= new BcWasmWorker();
  return bcWasmWorker;
}

async function readFile(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

function clearPreview(): void {
  canvas.width = 1;
  canvas.height = 1;
  canvas.getContext("2d")?.clearRect(0, 0, 1, 1);
  textureDetails.textContent = "No texture loaded";
}

function showError(message: string): void {
  addMessage(message, "error");
}

function beginProgress(label: string): number {
  const id = nextProgressId++;
  activeProgressId = id;
  progressPanel.hidden = false;
  progressLabel.textContent = label;
  progressValue.textContent = "Working…";
  operationProgress.removeAttribute("value");
  return id;
}

function renameProgress(id: number, label: string): void {
  if (id === activeProgressId) {
    progressLabel.textContent = label;
  }
}

function reportProgress(id: number, completed: number, total: number): void {
  if (id !== activeProgressId) {
    return;
  }

  const rawPercent = total <= 0 ? 100 : completed / total * 100;
  const percent = Math.max(0, Math.min(100, Math.floor(rawPercent)));
  operationProgress.value = percent;
  progressValue.textContent = `${percent}%`;
}

function endProgress(id: number): void {
  if (id !== activeProgressId) {
    return;
  }

  activeProgressId = undefined;
  progressPanel.hidden = true;
}

function addMessage(message: string, kind: MessageKind): void {
  const item = document.createElement("li");
  item.className = `message message-${kind}`;

  const icon = document.createElement("span");
  icon.className = "message-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = kind === "success" ? "✓" : kind === "error" ? "!" : "ℹ";

  const text = document.createElement("span");
  text.textContent = message;

  item.append(icon, text);
  messages.append(item);
  item.scrollIntoView({block: "nearest"});
}

function updateFileItems(files: readonly File[]): void {
  const supplied = new Map<AssetExtension, File>();

  for (const file of files) {
    const extension = getExtension(file.name);
    if (extension !== undefined) {
      supplied.set(extension, file);
    }
  }

  for (const extension of Object.keys(fileItems) as Array<keyof typeof fileItems>) {
    const file = supplied.get(extension);
    const item = fileItems[extension];
    const mark = item.querySelector<HTMLElement>(".file-mark");

    item.classList.toggle("is-supplied", file !== undefined);
    if (mark !== null) {
      mark.textContent = file === undefined ? "○" : "✓";
    }
  }
}

function setFileItemsEdited(edited: boolean): void {
  for (const extension of Object.keys(fileItems) as Array<keyof typeof fileItems>) {
    const name = fileItems[extension].querySelector<HTMLElement>(".file-name");
    if (name !== null) {
      name.textContent = `.${extension}${edited ? "*" : ""}`;
    }
  }
}

function setAssetName(name: string | undefined): void {
  assetName.textContent = name ?? "No asset selected";
  assetName.classList.toggle("is-empty", name === undefined);
}

function setAssetUploadEnabled(enabled: boolean): void {
  fileInput.disabled = !enabled;
  dropZone.classList.toggle("is-disabled", !enabled);
  dropZone.setAttribute("aria-disabled", String(!enabled));
  dropMessage.textContent = enabled ? "Supply asset files" : "Select UE version first";
}

function isVersionSelected(): boolean {
  return versionSelect.value !== "";
}

function getPngFile(files: FileList | null | undefined): File | undefined {
  return files === null || files === undefined
    ? undefined
    : [...files].find(file => file.type === "image/png" || /\.png$/i.test(file.name));
}

function clearReplacement(): void {
  state.editedFiles = undefined;
  state.replacementImage = undefined;
  replacementInput.value = "";
  updateControls();
}

function setReplacementEnabled(enabled: boolean): void {
  state.canReplaceTexture = enabled;
  updateControls();
}

function updateControls(): void {
  replacementInput.disabled = !state.canReplaceTexture || state.operationInProgress;
  selectPngButton.disabled = !state.canReplaceTexture || state.operationInProgress;
  qualityControl.hidden = state.replacementImage === undefined;
  encodingQuality.disabled = !state.canReplaceTexture || state.operationInProgress;
  downloadButton.disabled = state.operationInProgress || state.editedFiles === undefined ||
    state.selectedFiles === undefined;
  if (!state.operationInProgress) {
    downloadButton.textContent = state.editedFiles === undefined
      ? "Download"
      : "Download edited asset";
  }
}

async function applyReplacementPng(png: File): Promise<void> {
  if (state.operationInProgress) {
    return;
  }

  state.operationInProgress = true;
  updateControls();

  const progressId = beginProgress("Preparing replacement PNG…");
  try {
    const decoded = await decodePng(png);
    const image: ReplacementImage = {...decoded, fileName: png.name};
    const quality = Number(encodingQuality.value);
    state.replacementImage = image;
    updateControls();
    renameProgress(progressId, "Replacing texture…");
    await replaceTextureWithImage(image, quality, progressId);
    addMessage(`Applied ${png.name} at quality ${quality}`, "success");
  } catch (error: unknown) {
    showError(error instanceof Error ? error.message : String(error));
  } finally {
    endProgress(progressId);
    state.operationInProgress = false;
    updateControls();
  }
}

async function reencodeReplacement(image: ReplacementImage, quality: number): Promise<void> {
  if (state.operationInProgress) {
    return;
  }

  state.operationInProgress = true;
  updateControls();

  const progressId = beginProgress("Re-encoding texture…");
  try {
    await replaceTextureWithImage(image, quality, progressId);
    addMessage(`Re-encoded ${image.fileName} at quality ${quality}`, "success");
  } catch (error: unknown) {
    showError(error instanceof Error ? error.message : String(error));
  } finally {
    endProgress(progressId);
    state.operationInProgress = false;
    updateControls();
  }
}

async function replaceTextureWithImage(
  image: ReplacementImage,
  quality: number,
  progressId: number,
): Promise<void> {
  const asset = state.originalAsset;
  const files = state.selectedFiles;
  if (asset === undefined || files === undefined) {
    throw new Error("Load a texture asset before selecting a replacement PNG.");
  }

  const textureExport = asset.getTextureExport();
  const pixelFormat = textureExport.resolvePixelFormat();
  const encoder = getTextureBcFormat(pixelFormat) === undefined ? undefined : loadBcWasm();
  const output = await replaceTexture(asset, image.rgba, image.width, image.height, encoder, {
    quality,
    onProgress: (completed, total) => {
      reportProgress(progressId, completed, total);
    },
  });

  const editedAsset = parseAsset(output, asset.version);
  const editedTexture = editedAsset.getTextureExport();
  state.parsedAsset = editedAsset;
  state.texture = editedTexture;
  populateMipSelect(editedTexture);
  await renderMip(editedAsset, editedTexture, 0);
  state.editedFiles = output;
  setFileItemsEdited(true);
}

async function downloadEditedAsset(): Promise<void> {
  const output = state.editedFiles;
  const files = state.selectedFiles;
  if (output === undefined || files === undefined || state.operationInProgress) {
    return;
  }

  state.operationInProgress = true;
  updateControls();

  try {
    downloadButton.textContent = "Creating ZIP…";
    const zip = createZip(files.baseName, output);
    const blob = await zip.generateAsync({type: "blob"});
    saveBlob(blob, `${files.baseName}_edited.zip`);
    addMessage(`Created ${files.baseName}_edited.zip`, "success");
  } catch (error: unknown) {
    showError(error instanceof Error ? error.message : String(error));
  } finally {
    state.operationInProgress = false;
    updateControls();
  }
}

async function decodePng(file: File): Promise<{width: number; height: number; rgba: Uint8Array}> {
  const bitmap = await createImageBitmap(file);
  try {
    const decodeCanvas = document.createElement("canvas");
    decodeCanvas.width = bitmap.width;
    decodeCanvas.height = bitmap.height;
    const context = decodeCanvas.getContext("2d", {willReadFrequently: true});
    if (context === null) {
      throw new Error("The browser could not create a canvas to decode the PNG.");
    }

    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return {width: bitmap.width, height: bitmap.height, rgba: Uint8Array.from(pixels.data)};
  } finally {
    bitmap.close();
  }
}

function createZip(baseName: string, files: CookedAssetBundle): JSZipArchive {
  if (window.JSZip === undefined) {
    throw new Error("The ZIP library did not load.");
  }

  const zip = new window.JSZip();
  zip.file(`${baseName}.uasset`, files.uasset);
  zip.file(`${baseName}.uexp`, files.uexp);
  if (files.ubulk !== undefined) {
    zip.file(`${baseName}.ubulk`, files.ubulk);
  }
  if (files.uptnl !== undefined) {
    zip.file(`${baseName}.uptnl`, files.uptnl);
  }
  return zip;
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function getExtension(fileName: string): AssetExtension | undefined {
  const match = /\.([^.]+)$/.exec(fileName);
  const extension = match?.[1]?.toLowerCase();

  switch (extension) {
    case "uasset":
    case "uexp":
    case "ubulk":
    case "uptnl":
      return extension;
    default:
      return undefined;
  }
}

type AssetExtension = "uasset" | "uexp" | "ubulk" | "uptnl";
type MessageKind = "info" | "success" | "error";

interface BrowserState {
  originalAsset: CookedAsset | undefined;
  parsedAsset: CookedAsset | undefined;
  texture: TextureExport | undefined;
  inputFiles: File[];
  selectedFiles: SelectedFiles | undefined;
  editedFiles: CookedAssetBundle | undefined;
  replacementImage: ReplacementImage | undefined;
  canReplaceTexture: boolean;
  operationInProgress: boolean;
}

interface ReplacementImage {
  readonly fileName: string;
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

interface SelectedFiles {
  readonly baseName: string;
  readonly uasset: File;
  readonly uexp: File;
  readonly ubulk?: File;
  readonly uptnl?: File;
}

interface JSZipArchive {
  file(name: string, data: Uint8Array): this;
  generateAsync(options: {readonly type: "blob"}): Promise<Blob>;
}

interface JSZipConstructor {
  new(): JSZipArchive;
}

declare global {
  interface Window {
    readonly JSZip?: JSZipConstructor;
  }
}
