import { ResponseBuffer } from './buffer';
export interface StreamHandlerOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
  bufferSize?: number;
}
export declare class StreamHandler {
  private buffer;
  private options;
  constructor(options?: StreamHandlerOptions);
  handleStream(
    stream: AsyncGenerator<string> | ReadableStream,
    format?: 'sse' | 'json' | 'text'
  ): Promise<string>;
  private handleAsyncGenerator;
  private handleReadableStream;
  private processBuffer;
  private extractChunk;
  getBuffer(): ResponseBuffer;
  reset(): void;
}
export declare function handleStream(
  stream: AsyncGenerator<string> | ReadableStream,
  options?: StreamHandlerOptions
): Promise<string>;
//# sourceMappingURL=stream-handler.d.ts.map
