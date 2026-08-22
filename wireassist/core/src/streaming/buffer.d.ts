export declare class ResponseBuffer {
  private chunks;
  private maxSize;
  constructor(maxSize?: number);
  append(chunk: string): void;
  toString(): string;
  getChunks(): string[];
  getSize(): number;
  clear(): void;
  isEmpty(): boolean;
  getLastChunk(): string | undefined;
  slice(start: number, end?: number): string;
}
//# sourceMappingURL=buffer.d.ts.map
