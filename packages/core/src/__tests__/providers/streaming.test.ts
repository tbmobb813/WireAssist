// @lai/core/src/__tests__/providers/streaming.test.ts

import { StreamManager, handleStream } from '../../providers/streaming';

// Helper function to create a test async generator
async function* createTestStream(chunks: string[]): AsyncGenerator<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

// Helper function to create a stream that throws an error
async function* createErrorStream(chunks: string[], errorAfter: number): AsyncGenerator<string> {
  for (let i = 0; i < chunks.length; i++) {
    if (i === errorAfter) {
      throw new Error('Stream error');
    }
    yield chunks[i];
  }
}

describe('StreamManager', () => {
  describe('handleStream', () => {
    test('should handle a simple stream', async () => {
      const manager = new StreamManager();
      const stream = createTestStream(['Hello', ' ', 'world']);

      const result = await manager.handleStream(stream);

      expect(result).toBe('Hello world');
    });

    test('should call onChunk callback for each chunk', async () => {
      const manager = new StreamManager();
      const stream = createTestStream(['chunk1', 'chunk2', 'chunk3']);
      const chunks: string[] = [];

      await manager.handleStream(stream, {
        onChunk: (chunk) => chunks.push(chunk),
      });

      expect(chunks).toEqual(['chunk1', 'chunk2', 'chunk3']);
    });

    test('should call onComplete callback with full response', async () => {
      const manager = new StreamManager();
      const stream = createTestStream(['Hello', ' ', 'world']);
      let completedWith = '';

      await manager.handleStream(stream, {
        onComplete: (fullResponse) => {
          completedWith = fullResponse;
        },
      });

      expect(completedWith).toBe('Hello world');
    });

    test('should handle errors and call onError callback', async () => {
      const manager = new StreamManager();
      const stream = createErrorStream(['chunk1', 'chunk2'], 1);
      let errorCaught: Error | undefined;

      await expect(
        manager.handleStream(stream, {
          onError: (error) => {
            errorCaught = error;
          },
        })
      ).rejects.toThrow('Stream error');

      expect(errorCaught).toBeDefined();
      expect(errorCaught?.message).toBe('Stream error');
    });

    test('should continue even if onChunk callback throws', async () => {
      const manager = new StreamManager();
      const stream = createTestStream(['chunk1', 'chunk2', 'chunk3']);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const processedChunks: string[] = [];

      const result = await manager.handleStream(stream, {
        onChunk: (chunk) => {
          processedChunks.push(chunk);
          if (chunk === 'chunk2') {
            throw new Error('Callback error');
          }
        },
      });

      expect(result).toBe('chunk1chunk2chunk3');
      expect(processedChunks).toEqual(['chunk1', 'chunk2', 'chunk3']);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    test('should handle empty stream', async () => {
      const manager = new StreamManager();
      const stream = createTestStream([]);

      const result = await manager.handleStream(stream);

      expect(result).toBe('');
    });

    test('should accumulate all chunks in order', async () => {
      const manager = new StreamManager();
      const chunks = ['The', ' ', 'quick', ' ', 'brown', ' ', 'fox'];
      const stream = createTestStream(chunks);

      const result = await manager.handleStream(stream);

      expect(result).toBe('The quick brown fox');
    });
  });

  describe('streamToString', () => {
    test('should convert stream to string', async () => {
      const manager = new StreamManager();
      const stream = createTestStream(['Hello', ' ', 'world']);

      const result = await manager.streamToString(stream);

      expect(result).toBe('Hello world');
    });

    test('should handle large streams', async () => {
      const manager = new StreamManager();
      const chunks = Array(100)
        .fill(0)
        .map((_, i) => `chunk${i}`);
      const stream = createTestStream(chunks);

      const result = await manager.streamToString(stream);

      expect(result).toBe(chunks.join(''));
    });
  });

  describe('bufferStream', () => {
    test('should buffer chunks based on buffer size', async () => {
      const manager = new StreamManager();
      const stream = createTestStream(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']);
      const buffered = manager.bufferStream(stream, 5);
      const results: string[] = [];

      for await (const chunk of buffered) {
        results.push(chunk);
      }

      // Should emit when buffer reaches size 5
      expect(results.length).toBeGreaterThan(1);
      expect(results.join('')).toBe('abcdefghijk');
    });

    test('should emit remaining buffer at end', async () => {
      const manager = new StreamManager();
      const stream = createTestStream(['1', '2', '3']);
      const buffered = manager.bufferStream(stream, 10); // Buffer larger than total
      const results: string[] = [];

      for await (const chunk of buffered) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toBe('123');
    });

    test('should handle custom buffer sizes', async () => {
      const manager = new StreamManager();
      const stream = createTestStream(['12', '34', '56', '78', '90']);
      const buffered = manager.bufferStream(stream, 3);
      const results: string[] = [];

      for await (const chunk of buffered) {
        results.push(chunk);
      }

      expect(results.join('')).toBe('1234567890');
    });

    test('should use default buffer size of 10', async () => {
      const manager = new StreamManager();
      const stream = createTestStream(['a', 'b', 'c', 'd', 'e']);
      const buffered = manager.bufferStream(stream);
      const results: string[] = [];

      for await (const chunk of buffered) {
        results.push(chunk);
      }

      // With default buffer size 10 and only 5 chars, should emit once at end
      expect(results).toHaveLength(1);
      expect(results[0]).toBe('abcde');
    });
  });
});

describe('handleStream (convenience function)', () => {
  test('should work as standalone function', async () => {
    const stream = createTestStream(['Hello', ' ', 'world']);

    const result = await handleStream(stream);

    expect(result).toBe('Hello world');
  });

  test('should accept callbacks', async () => {
    const stream = createTestStream(['chunk1', 'chunk2']);
    const chunks: string[] = [];
    let completed = false;

    await handleStream(stream, {
      onChunk: (chunk) => chunks.push(chunk),
      onComplete: () => {
        completed = true;
      },
    });

    expect(chunks).toEqual(['chunk1', 'chunk2']);
    expect(completed).toBe(true);
  });

  test('should handle errors', async () => {
    const stream = createErrorStream(['chunk1', 'chunk2'], 1);
    let errorCaught = false;

    await expect(
      handleStream(stream, {
        onError: () => {
          errorCaught = true;
        },
      })
    ).rejects.toThrow('Stream error');

    expect(errorCaught).toBe(true);
  });
});
