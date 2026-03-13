// @lai/core/src/providers/registry.ts

import type { Provider, ProviderType } from './base';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';

export class ProviderRegistry {
  private providers: Map<string, Provider>;

  constructor() {
    this.providers = new Map();
  }

  /**
   * Register a provider instance
   */
  register(provider: Provider): void {
    this.providers.set(provider.type, provider);
  }

  /**
   * Get a provider by type
   */
  get(type: ProviderType): Provider | undefined {
    return this.providers.get(type);
  }

  /**
   * Check if a provider is registered
   */
  has(type: ProviderType): boolean {
    return this.providers.has(type);
  }

  /**
   * List all registered provider types
   */
  list(): ProviderType[] {
    return Array.from(this.providers.keys()) as ProviderType[];
  }

  /**
   * Get all registered providers
   */
  getAll(): Provider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Create a registry with all default providers
   * Attempts to register all built-in providers, silently skipping those that fail
   * (e.g., due to missing API keys or unavailable services)
   */
  static createDefault(): ProviderRegistry {
    const registry = new ProviderRegistry();
    
    // Register all built-in providers with default configs
    // Note: Actual API keys must be provided when using them
    // Providers that fail to initialize (missing keys, etc.) are silently skipped
    try {
      registry.register(new OpenAIProvider({ type: 'openai' }));
    } catch (error) {
      // Provider might require API key - skip if not available
    }
    
    try {
      registry.register(new AnthropicProvider({ type: 'anthropic' }));
    } catch (error) {
      // Provider might require API key - skip if not available
    }
    
    try {
      registry.register(new GeminiProvider({ type: 'gemini' }));
    } catch (error) {
      // Provider might require API key - skip if not available
    }
    
    try {
      registry.register(new OllamaProvider({ type: 'ollama' }));
    } catch (error) {
      // Ollama might not be running - skip if not available
    }
    
    return registry;
  }

  /**
   * Detect available providers based on environment
   */
  static async detectAvailable(): Promise<ProviderType[]> {
    const available: ProviderType[] = [];
    const registry = ProviderRegistry.createDefault();

    for (const provider of registry.getAll()) {
      try {
        const isValid = await provider.validateConfig();
        if (isValid) {
          available.push(provider.type);
        }
      } catch {
        // Provider not available
      }
    }

    return available;
  }
}
