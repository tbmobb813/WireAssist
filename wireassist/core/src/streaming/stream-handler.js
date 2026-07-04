'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.StreamHandler = void 0;
exports.handleStream = handleStream;
// Stream processing
const buffer_1 = require('./buffer');
const parser_1 = require('./parser');
class StreamHandler {
  constructor(options = {}) {
    Object.defineProperty(this, 'buffer', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    Object.defineProperty(this, 'options', {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.buffer = new buffer_1.ResponseBuffer(options.bufferSize);
    this.options = options;
  }
  async handleStream(stream, format = 'text') {
    try {
      if (stream instanceof ReadableStream) {
        return await this.handleReadableStream(stream, format);
      } else {
        return await this.handleAsyncGenerator(stream);
      }
    } catch (error) {
      if (this.options.onError) {
        this.options.onError(error);
      }
      throw error;
    }
  }
  async handleAsyncGenerator(stream) {
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
  async handleReadableStream(stream, format) {
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
  processBuffer(buffer, format) {
    if (format === 'text') {
      return { chunks: [buffer], remaining: '' };
    }
    const lines = buffer.split('\n');
    const remaining = lines.pop() || '';
    const chunks = [];
    for (const line of lines) {
      const chunk = this.extractChunk(line, format);
      if (chunk) {
        chunks.push(chunk);
      }
    }
    return { chunks, remaining };
  }
  extractChunk(line, format) {
    try {
      if (format === 'sse') {
        return (0, parser_1.parseSSEChunk)(line);
      } else if (format === 'json') {
        return (0, parser_1.parseJSONChunk)(line);
      } else {
        return line;
      }
    } catch {
      return null;
    }
  }
  getBuffer() {
    return this.buffer;
  }
  reset() {
    this.buffer.clear();
  }
}
exports.StreamHandler = StreamHandler;
function handleStream(stream, options) {
  const handler = new StreamHandler(options);
  return handler.handleStream(stream);
}
