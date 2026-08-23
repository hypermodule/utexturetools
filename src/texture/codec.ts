import type {ProgressCallback} from "../util.ts";
import type {BcEncodeOptions} from "../wasm/wasm.ts";
import type {BcFormat} from "../pixel-formats.ts";

export interface TextureDecoder {
  decode(
    format: BcFormat,
    input: Uint8Array,
    width: number,
    height: number,
    onProgress?: ProgressCallback,
  ): Uint8Array | Promise<Uint8Array>;
}

export interface TextureEncoder {
  encode(
    format: BcFormat,
    rgba: Uint8Array,
    width: number,
    height: number,
    options?: BcEncodeOptions,
  ): Uint8Array | Promise<Uint8Array>;
}
