"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaProvider = void 0;
class OllamaProvider {
    constructor(config) {
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ollama'
        });
        Object.defineProperty(this, "currentModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "baseUrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "timeout", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        this.currentModel = config.model || 'llama2';
        this.timeout = config.timeout || 60000; // Longer timeout for local models
    }
    async complete(options) {
        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: options.model || this.currentModel,
                prompt: this.buildPrompt(options),
                stream: false,
                options: {
                    temperature: options.temperature ?? 0.7,
                    num_predict: options.maxTokens,
                },
            }),
            signal: AbortSignal.timeout(this.timeout),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Ollama API error: ${response.status} - ${error}`);
        }
        const data = (await response.json());
        return {
            content: data.response,
            tokensUsed: data.eval_count,
            model: data.model,
            finishReason: data.done ? 'stop' : 'length',
        };
    }
    async stream(options) {
        return this.streamGenerator(options);
    }
    async *streamGenerator(options) {
        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: options.model || this.currentModel,
                prompt: this.buildPrompt(options),
                stream: true,
                options: {
                    temperature: options.temperature ?? 0.7,
                    num_predict: options.maxTokens,
                },
            }),
            signal: AbortSignal.timeout(this.timeout),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Ollama API error: ${response.status} - ${error}`);
        }
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Response body is not readable');
        }
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.response) {
                            yield parsed.response;
                        }
                    }
                    catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        }
    }
    async listModels() {
        const response = await fetch(`${this.baseUrl}/api/tags`);
        if (!response.ok) {
            throw new Error(`Failed to list models: ${response.status}`);
        }
        const data = (await response.json());
        return data.models?.map((model) => model.name) || [];
    }
    async validateConfig() {
        try {
            await this.listModels();
            return true;
        }
        catch {
            return false;
        }
    }
    buildPrompt(options) {
        let prompt = '';
        if (options.systemPrompt) {
            prompt += options.systemPrompt + '\n\n';
        }
        // Add context if provided
        if (options.context) {
            if (options.context.files && options.context.files.length > 0) {
                prompt += '## Relevant Files:\n';
                for (const file of options.context.files) {
                    prompt += `\n### ${file.path}\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n`;
                }
                prompt += '\n\n';
            }
            if (options.context.gitDiff) {
                prompt += '## Git Changes:\n```diff\n' + options.context.gitDiff + '\n```\n\n';
            }
        }
        prompt += options.prompt;
        return prompt;
    }
}
exports.OllamaProvider = OllamaProvider;
