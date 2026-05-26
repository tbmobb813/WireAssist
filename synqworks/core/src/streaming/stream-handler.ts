// Stream processing
import { ResponseBuffer } from './buffer';
import { parseSSEChunk, parseJSONChunk } from './parser';

export interface StreamHandlerOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
  bufferSize?: number;
}

export class StreamHandler {
  private buffer: ResponseBuffer;
  private options: StreamHandlerOptions;

  constructor(options: StreamHandlerOptions = {}) {
    this.buffer = new ResponseBuffer(options.bufferSize);
    this.options = options;
  }

  async handleStream(
    stream: AsyncGenerator<string> | ReadableStream,
    format: 'sse' | 'json' | 'text' = 'text'
  ): Promise<string> {
    try {
      if (stream instanceof ReadableStream) {
        return await this.handleReadableStream(stream, format);
      } else {
        return await this.handleAsyncGenerator(stream);
      }
    } catch (error) {
      if (this.options.onError) {
        this.options.onError(error as Error);
      }
      throw error;
    }
  }

  private async handleAsyncGenerator(stream: AsyncGenerator<string>): Promise<string> {
    for await (const chunk of stream) {
      this.buffer.append(chunk);

      if (this.options.onChunk) {
        this.options.onChunk(chunk);
      }
    }

    const fullResponse = this.buffer.toString();

    if (this.options.onComplete) {
      this.options.onComplete(fullResponse);
    }

    return fullResponse;
  }

  private async handleReadableStream(
    stream: ReadableStream,
    format: 'sse' | 'json' | 'text'
  ): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete chunks
        const { chunks, remaining } = this.processBuffer(buffer, format);
        buffer = remaining;

        for (const chunk of chunks) {
          this.buffer.append(chunk);

          if (this.options.onChunk) {
            this.options.onChunk(chunk);
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const chunk = this.extractChunk(buffer, format);
        if (chunk) {
          this.buffer.append(chunk);

          if (this.options.onChunk) {
            this.options.onChunk(chunk);
          }
        }
      }

      const fullResponse = this.buffer.toString();

      if (this.options.onComplete) {
        this.options.onComplete(fullResponse);
      }

      return fullResponse;
    } finally {
      reader.releaseLock();
    }
  }

  private processBuffer(
    buffer: string,
    format: 'sse' | 'json' | 'text'
  ): { chunks: string[]; remaining: string } {
    if (format === 'text') {
      return { chunks: [buffer], remaining: '' };
    }

    const lines = buffer.split('\n');
    const remaining = lines.pop() || '';
    const chunks: string[] = [];

    for (const line of lines) {
      const chunk = this.extractChunk(line, format);
      if (chunk) {
        chunks.push(chunk);
      }
    }

    return { chunks, remaining };
  }

  private extractChunk(line: string, format: 'sse' | 'json' | 'text'): string | null {
    try {
      if (format === 'sse') {
        return parseSSEChunk(line);
      } else if (format === 'json') {
        return parseJSONChunk(line);
      } else {
        return line;
      }
    } catch {
      return null;
    }
  }

  getBuffer(): ResponseBuffer {
    return this.buffer;
  }

  reset(): void {
    this.buffer.clear();
  }
}

export function handleStream(
  stream: AsyncGenerator<string> | ReadableStream,
  options?: StreamHandlerOptions
): Promise<string> {
  const handler = new StreamHandler(options);
  return handler.handleStream(stream);
}
