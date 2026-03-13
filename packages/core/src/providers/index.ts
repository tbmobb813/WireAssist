// @lai/core/src/providers/index.ts

import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';
import type { Provider, ProviderType } from './base';
import type { ProviderConfig } from '../types';
import { PROVIDER_CAPABILITIES, type ProviderCapabilities } from './capabilities';

export class ProviderFactory {
  static create(config: ProviderConfig): Provider {
    switch (config.type) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'gemini':
        return new GeminiProvider(config);
      case 'ollama':
        return new OllamaProvider(config);
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }
  }

  static async detectAvailable(): Promise<ProviderType[]> {
    const available: ProviderType[] = [];

    // Check Ollama
    try {
      const ollama = new OllamaProvider({ type: 'ollama' });
      if (await ollama.validateConfig()) {
        available.push('ollama');
      }
    } catch {}

    // Check for API keys in environment
    if (process.env.OPENAI_API_KEY) available.push('openai');
    if (process.env.ANTHROPIC_API_KEY) available.push('anthropic');
    if (process.env.GEMINI_API_KEY) available.push('gemini');

    return available;
  }

  /**
   * Get provider capabilities without instantiating
   */
  static getCapabilities(type: ProviderType): ProviderCapabilities | undefined {
    return PROVIDER_CAPABILITIES[type];
  }
}

// Re-export new components
export { ProviderRegistry } from './registry';
export { StreamManager, handleStream } from './streaming';
export { PROVIDER_CAPABILITIES } from './capabilities';
export type { ProviderCapabilities } from './capabilities';
export type { StreamCallbacks } from './streaming';
