"use strict";
// SSE/chunk parsing
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamParser = void 0;
exports.parseSSEChunk = parseSSEChunk;
exports.parseJSONChunk = parseJSONChunk;
exports.parseStreamLine = parseStreamLine;
function parseSSEChunk(chunk) {
    if (!chunk.trim()) {
        return null;
    }
    const lines = chunk.split('\n');
    const event = {};
    for (const line of lines) {
        if (line.startsWith('data: ')) {
            const data = line.slice(6);
            // Skip [DONE] markers
            if (data === '[DONE]') {
                return null;
            }
            // Try to parse as JSON
            try {
                const parsed = JSON.parse(data);
                // OpenAI format
                if (parsed.choices?.[0]?.delta?.content) {
                    return parsed.choices[0].delta.content;
                }
                // Anthropic format
                if (parsed.delta?.text) {
                    return parsed.delta.text;
                }
                // Generic text field
                if (parsed.text) {
                    return parsed.text;
                }
                // Return raw data if no known format
                return data;
            }
            catch {
                // Not JSON, return as-is
                return data;
            }
        }
        else if (line.startsWith('event: ')) {
            event.event = line.slice(7);
        }
        else if (line.startsWith('id: ')) {
            event.id = line.slice(4);
        }
        else if (line.startsWith('retry: ')) {
            event.retry = parseInt(line.slice(7), 10);
        }
    }
    return null;
}
function parseJSONChunk(chunk) {
    if (!chunk.trim()) {
        return null;
    }
    try {
        const parsed = JSON.parse(chunk);
        // OpenAI streaming format
        if (parsed.choices?.[0]?.delta?.content) {
            return parsed.choices[0].delta.content;
        }
        // Anthropic streaming format
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            return parsed.delta.text;
        }
        // Gemini streaming format
        if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
            return parsed.candidates[0].content.parts[0].text;
        }
        // Ollama streaming format
        if (parsed.response !== undefined) {
            return parsed.response;
        }
        // Generic text/content field
        if (parsed.text) {
            return parsed.text;
        }
        if (parsed.content) {
            return parsed.content;
        }
        return null;
    }
    catch {
        return null;
    }
}
function parseStreamLine(line, format) {
    if (format === 'sse') {
        return parseSSEChunk(line);
    }
    else if (format === 'json') {
        return parseJSONChunk(line);
    }
    else {
        return line;
    }
}
class StreamParser {
    constructor(format = 'text') {
        Object.defineProperty(this, "buffer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "format", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.format = format;
    }
    parse(data) {
        this.buffer += data;
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';
        const results = [];
        for (const line of lines) {
            const parsed = parseStreamLine(line, this.format);
            if (parsed) {
                results.push(parsed);
            }
        }
        return results;
    }
    flush() {
        if (this.buffer.trim()) {
            const parsed = parseStreamLine(this.buffer, this.format);
            this.buffer = '';
            return parsed;
        }
        return null;
    }
    reset() {
        this.buffer = '';
    }
}
exports.StreamParser = StreamParser;
