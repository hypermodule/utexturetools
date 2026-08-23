import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {test} from "node:test";

import {loadWasm, readPpmPixels} from "./util.ts";
import type {BcFormat} from "../src/pixel-formats.ts";

test("decodes BC1 color interpolation and transparency", async () => {
  const wasm = await loadWasm();

  // A four-color block with one pixel for each palette entry in every row.
  const fourColorBlock = Uint8Array.of(
    0xff, 0xff, // white endpoint
    0x00, 0x00, // black endpoint
    0xe4, 0xe4, 0xe4, 0xe4,
  );
  assert.deepStrictEqual(wasm.decode("bc1", fourColorBlock, 4, 4), Uint8Array.of(
    255, 255, 255, 255, 0, 0, 0, 255, 170, 170, 170, 255, 85, 85, 85, 255,
    255, 255, 255, 255, 0, 0, 0, 255, 170, 170, 170, 255, 85, 85, 85, 255,
    255, 255, 255, 255, 0, 0, 0, 255, 170, 170, 170, 255, 85, 85, 85, 255,
    255, 255, 255, 255, 0, 0, 0, 255, 170, 170, 170, 255, 85, 85, 85, 255,
  ));

  // Reversing the endpoint order selects BC1's three-color mode. Selector 3
  // is transparent in RGBA output.
  const transparentBlock = Uint8Array.of(
    0x00, 0x00,
    0xff, 0xff,
    0xff, 0xff, 0xff, 0xff,
  );
  assert.deepStrictEqual(wasm.decode("bc1", transparentBlock, 1, 1), Uint8Array.of(0, 0, 0, 0));
});

test("decodes the BC1 sample image and reports block progress", async () => {
  const wasm = await loadWasm();
  const dds = new Uint8Array(await readFile(new URL("./assets/bc/blocks_bc1.dds", import.meta.url)));
  const ppm = new Uint8Array(await readFile(new URL("./assets/bc/blocks.ppm", import.meta.url)));
  const ddsHeader = new DataView(dds.buffer, dds.byteOffset, dds.byteLength);

  assert.equal(new TextDecoder().decode(dds.subarray(0, 4)), "DDS ");
  const width = ddsHeader.getUint32(12, true);
  const height = ddsHeader.getUint32(16, true);
  assert.equal(width, 1024);
  assert.equal(height, 1024);

  const ppmPixels = readPpmPixels(ppm, width, height);
  const progress: Array<readonly [completed: number, total: number]> = [];
  const decoded = wasm.decode(
    "bc1",
    dds.subarray(128),
    width,
    height,
    (completed, total) => progress.push([completed, total]),
  );

  assert.equal(decoded.length, width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const decodedOffset = pixel * 4;
    const ppmOffset = pixel * 3;
    assert.equal(decoded[decodedOffset], ppmPixels[ppmOffset]);
    assert.equal(decoded[decodedOffset + 1], ppmPixels[ppmOffset + 1]);
    assert.equal(decoded[decodedOffset + 2], ppmPixels[ppmOffset + 2]);
    assert.equal(decoded[decodedOffset + 3], 255);
  }

  assert.equal(progress[0]?.[0], 0);
  assert.equal(progress[0]?.[1], 65_536);
  assert.equal(progress.at(-1)?.[0], 65_536);
  assert.equal(progress.at(-1)?.[1], 65_536);
  assert.equal(progress.length, 65);
  for (let i = 1; i < progress.length; i++) {
    assert.ok(progress[i][0] > progress[i - 1][0]);
    assert.equal(progress[i][1], 65_536);
  }
});

test("decodes BC2 explicit alpha", async () => {
  const wasm = await loadWasm();
  const block = Uint8Array.of(
    0x10, 0x32, 0x54, 0x76, 0x98, 0xba, 0xdc, 0xfe,
    0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  );
  const decoded = wasm.decode("bc2", block, 4, 4);

  for (let pixel = 0; pixel < 16; pixel++) {
    assert.deepStrictEqual(
      decoded.slice(pixel * 4, pixel * 4 + 3),
      Uint8Array.of(255, 255, 255),
    );
    assert.equal(decoded[pixel * 4 + 3], pixel * 17);
  }
});

test("encodes and decodes BC1-BC5 and BC7, including partial edge blocks", async () => {
  const wasm = await loadWasm();
  const formats: readonly BcFormat[] = ["bc1", "bc2", "bc3", "bc4", "bc5", "bc7"];
  const width = 5;
  const height = 3;

  for (const format of formats) {
    const sourceColor = format === "bc1" ? [90, 140, 200, 255] : [90, 140, 200, 119];
    const source = new Uint8Array(width * height * 4);
    for (let offset = 0; offset < source.length; offset += 4) source.set(sourceColor, offset);
    const encodeProgress: Array<readonly [number, number]> = [];
    const encoded = wasm.encode(format, source, width, height, {
      quality: 0,
      onProgress: (completed, total) => encodeProgress.push([completed, total]),
    });
    assert.equal(encoded.length, (format === "bc1" || format === "bc4" ? 8 : 16) * 2);
    assert.deepStrictEqual(encodeProgress, [[0, 2], [2, 2]]);

    const decoded = wasm.decode(format, encoded, width, height);
    assert.equal(decoded.length, source.length);
    for (let offset = 0; offset < decoded.length; offset += 4) {
      assert.ok(Math.abs(decoded[offset] - sourceColor[0]) <= 10, `${format} red channel`);
      if (format !== "bc4") {
        assert.ok(Math.abs(decoded[offset + 1] - sourceColor[1]) <= 10, `${format} green channel`);
      } else {
        assert.equal(decoded[offset + 1], 0);
      }
      if (format === "bc1" || format === "bc2" || format === "bc3" || format === "bc7") {
        assert.ok(Math.abs(decoded[offset + 2] - sourceColor[2]) <= 10, `${format} blue channel`);
      } else {
        assert.equal(decoded[offset + 2], 0);
      }
      const expectedAlpha = format === "bc1" || format === "bc4" || format === "bc5" ? 255 : 119;
      assert.ok(Math.abs(decoded[offset + 3] - expectedAlpha) <= 8, `${format} alpha channel`);
    }
  }
});

test("preserves BC1 punch-through transparency", async () => {
  const wasm = await loadWasm();
  const source = new Uint8Array(4 * 4 * 4);
  for (let offset = 0; offset < source.length; offset += 4) source.set([220, 30, 40, 255], offset);
  source[3] = 0;

  const decoded = wasm.decode("bc1", wasm.encode("bc1", source, 4, 4), 4, 4);
  assert.equal(decoded[3], 0);
  for (let pixel = 1; pixel < 16; pixel++) assert.equal(decoded[pixel * 4 + 3], 255);
});
