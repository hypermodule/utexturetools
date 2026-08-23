import {BcWasm} from "./wasm.ts";
import type {WorkerRequest, WorkerResponse} from "./protocol.ts";

interface WorkerScope {
  readonly location: Location;
  addEventListener(type: "message", listener: (event: MessageEvent<WorkerRequest>) => void): void;
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;
const configuredWasmUrl = new URL(scope.location.href).searchParams.get("wasm");
const wasmPromise = configuredWasmUrl === null ? BcWasm.load() : BcWasm.load(new URL(configuredWasmUrl));

scope.addEventListener("message", event => {
  void processRequest(event.data);
});

async function processRequest(request: WorkerRequest): Promise<void> {
  try {
    const wasm = await wasmPromise;

    const onProgress = (completed: number, total: number): void => {
      scope.postMessage({id: request.id, kind: "progress", completed, total});
    };

    const output = request.kind === "decode" ?
      wasm.decode(request.format, request.input, request.width, request.height, onProgress) :
      wasm.encode(request.format, request.input, request.width, request.height, {
        ...request.options,
        onProgress,
      });

    scope.postMessage({id: request.id, kind: "result", output}, [output.buffer]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    scope.postMessage({id: request.id, kind: "error", message});
  }
}
