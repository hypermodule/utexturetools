import type {ProgressCallback} from "../util.ts";
import type {BcEncodeOptions} from "./wasm.ts";
import type {BcFormat} from "../pixel-formats.ts";
import type {
  WorkerRequest,
  WorkerResponse,
  DecodeRequest,
  EncodeRequest,
} from "./protocol.ts";

type CodecWorkerRequestWithoutId = Omit<DecodeRequest, "id"> | Omit<EncodeRequest, "id">;

interface PendingOperation {
  readonly resolve: (output: Uint8Array) => void;
  readonly reject: (error: Error) => void;
  readonly onProgress: ProgressCallback | undefined;
}

export class BcWasmWorker {
  readonly worker: Worker;
  private nextId = 1;
  private readonly pending = new Map<number, PendingOperation>();
  private terminalError: Error | undefined;

  constructor(
    workerUrl: URL = new URL("./host.js", import.meta.url),
    wasmUrl?: URL,
  ) {
    const url = new URL(workerUrl);

    if (wasmUrl !== undefined) {
      url.searchParams.set("wasm", wasmUrl.href);
    }

    this.worker = new Worker(url, {type: "module"});

    this.worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      this.handleMessage(event.data);
    });

    this.worker.addEventListener("error", event => {
      this.fail(new Error(event.message || "The BC codec worker failed."));
    });
  }

  decode(
    format: BcFormat,
    input: Uint8Array,
    width: number,
    height: number,
    onProgress?: ProgressCallback,
  ): Promise<Uint8Array> {
    return this.request({kind: "decode", format, input, width, height}, onProgress);
  }

  encode(
    format: BcFormat,
    rgba: Uint8Array,
    width: number,
    height: number,
    options: BcEncodeOptions = {},
  ): Promise<Uint8Array> {
    const {onProgress, ...workerOptions} = options;

    return this.request(
      {kind: "encode", format, input: rgba, width, height, options: workerOptions},
      onProgress,
    );
  }

  terminate(): void {
    this.terminalError ??= new Error("The BC codec worker was terminated.");
    this.worker.terminate();
    this.rejectAll(this.terminalError);
  }

  private request(
    request: CodecWorkerRequestWithoutId,
    onProgress: ProgressCallback | undefined,
  ): Promise<Uint8Array> {
    if (this.terminalError !== undefined) {
      return Promise.reject(this.terminalError);
    }

    const id = this.nextId++;
    const input = request.input.slice();
    const message = {...request, id, input} as WorkerRequest;

    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject, onProgress});
      try {
        this.worker.postMessage(message, [input.buffer]);
      } catch (error: unknown) {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private handleMessage(message: WorkerResponse): void {
    const operation = this.pending.get(message.id);
    if (operation === undefined) {
      return;
    }

    if (message.kind === "progress") {
      operation.onProgress?.(message.completed, message.total);
    } else if (message.kind === "result") {
      this.pending.delete(message.id);
      operation.resolve(message.output);
    } else {
      this.pending.delete(message.id);
      operation.reject(new Error(message.message));
    }
  }

  private rejectAll(error: Error): void {
    for (const operation of this.pending.values()) {
      operation.reject(error);
    }

    this.pending.clear();
  }

  private fail(error: Error): void {
    this.terminalError ??= error;
    this.rejectAll(this.terminalError);
  }
}
