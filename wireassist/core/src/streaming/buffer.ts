// Response buffering
export class ResponseBuffer {
  private chunks: string[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1024 * 1024) {
    this.maxSize = maxSize;
  }

  append(chunk: string): void {
    this.chunks.push(chunk);

    // Check if we've exceeded max size
    if (this.getSize() > this.maxSize) {
      throw new Error(`Buffer exceeded maximum size of ${this.maxSize} bytes`);
    }
  }

  toString(): string {
    return this.chunks.join('');
  }

  getChunks(): string[] {
    return [...this.chunks];
  }

  getSize(): number {
    return this.chunks.reduce((size, chunk) => size + chunk.length, 0);
  }

  clear(): void {
    this.chunks = [];
  }

  isEmpty(): boolean {
    return this.chunks.length === 0;
  }

  getLastChunk(): string | undefined {
    return this.chunks[this.chunks.length - 1];
  }

  slice(start: number, end?: number): string {
    return this.toString().slice(start, end);
  }
}
