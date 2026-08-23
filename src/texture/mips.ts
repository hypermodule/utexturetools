export interface RgbaMip {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}

export function generateTextureMips(rgba: Uint8Array, width: number, height: number): RgbaMip[] {
  validateRgbaInput(rgba, width, height);

  const mips: RgbaMip[] = [{width, height, rgba: rgba.slice()}];
  while (width > 1 || height > 1) {
    const source = mips[mips.length - 1];

    width = Math.max(1, Math.floor(width / 2));
    height = Math.max(1, Math.floor(height / 2));
    mips.push({width, height, rgba: downsampleRgba(source, width, height)});
  }

  return mips;
}

function validateRgbaInput(rgba: Uint8Array, width: number, height: number): void {
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
    throw new RangeError("Texture dimensions must be positive safe integers.");
  }

  const expectedLength = width * height * 4;
  if (!Number.isSafeInteger(expectedLength)) {
    throw new RangeError("The replacement image is too large.");
  }

  if (rgba.byteLength !== expectedLength) {
    throw new RangeError(
      `The RGBA input has ${rgba.byteLength} bytes, but ${expectedLength} bytes are required.`
    );
  }
}

function downsampleRgba(source: RgbaMip, width: number, height: number): Uint8Array {
  const result = new Uint8Array(width * height * 4);
  const sums = [0, 0, 0, 0];

  for (let y = 0; y < height; y++) {
    const sourceY0 = Math.floor(y * source.height / height);
    const sourceY1 = Math.floor((y + 1) * source.height / height);

    for (let x = 0; x < width; x++) {
      const sourceX0 = Math.floor(x * source.width / width);
      const sourceX1 = Math.floor((x + 1) * source.width / width);
      let count = 0;
      sums.fill(0);

      for (let sourceY = sourceY0; sourceY < sourceY1; sourceY++) {
        for (let sourceX = sourceX0; sourceX < sourceX1; sourceX++) {
          const sourceOffset = (sourceY * source.width + sourceX) * 4;

          for (let channel = 0; channel < 4; channel++) {
            sums[channel] += source.rgba[sourceOffset + channel];
          }

          count++;
        }
      }

      const targetOffset = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel++) {
        result[targetOffset + channel] = Math.round(sums[channel] / count);
      }
    }
  }

  return result;
}