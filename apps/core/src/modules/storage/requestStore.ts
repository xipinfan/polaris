import type { RequestRecord } from "@polaris/shared-types";

export class RequestStore {
  private buffer: Array<RequestRecord | null>;
  private head = 0;
  private count = 0;
  private index = new Map<string, number>();
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity);
    this.buffer = Array.from({ length: this.capacity }, () => null);
  }

  append(record: RequestRecord): void {
    const overwritten = this.buffer[this.head];
    if (overwritten) {
      this.index.delete(overwritten.id);
    }

    this.buffer[this.head] = record;
    this.index.set(record.id, this.head);
    this.head = (this.head + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);
  }

  getById(id: string): RequestRecord | undefined {
    const position = this.index.get(id);
    if (position === undefined) {
      return undefined;
    }
    return this.buffer[position] ?? undefined;
  }

  toArray(): RequestRecord[] {
    const records: RequestRecord[] = [];

    for (let offset = 1; offset <= this.count; offset += 1) {
      const position = (this.head - offset + this.capacity) % this.capacity;
      const record = this.buffer[position];
      if (record) {
        records.push(record);
      }
    }

    return records;
  }

  clear(): void {
    this.buffer = Array.from({ length: this.capacity }, () => null);
    this.head = 0;
    this.count = 0;
    this.index = new Map<string, number>();
  }

  get size(): number {
    return this.count;
  }

  resize(newCapacity: number): void {
    const nextCapacity = Math.max(1, newCapacity);
    const records = this.toArray().slice(0, nextCapacity).reverse();

    this.capacity = nextCapacity;
    this.buffer = Array.from({ length: this.capacity }, () => null);
    this.head = 0;
    this.count = 0;
    this.index = new Map<string, number>();

    for (const record of records) {
      this.append(record);
    }
  }
}
