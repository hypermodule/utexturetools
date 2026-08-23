import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const buildDirectory = fileURLToPath(new URL("../wasm/build/", import.meta.url));
const outputDirectory = fileURLToPath(new URL("../wasm/", import.meta.url));
const emscriptenCache =
    process.env.EM_CACHE ?? fileURLToPath(new URL("../wasm/.emcache/", import.meta.url));
const environment = {...process.env, EM_CACHE: emscriptenCache};

run("emcmake", [
  "cmake",
  "-S", "wasm",
  "-B", buildDirectory,
  "-DCMAKE_BUILD_TYPE=Release",
  `-DBCENCDEC_OUTPUT_DIRECTORY=${outputDirectory}`,
], environment);
run("cmake", ["--build", buildDirectory, "--parallel"], environment);

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
