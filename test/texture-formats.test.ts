import assert from "node:assert/strict";
import {test} from "node:test";

import {BGRA8_LAYOUT, getBcFormatLayout} from "../src/pixel-formats.ts";
import {
  getTextureBcFormat,
  getTextureFormatInfo,
  getTextureFormatLayout,
} from "../src/texture/formats.ts";

test("describes BGRA pixels without a BC codec", () => {
  const info = getTextureFormatInfo("PF_B8G8R8A8");
  assert.deepStrictEqual(info, {kind: "bgra8", layout: BGRA8_LAYOUT});
  assert.strictEqual(info.layout, BGRA8_LAYOUT);
  assert.strictEqual(getTextureFormatLayout("PF_B8G8R8A8"), info.layout);
  assert.equal(getTextureBcFormat("PF_B8G8R8A8"), undefined);
});

test("keeps BC codec identity distinct from shared block layouts", () => {
  const cases = [
    ["PF_DXT1", "bc1"],
    ["PF_DXT3", "bc2"],
    ["PF_DXT5", "bc3"],
    ["PF_BC4", "bc4"],
    ["PF_BC5", "bc5"],
    ["PF_BC7", "bc7"],
  ] as const;

  for (const [pixelFormat, bcFormat] of cases) {
    const info = getTextureFormatInfo(pixelFormat);
    assert.ok(info?.kind === "bc");
    assert.equal(info.bcFormat, bcFormat);
    assert.strictEqual(info.layout, getBcFormatLayout(bcFormat));
    assert.strictEqual(getTextureFormatLayout(pixelFormat), info.layout);
    assert.equal(getTextureBcFormat(pixelFormat), info.bcFormat);
  }
});

test("returns no descriptor or projections for unsupported pixel formats", () => {
  for (const pixelFormat of ["PF_BC6H", "PF_Unknown", "", "toString", "__proto__"]) {
    assert.equal(getTextureFormatInfo(pixelFormat), undefined);
    assert.equal(getTextureFormatLayout(pixelFormat), undefined);
    assert.equal(getTextureBcFormat(pixelFormat), undefined);
  }
});
