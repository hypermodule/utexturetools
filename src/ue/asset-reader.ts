import type {Guid} from "./guid.ts";

export type AssetReaderCallback<T> = (reader: AssetReader) => T;

const UTF8_DECODER = new TextDecoder("utf-8", {fatal: true});
const UTF16_LE_DECODER = new TextDecoder("utf-16le", {fatal: true});

export class AssetReader {
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  private offset = 0;

  constructor(input: Uint8Array) {
    this.bytes = input;
    this.view = new DataView(
      input.buffer,
      input.byteOffset,
      input.byteLength,
    );
  }

  get position(): number {
    return this.offset;
  }

  set position(value: number) {
    if (!Number.isInteger(value) || value < 0 || value > this.length) {
      throw new RangeError(`Invalid reader position: ${value}`);
    }

    this.offset = value;
  }

  get length(): number {
    return this.view.byteLength;
  }

  get remaining(): number {
    return this.length - this.offset;
  }

  readBoolean32(): boolean {
    return this.readInt32() !== 0;
  }

  readUint8(): number {
    this.ensureAvailable(1);

    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readInt8(): number {
    this.ensureAvailable(1);

    const value = this.view.getInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readUint16(): number {
    this.ensureAvailable(2);

    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  readInt16(): number {
    this.ensureAvailable(2);

    const value = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return value;
  }

  readUint32(): number {
    this.ensureAvailable(4);

    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readInt32(): number {
    this.ensureAvailable(4);

    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readBigUint64(): bigint {
    this.ensureAvailable(8);

    const value = this.view.getBigUint64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readBigInt64(): bigint {
    this.ensureAvailable(8);

    const value = this.view.getBigInt64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readFloat32(): number {
    this.ensureAvailable(4);

    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readFloat64(): number {
    this.ensureAvailable(8);

    const value = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return value;
  }

  readBytes(length: number): Uint8Array {
    this.ensureAvailable(length);

    const value = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  readFString(): string {
    const num = this.readInt32();

    if (num === 0) {
      return "";
    }

    if (num > 0) {
      const chars = this.readBytes(num - 1);
      this.readUint8(); // Skip null terminator
      return UTF8_DECODER.decode(chars);
    } else {
      const len = -num * 2;
      const wchars = this.readBytes(len - 2);
      this.readUint16(); // Skip null terminator
      return UTF16_LE_DECODER.decode(wchars);
    }
  }

  readGuid(): Guid {
    const a = this.readUint32();
    const b = this.readUint32();
    const c = this.readUint32();
    const d = this.readUint32();

    return {a, b, c, d};
  }

  readArray<T>(count: number, readElement: AssetReaderCallback<T>, elementSize?: number): T[] {
    if (!Number.isInteger(count) || count < 0) {
      this.throwFormatError(`array has an invalid element count: ${count}`);
    }

    if (elementSize === undefined) {
      elementSize = 1;
    }

    if (count > Math.floor(this.remaining / elementSize)) {
      this.throwFormatError(`array count ${count} exceeds the remaining data`);
    }

    const result = new Array<T>(count);

    for (let index = 0; index < count; index++) {
      result[index] = readElement(this);
    }

    return result;
  }

  readLengthPrefixedArray<T>(readElement: AssetReaderCallback<T>, elementSize?: number): T[] {
    const count = this.readInt32();

    if (count < 0) {
      this.throwFormatError(`array has a negative element count: ${count}`);
    }

    if (elementSize === undefined) {
      elementSize = 1;
    }

    if (count > Math.floor(this.remaining / elementSize)) {
      this.throwFormatError(`array count ${count} exceeds the remaining data`);
    }

    const result = new Array<T>(count);

    for (let index = 0; index < count; index++) {
      result[index] = readElement(this);
    }

    return result;
  }

  throwFormatError(message: string): never {
    throw new AssetFormatError(message, this.position);
  }

  private ensureAvailable(byteCount: number): void {
    if (!Number.isInteger(byteCount) || byteCount < 0) {
      throw new RangeError(`Invalid byte count: ${byteCount}`);
    }

    // Written this way rather than offset + byteCount to avoid overflow.
    if (byteCount > this.remaining) {
      throw new RangeError(
        `Unexpected end of data: requested ${byteCount} byte(s) ` +
        `at position ${this.offset}, but only ${this.remaining} remain`,
      );
    }
  }
}

export class AssetFormatError extends Error {
  public readonly offset?: number | undefined;

  constructor(message: string, offset?: number) {
    super(offset === undefined ? message : `${message} at file offset ${offset}`);
    this.offset = offset;
    this.name = "AssetFormatError";
  }
}
