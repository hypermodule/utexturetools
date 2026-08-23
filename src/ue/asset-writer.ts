export class AssetWriter {
  private bytes: Uint8Array;
  private offset = 0;
  private writtenLength = 0;

  constructor(initialCapacity = 256) {
    if (!Number.isSafeInteger(initialCapacity) || initialCapacity < 0) {
      throw new RangeError(`Invalid initial capacity: ${initialCapacity}`);
    }

    this.bytes = new Uint8Array(initialCapacity);
  }

  get position(): number {
    return this.offset;
  }

  set position(value: number) {
    if (!Number.isInteger(value) || value < 0 || value > this.writtenLength) {
      throw new RangeError(`Invalid writer position: ${value}`);
    }

    this.offset = value;
  }

  writeBoolean32(value: boolean): void {
    this.writeInt32(value ? 1 : 0);
  }

  writeUint8(value: number): void {
    this.ensureCapacity(1);
    this.bytes[this.offset] = value;
    this.offset += 1;
  }

  writeUint16(value: number): void {
    this.ensureCapacity(2);
    new DataView(this.bytes.buffer).setUint16(this.offset, value, true);
    this.offset += 2;
  }

  writeUint32(value: number): void {
    this.ensureCapacity(4);
    new DataView(this.bytes.buffer).setUint32(this.offset, value, true);
    this.offset += 4;
  }

  writeInt32(value: number): void {
    this.ensureCapacity(4);
    new DataView(this.bytes.buffer).setInt32(this.offset, value, true);
    this.offset += 4;
  }

  writeBigInt64(value: bigint): void {
    this.ensureCapacity(8);
    new DataView(this.bytes.buffer).setBigInt64(this.offset, value, true);
    this.offset += 8;
  }

  writeFloat32(value: number): void {
    this.ensureCapacity(4);
    new DataView(this.bytes.buffer).setFloat32(this.offset, value, true);
    this.offset += 4;
  }

  patchBigInt64(position: number, value: bigint): void {
    if (!Number.isInteger(position) || position < 0 || position + 8 > this.writtenLength) {
      throw new RangeError(`Invalid 64-bit patch position: ${position}`);
    }

    new DataView(this.bytes.buffer).setBigInt64(position, value, true);
  }

  writeBytes(value: Uint8Array): void {
    this.ensureCapacity(value.byteLength);
    this.bytes.set(value, this.offset);
    this.offset += value.byteLength;
  }

  writeAnsiString(value: string): void {
    const encoded = new TextEncoder().encode(value);
    this.writeInt32(encoded.byteLength + 1);
    this.writeBytes(encoded);
    this.writeUint8(0);
  }

  writeFString(value: string): void {
    if (value.length === 0) {
      this.writeInt32(0);
      return;
    }

    this.writeAnsiString(value);
  }

  toUint8Array(): Uint8Array {
    return this.bytes.slice(0, this.writtenLength);
  }

  private ensureCapacity(additionalBytes: number): void {
    const required = this.offset + additionalBytes;
    if (!Number.isSafeInteger(required)) {
      throw new RangeError("Serialized asset data is too large.");
    }

    if (required <= this.bytes.byteLength) {
      this.writtenLength = Math.max(this.writtenLength, required);
      return;
    }

    const capacity = Math.max(required, this.bytes.byteLength * 2);
    const grown = new Uint8Array(capacity);
    grown.set(this.bytes);
    this.bytes = grown;
    this.writtenLength = required;
  }
}
