export const UINT32_MAX = 0xffff_ffff;

export type ProgressCallback = (completed: number, total: number) => void;

export function swapRedBlue(source: Uint8Array): Uint8Array {
  const result = new Uint8Array(source.byteLength);

  for (let offset = 0; offset < source.byteLength; offset += 4) {
    result[offset] = source[offset + 2];
    result[offset + 1] = source[offset + 1];
    result[offset + 2] = source[offset];
    result[offset + 3] = source[offset + 3];
  }

  return result;
}

export function concatenate(chunks: readonly Uint8Array[]): Uint8Array {
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);

  const result = new Uint8Array(totalSize);

  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}

export const fmt = {
  hex(value: number): string {
    return "0x" + value.toString(16).toUpperCase().padStart(8, "0");
  }
}

export const bigint = {
  toNumber(value: bigint): number {
    if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`value ${value} is outside the supported range`);
    }

    return Number(value);
  }
}

export function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function checkedProduct(num1: number, num2: number): number {
  const result = num1 * num2;

  if (!Number.isSafeInteger(result)) {
    throw new RangeError("Multiplication overflow encountered!");
  }

  return result;
}

export function checkedSum(num1: number, num2: number): number {
  const result = num1 + num2;

  if (!Number.isSafeInteger(result) || result > UINT32_MAX) {
    throw new RangeError("Sum overflow encountered!");
  }

  return result;
}

export async function sha1(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-1", bytes.slice()));
}