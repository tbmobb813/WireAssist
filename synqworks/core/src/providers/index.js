"use strict";
// @lai/core/src/providers/index.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderFactory = void 0;
const openai_1 = require("./openai");
const anthropic_1 = require("./anthropic");
const gemini_1 = require("./gemini");
const ollama_1 = require("./ollama");
class ProviderFactory {
    static create(config) {
        switch (config.type) {
            case 'openai':
                return new openai_1.OpenAIProvider(config);
            case 'anthropic':
                return new anthropic_1.AnthropicProvider(config);
            case 'gemini':
                return new gemini_1.GeminiProvider(config);
            case 'ollama':
                return new ollama_1.OllamaProvider(config);
            default:
                throw new Error(`Unknown provider type: ${config.type}`);
        }
    }
    static async detectAvailable() {
        const available = [];
        // Check Ollama
        try {
            const ollama = new ollama_1.OllamaProvider({ type: 'ollama' });
            if (await ollama.validateConfig()) {
                available.push('ollama');
            }
        }
        catch { }
        // Check for API keys in environment
        if (process.env.OPENAI_API_KEY)
            available.push('openai');
        if (process.env.ANTHROPIC_API_KEY)
            available.push('anthropic');
        if (process.env.GEMINI_API_KEY)
            available.push('gemini');
        return available;
    }
}
exports.ProviderFactory = ProviderFactory;
