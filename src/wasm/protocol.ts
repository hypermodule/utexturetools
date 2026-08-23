import type {BcEncodeOptions} from "./wasm.ts";
import type {BcFormat} from "../pixel-formats.ts";

export interface DecodeRequest {
  readonly id: number;
  readonly kind: "decode";
  readonly format: BcFormat;
  readonly input: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export interface EncodeRequest {
  readonly id: number;
  readonly kind: "encode";
  readonly format: BcFormat;
  readonly input: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly options: Pick<BcEncodeOptions, "quality" | "perceptual">;
}

export type WorkerRequest = DecodeRequest | EncodeRequest;

export type WorkerResponse =
  | {readonly id: number; readonly kind: "progress"; readonly completed: number; readonly total: number}
  | {readonly id: number; readonly kind: "result"; readonly output: Uint8Array}
  | {readonly id: number; readonly kind: "error"; readonly message: string};
