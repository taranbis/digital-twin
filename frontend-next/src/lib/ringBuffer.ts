export class RingBuffer<T> {
  private data: T[];
  private head = 0;
  private count = 0;
  private readonly cap: number;

  constructor(capacity: number) {
    this.cap = capacity;
    this.data = new Array<T>(capacity);
  }

  push(item: T): void {
    this.data[this.head] = item;
    this.head = (this.head + 1) % this.cap;
    if (this.count < this.cap) this.count++;
  }

  get size(): number {
    return this.count;
  }

  get capacity(): number {
    return this.cap;
  }

  at(index: number): T {
    const realIdx = (this.head + this.cap - this.count + index) % this.cap;
    return this.data[realIdx];
  }

  latest(): T | undefined {
    if (this.count === 0) return undefined;
    return this.data[(this.head + this.cap - 1) % this.cap];
  }

  /** Return a decimated snapshot as a plain array. */
  toDecimated(maxPoints: number): T[] {
    if (this.count === 0) return [];
    const step = Math.max(1, Math.floor(this.count / maxPoints));
    const result: T[] = [];
    for (let i = 0; i < this.count; i += step) {
      result.push(this.at(i));
    }
    if (result.length > 0) {
      const last = this.at(this.count - 1);
      if (result[result.length - 1] !== last) {
        result.push(last);
      }
    }
    return result;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}
