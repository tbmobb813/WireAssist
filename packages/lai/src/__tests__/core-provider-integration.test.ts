/**
 * @lia-code/core Provider Integration Tests
 * Verifies that @lia-code/core providers work correctly with LAI app's provider system
 */

import { describe, it, expect } from 'vitest';
import { ProviderFactory } from '@lia-code/core';
import type {
  ProviderCompletionOptions,
  ProviderResponse,
} from '@lia-code/core';

describe('@lia-code/core Provider Integration', () => {
  describe('ProviderFactory', () => {
    it('should create OpenAI provider', () => {
      const provider = ProviderFactory.create({
        type: 'openai',
        apiKey: 'sk-test-key',
        model: 'gpt-4',
      });

      expect(provider).toBeDefined();
      expect(provider.type).toBe('openai');
      expect(provider.currentModel).toBe('gpt-4');
    });

    it('should create Anthropic provider', () => {
      const provider = ProviderFactory.create({
        type: 'anthropic',
        apiKey: 'sk-ant-test-key',
        model: 'claude-3-sonnet-20240229',
      });

      expect(provider).toBeDefined();
      expect(provider.type).toBe('anthropic');
      expect(provider.currentModel).toBe('claude-3-sonnet-20240229');
    });

    it('should create Gemini provider', () => {
      const provider = ProviderFactory.create({
        type: 'gemini',
        apiKey: 'test-gemini-key',
        model: 'gemini-1.5-pro',
      });

      expect(provider).toBeDefined();
      expect(provider.type).toBe('gemini');
      expect(provider.currentModel).toBe('gemini-1.5-pro');
    });

    it('should create Ollama provider', () => {
      const provider = ProviderFactory.create({
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'llama2',
      });

      expect(provider).toBeDefined();
      expect(provider.type).toBe('ollama');
      expect(provider.currentModel).toBe('llama2');
    });

    it('should throw error for unknown provider type', () => {
      expect(() => {
        ProviderFactory.create({
          type: 'unknown' as any,
        });
      }).toThrow();
    });
  });

  describe('Provider Configuration', () => {
    it('should create provider with custom model', () => {
      const provider = ProviderFactory.create({
        type: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-3.5-turbo',
      });

      expect(provider.currentModel).toBe('gpt-3.5-turbo');
    });

    it('should use default model when not specified', () => {
      const provider = ProviderFactory.create({
        type: 'anthropic',
        apiKey: 'sk-ant-test',
        // No model specified
      });

      expect(provider.currentModel).toBeDefined();
      expect(typeof provider.currentModel).toBe('string');
    });

    it('should handle Ollama base URL configuration', () => {
      const provider = ProviderFactory.create({
        type: 'ollama',
        baseUrl: 'http://custom-host:11434',
        model: 'mistral',
      });

      expect(provider).toBeDefined();
      expect(provider.type).toBe('ollama');
    });

    it('should throw error when required API key is missing', () => {
      expect(() => {
        ProviderFactory.create({
          type: 'openai',
          // Missing apiKey
        });
      }).toThrow();
    });

    it('should throw error for Anthropic without API key', () => {
      expect(() => {
        ProviderFactory.create({
          type: 'anthropic',
          // Missing apiKey
        });
      }).toThrow();
    });

    it('should throw error for Gemini without API key', () => {
      expect(() => {
        ProviderFactory.create({
          type: 'gemini',
          // Missing apiKey
        });
      }).toThrow();
    });
  });

  describe('Provider Interface', () => {
    it('should implement complete method', () => {
      const provider = ProviderFactory.create({
        type: 'openai',
        apiKey: 'sk-test',
      });

      expect(typeof provider.complete).toBe('function');
    });

    it('should implement stream method', () => {
      const provider = ProviderFactory.create({
        type: 'openai',
        apiKey: 'sk-test',
      });

      expect(typeof provider.stream).toBe('function');
    });

    it('should implement listModels method', () => {
      const provider = ProviderFactory.create({
        type: 'openai',
        apiKey: 'sk-test',
      });

      expect(typeof provider.listModels).toBe('function');
    });

    it('should implement validateConfig method', () => {
      const provider = ProviderFactory.create({
        type: 'openai',
        apiKey: 'sk-test',
      });

      expect(typeof provider.validateConfig).toBe('function');
    });

    it('should have type property', () => {
      const provider = ProviderFactory.create({
        type: 'anthropic',
        apiKey: 'sk-ant-test',
      });

      expect(provider.type).toBe('anthropic');
    });

    it('should have currentModel property', () => {
      const provider = ProviderFactory.create({
        type: 'gemini',
        apiKey: 'test-key',
        model: 'gemini-1.5-pro',
      });

      expect(provider.currentModel).toBe('gemini-1.5-pro');
    });
  });

  describe('Provider Types Support', () => {
    const supportedTypes = ['openai', 'anthropic', 'gemini', 'ollama'] as const;

    supportedTypes.forEach((type) => {
      it(`should support ${type} provider type`, () => {
        const config: any =
          type === 'ollama'
            ? {
                type,
                baseUrl: 'http://localhost:11434',
                model: 'test-model',
              }
            : {
                type,
                apiKey: 'test-key',
                model: 'test-model',
              };

        const provider = ProviderFactory.create(config);

        expect(provider).toBeDefined();
        expect(provider.type).toBe(type);
      });
    });

    it('should create multiple providers simultaneously', () => {
      const openai = ProviderFactory.create({
        type: 'openai',
        apiKey: 'sk-test-openai',
      });

      const anthropic = ProviderFactory.create({
        type: 'anthropic',
        apiKey: 'sk-ant-test-anthropic',
      });

      const gemini = ProviderFactory.create({
        type: 'gemini',
        apiKey: 'test-gemini',
      });

      const ollama = ProviderFactory.create({
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
      });

      expect(openai.type).toBe('openai');
      expect(anthropic.type).toBe('anthropic');
      expect(gemini.type).toBe('gemini');
      expect(ollama.type).toBe('ollama');
    });
  });

  describe('Provider Settings Integration', () => {
    it('should support dynamic provider switching', () => {
      // Simulate switching providers based on settings
      const settings = {
        defaultProvider: 'openai',
        defaultModel: 'gpt-4',
        apiKeys: {
          openai: 'sk-test-openai',
          anthropic: 'sk-ant-test',
          gemini: 'test-gemini',
        },
      };

      // Create provider based on settings
      const provider = ProviderFactory.create({
        type: settings.defaultProvider as any,
        apiKey: settings.apiKeys[settings.defaultProvider as keyof typeof settings.apiKeys],
        model: settings.defaultModel,
      });

      expect(provider.type).toBe('openai');
      expect(provider.currentModel).toBe('gpt-4');
    });

    it('should support model switching within a provider', () => {
      const openai1 = ProviderFactory.create({
        type: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4',
      });

      const openai2 = ProviderFactory.create({
        type: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-3.5-turbo',
      });

      expect(openai1.currentModel).toBe('gpt-4');
      expect(openai2.currentModel).toBe('gpt-3.5-turbo');
    });

    it('should handle API key updates for provider', () => {
      // Each provider instance is independent
      const provider1 = ProviderFactory.create({
        type: 'openai',
        apiKey: 'sk-old-key',
      });

      const provider2 = ProviderFactory.create({
        type: 'openai',
        apiKey: 'sk-new-key',
      });

      // Both providers are created with their respective keys
      expect(provider1.type).toBe('openai');
      expect(provider2.type).toBe('openai');
      // In real usage, the new provider instance would be used
    });
  });

  describe('Provider Completion Options', () => {
    it('should accept valid completion options', () => {
      const provider = ProviderFactory.create({
        type: 'openai',
        apiKey: 'sk-test',
      });

      const options: ProviderCompletionOptions = {
        prompt: 'What is TypeScript?',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 100,
      };

      // Verify the type is valid (compile-time check)
      expect(options.prompt).toBe('What is TypeScript?');
      expect(options.model).toBe('gpt-4');
      expect(options.temperature).toBe(0.7);
    });

    it('should support optional completion options', () => {
      const provider = ProviderFactory.create({
        type: 'anthropic',
        apiKey: 'sk-ant-test',
      });

      const options: ProviderCompletionOptions = {
        prompt: 'Explain quantum computing',
        // Other fields are optional
      };

      expect(options).toBeDefined();
    });

    it('should support context in completion options', () => {
      const provider = ProviderFactory.create({
        type: 'gemini',
        apiKey: 'test-key',
      });

      const options: ProviderCompletionOptions = {
        prompt: 'Summarize this code',
        context: {
          files: [],
          workspaceStructure: '',
        },
      };

      expect(options.context).toBeDefined();
    });
  });

  describe('Multi-Provider Workflow', () => {
    it('should support provider comparison workflow', () => {
      const providers = [
        {
          type: 'openai' as const,
          apiKey: 'sk-test',
          name: 'OpenAI (GPT-4)',
        },
        {
          type: 'anthropic' as const,
          apiKey: 'sk-ant-test',
          name: 'Anthropic (Claude)',
        },
        {
          type: 'gemini' as const,
          apiKey: 'test-key',
          name: 'Google Gemini',
        },
      ];

      const providerInstances = providers.map((p) =>
        ProviderFactory.create({
          type: p.type,
          apiKey: p.apiKey,
        })
      );

      expect(providerInstances).toHaveLength(3);
      providerInstances.forEach((instance, i) => {
        expect(instance.type).toBe(providers[i].type);
      });
    });

    it('should handle provider fallback scenarios', () => {
      const primaryProvider = ProviderFactory.create({
        type: 'openai',
        apiKey: 'sk-primary',
      });

      const fallbackProvider = ProviderFactory.create({
        type: 'anthropic',
        apiKey: 'sk-ant-fallback',
      });

      // In a real scenario, if primary fails, fallback would be used
      expect(primaryProvider.type).toBe('openai');
      expect(fallbackProvider.type).toBe('anthropic');
    });
  });
});
