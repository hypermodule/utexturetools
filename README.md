# UTextureTools

A web app for making simple texture swap mods for UE5 games. It is inspired by matyalatte's great
[UE4-DDS-Tools](https://github.com/matyalatte/UE4-DDS-Tools), which unfortunately is no longer
maintained. The main addition provided by this app is support for Virtual Textures and UE 5.5–5.7.
The project is open-source (MIT license) and contributions are welcome. Some advanced texture types
(like texture arrays and cubemaps) are not supported.

If you find a case that this tool can't handle, remember that you can use UE itself to make texture 
mods; you can learn about this in [Dmgvol's great modding guide](https://github.com/Dmgvol/UE_Modding) 
(which also links to a very helpful UE modding discord). Happy modding!

## Prerequisites

The normal build and test workflow requires [Node.js](https://nodejs.org/) 22.18.0 or newer and npm. No native
build tools are needed because the compiled WebAssembly codec is checked into the repository.

## Building

Install the dependencies and build the browser application using the checked-in
`wasm/bcencdec.wasm` file:

```sh
npm ci
npm run build:browser
```

The compiled JavaScript and WebAssembly are written to `dist/`. To serve the application,
include the root `index.html`, `style.css`, and `vendor/jszip/` alongside that directory.

### Rebuilding the WebAssembly codec

If you change the codec or its WebAssembly build configuration, install CMake and Emscripten
(the project currently uses Emscripten 6.0.8) and run:

```sh
npm ci
npm run build:wasm
npm run build:browser
```

The first build command regenerates `wasm/bcencdec.wasm`; the second includes the regenerated
artifact in `dist/`.

## Testing

After installing the dependencies with `npm ci`, run the test suite with:

```sh
npm test
```

Run the TypeScript type checker separately with:

```sh
npm run typecheck
```
