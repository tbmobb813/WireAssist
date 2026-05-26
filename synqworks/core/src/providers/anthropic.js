"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicProvider = void 0;
class AnthropicProvider {
    constructor(config) {
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'anthropic'
        });
        Object.defineProperty(this, "currentModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "apiKey", {
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
        this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
        this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
        this.currentModel = config.model || 'claude-3-5-sonnet-20241022';
        this.timeout = config.timeout || 30000;
        if (!this.apiKey) {
            throw new Error('Anthropic API key is required');
        }
    }
    async complete(options) {
        const response = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: options.model || this.currentModel,
                max_tokens: options.maxTokens || 4096,
                temperature: options.temperature ?? 0.7,
                system: this.buildSystemPrompt(options),
                messages: this.buildMessages(options),
            }),
            signal: AbortSignal.timeout(this.timeout),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Anthropic API error: ${response.status} - ${error}`);
        }
        const data = (await response.json());
        return {
            content: data.content[0].text,
            tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
            model: data.model,
            finishReason: data.stop_reason,
        };
    }
    async stream(options) {
        return this.streamGenerator(options);
    }
    async *streamGenerator(options) {
        const response = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: options.model || this.currentModel,
                max_tokens: options.maxTokens || 4096,
                temperature: options.temperature ?? 0.7,
                system: this.buildSystemPrompt(options),
                messages: this.buildMessages(options),
                stream: true,
            }),
            signal: AbortSignal.timeout(this.timeout),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Anthropic API error: ${response.status} - ${error}`);
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
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                            yield parsed.delta.text;
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
        // Anthropic doesn't have a models endpoint, return known models
        return [
            'claude-3-5-sonnet-20241022',
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307',
        ];
    }
    async validateConfig() {
        try {
            // Test with a minimal request
            await this.complete({
                prompt: 'Hi',
                maxTokens: 10,
            });
            return true;
        }
        catch {
            return false;
        }
    }
    buildSystemPrompt(options) {
        let systemPrompt = options.systemPrompt || '';
        // Add context if provided
        if (options.context) {
            if (options.context.files && options.context.files.length > 0) {
                systemPrompt += '\n\n## Relevant Files:\n';
                for (const file of options.context.files) {
                    systemPrompt += `\n### ${file.path}\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n`;
                }
            }
            if (options.context.gitDiff) {
                systemPrompt += '\n\n## Git Changes:\n```diff\n' + options.context.gitDiff + '\n```\n';
            }
        }
        return systemPrompt;
    }
    buildMessages(options) {
        return [{ role: 'user', content: options.prompt }];
    }
}
exports.AnthropicProvider = AnthropicProvider;
