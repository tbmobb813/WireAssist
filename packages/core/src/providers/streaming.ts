// @lai/core/src/providers/streaming.ts

export interface StreamCallbacks {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

export class StreamManager {
  /**
   * Handle an async generator stream with callbacks
   */
  async handleStream(
    stream: AsyncGenerator<string>,
    callbacks: StreamCallbacks = {},
  ): Promise<string> {
    let fullResponse = '';

    try {
      for await (const chunk of stream) {
        fullResponse += chunk;
        
        if (callbacks.onChunk) {
          try {
            callbacks.onChunk(chunk);
          } catch (error) {
            console.warn('Error in onChunk callback:', error);
          }
        }
      }

      callbacks.onComplete?.(fullResponse);
      return fullResponse;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * Convert a stream to a promise that resolves with the full response
   */
  async streamToString(stream: AsyncGenerator<string>): Promise<string> {
    return this.handleStream(stream);
  }

  /**
   * Buffer stream chunks and emit them in batches
   */
  async *bufferStream(
    stream: AsyncGenerator<string>,
    bufferSize: number = 10,
  ): AsyncGenerator<string> {
    let buffer = '';

    for await (const chunk of stream) {
      buffer += chunk;

      if (buffer.length >= bufferSize) {
        yield buffer;
        buffer = '';
      }
    }

    // Yield remaining buffer
    if (buffer) {
      yield buffer;
    }
  }
}

/**
 * Utility function for handling streams (convenience wrapper)
 */
export async function handleStream(
  stream: AsyncGenerator<string>,
  callbacks?: StreamCallbacks,
): Promise<string> {
  const manager = new StreamManager();
  return manager.handleStream(stream, callbacks);
}
