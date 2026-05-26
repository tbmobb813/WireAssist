"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseBuffer = void 0;
// Response buffering
class ResponseBuffer {
    constructor(maxSize = 1024 * 1024) {
        Object.defineProperty(this, "chunks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.maxSize = maxSize;
    }
    append(chunk) {
        this.chunks.push(chunk);
        // Check if we've exceeded max size
        if (this.getSize() > this.maxSize) {
            throw new Error(`Buffer exceeded maximum size of ${this.maxSize} bytes`);
        }
    }
    toString() {
        return this.chunks.join('');
    }
    getChunks() {
        return [...this.chunks];
    }
    getSize() {
        return this.chunks.reduce((size, chunk) => size + chunk.length, 0);
    }
    clear() {
        this.chunks = [];
    }
    isEmpty() {
        return this.chunks.length === 0;
    }
    getLastChunk() {
        return this.chunks[this.chunks.length - 1];
    }
    slice(start, end) {
        return this.toString().slice(start, end);
    }
}
exports.ResponseBuffer = ResponseBuffer;
