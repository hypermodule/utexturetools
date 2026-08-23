import type {ProgressCallback} from "../util.ts";
import {
  type BcFormat,
  getBcFormatLayout,
  getTextureEncodedByteLength,
} from "../pixel-formats.ts";

const MAX_WASM_BYTE_LENGTH = 0xffff_ffff;
const DEFAULT_QUALITY = 10;

export interface BcEncodeOptions {
  readonly quality?: number; // from 0 (fastest) through 18 (highest quality)
  readonly perceptual?: boolean; // Use perceptual color weighting for BC7?
  readonly onProgress?: ProgressCallback;
}

interface WasmExports extends WebAssembly.Exports {
  readonly memory: WebAssembly.Memory;
  readonly _initialize: () => void;
  readonly codec_allocate: (length: number) => number;
  readonly codec_deallocate: (pointer: number) => void;
  readonly codec_initialize: () => void;
  readonly codec_decode: (
    format: number, input: number, inputLength: number, output: number,
    outputLength: number, width: number, height: number,
  ) => number;
  readonly codec_encode: (
    format: number, input: number, inputLength: number, output: number,
    outputLength: number, width: number, height: number, quality: number, flags: number,
  ) => number;
}

const FORMAT_IDS: Readonly<Record<BcFormat, number>> = {
  bc1: 1, bc2: 2, bc3: 3, bc4: 4, bc5: 5, bc7: 7,
};

export class BcWasm {
  readonly exports: WasmExports;
  progressCallback: ProgressCallback | undefined;
  isProcessing = false;

  private constructor(exports: WasmExports) {
    this.exports = exports;
  }

  static async load(url: URL = new URL("./bcencdec.wasm", import.meta.url)): Promise<BcWasm> {
    let module: BcWasm | undefined;
    const imports: WebAssembly.Imports = {
      env: {
        report_progress(completed: number, total: number): void {
          module?.progressCallback?.(completed, total);
        },
        emscripten_notify_memory_growth(): void {
          // Views are created only after allocations, so none need refreshing here.
        },
      },
    };

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Could not load the WebAssembly module (${response.status} ${response.statusText}).`,
      );
    }

    const instantiated = await WebAssembly.instantiate(await response.arrayBuffer(), imports);
    const exports = instantiated.instance.exports;
    if (!hasExpectedExports(exports)) {
      throw new Error("The WebAssembly module does not expose the expected texture-processing API.");
    }

    module = new BcWasm(exports);
    exports._initialize();
    exports.codec_initialize();
    return module;
  }

  /** Decode block-compressed data into row-major RGBA8 pixels. */
  decode(
    format: BcFormat,
    input: Uint8Array,
    width: number,
    height: number,
    onProgress?: ProgressCallback,
  ): Uint8Array {
    const {compressedLength, rgbaLength} = getBufferLengths(format, width, height);
    if (input.byteLength !== compressedLength) {
      throw new RangeError(
        `The ${format.toUpperCase()} data has ${input.byteLength} bytes, ` +
        `but ${compressedLength} bytes are required.`,
      );
    }

    let operation = (inputPointer: number, outputPointer: number) =>
      this.exports.codec_decode(
        FORMAT_IDS[format], inputPointer, compressedLength, outputPointer, rgbaLength, width, height
      );

    return this.process(`decode ${format.toUpperCase()}`, input, rgbaLength, onProgress, operation);
  }

  /**
   * Encode row-major RGBA8 pixels into the requested block format.
   *
   * Partial edge blocks repeat their final row/column. BC1 treats alpha below
   * 128 as transparent; BC4 and BC5 consume the R and RG channels respectively.
   */
  encode(
    format: BcFormat,
    rgba: Uint8Array,
    width: number,
    height: number,
    options: BcEncodeOptions = {},
  ): Uint8Array {
    const {compressedLength, rgbaLength} = getBufferLengths(format, width, height);
    if (rgba.byteLength !== rgbaLength) {
      throw new RangeError(
        `The RGBA input has ${rgba.byteLength} bytes, but ${rgbaLength} bytes are required.`,
      );
    }

    const quality = options.quality ?? DEFAULT_QUALITY;
    if (!Number.isInteger(quality) || quality < 0 || quality > 18) {
      throw new RangeError("Encoder quality must be an integer from 0 through 18.");
    }

    const flags = options.perceptual === true ? 1 : 0;

    let operation = (inputPointer: number, outputPointer: number) =>
      this.exports.codec_encode(
        FORMAT_IDS[format], inputPointer, rgbaLength, outputPointer, compressedLength,
        width, height, quality, flags
      );

    return this.process(
      `encode ${format.toUpperCase()}`,
      rgba,
      compressedLength,
      options.onProgress,
      operation
    );
  }

  private process(
    description: string,
    input: Uint8Array,
    outputLength: number,
    onProgress: ProgressCallback | undefined,
    operation: (inputPointer: number, outputPointer: number) => number,
  ): Uint8Array {
    if (this.isProcessing) {
      throw new Error("A WebAssembly operation is already running.");
    }

    if (input.byteLength + outputLength > MAX_WASM_BYTE_LENGTH) {
      throw new RangeError("The codec input and output are too large for Wasm32 linear memory.");
    }

    this.isProcessing = true;
    this.progressCallback = onProgress;
    let inputPointer = 0;
    let outputPointer = 0;

    try {
      inputPointer = this.allocate(input.byteLength, "input");
      outputPointer = this.allocate(outputLength, "output");
      new Uint8Array(this.exports.memory.buffer, inputPointer, input.byteLength).set(input);

      const status = operation(inputPointer, outputPointer);

      if (status === 2) {
        throw new Error(`Could not ${description}: the compressed data contains an invalid block.`);
      }

      if (status !== 0) {
        throw new Error(`Could not ${description}: the codec rejected the arguments.`);
      }

      return new Uint8Array(this.exports.memory.buffer, outputPointer, outputLength).slice();
    } finally {
      this.progressCallback = undefined;
      this.isProcessing = false;

      if (outputPointer !== 0) {
        this.exports.codec_deallocate(outputPointer);
      }

      if (inputPointer !== 0) {
        this.exports.codec_deallocate(inputPointer);
      }
    }
  }

  private allocate(length: number, label: string): number {
    const pointer = this.exports.codec_allocate(length) >>> 0;
    if (pointer === 0) {
      throw new Error(`The WebAssembly module could not allocate the codec ${label} buffer.`);
    }
    return pointer;
  }
}

function getBufferLengths(format: BcFormat, width: number, height: number): {
  compressedLength: number;
  rgbaLength: number;
} {
  const pixelCount = width * height;

  if (!Number.isSafeInteger(pixelCount) || pixelCount > MAX_WASM_BYTE_LENGTH / 4) {
    throw new RangeError("The RGBA image is too large for Wasm32 linear memory.");
  }

  const compressedLength = getTextureEncodedByteLength(getBcFormatLayout(format), width, height);
  if (!Number.isSafeInteger(compressedLength) || compressedLength > MAX_WASM_BYTE_LENGTH) {
    throw new RangeError(
      `The ${format.toUpperCase()} image is too large for Wasm32 linear memory.`
    );
  }

  return {compressedLength, rgbaLength: pixelCount * 4};
}

function hasExpectedExports(exports: WebAssembly.Exports): exports is WasmExports {
  return exports.memory instanceof WebAssembly.Memory &&
    typeof exports._initialize === "function" &&
    typeof exports.codec_allocate === "function" &&
    typeof exports.codec_deallocate === "function" &&
    typeof exports.codec_initialize === "function" &&
    typeof exports.codec_decode === "function" &&
    typeof exports.codec_encode === "function";
}
