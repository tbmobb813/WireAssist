// @lai/core/src/__tests__/providers/capabilities.test.ts

import { PROVIDER_CAPABILITIES } from '../../providers/capabilities';
import { ProviderFactory } from '../../providers';

describe('Provider Capabilities', () => {
  describe('PROVIDER_CAPABILITIES', () => {
    test('should have capabilities for all providers', () => {
      expect(PROVIDER_CAPABILITIES.openai).toBeDefined();
      expect(PROVIDER_CAPABILITIES.anthropic).toBeDefined();
      expect(PROVIDER_CAPABILITIES.gemini).toBeDefined();
      expect(PROVIDER_CAPABILITIES.ollama).toBeDefined();
    });

    test('openai capabilities should be correct', () => {
      const caps = PROVIDER_CAPABILITIES.openai;

      expect(caps.supportsStreaming).toBe(true);
      expect(caps.supportsEmbeddings).toBe(true);
      expect(caps.supportsVision).toBe(true);
      expect(caps.requiresApiKey).toBe(true);
      expect(caps.maxContextLength).toBe(128000);
      expect(caps.features?.functionCalling).toBe(true);
      expect(caps.features?.jsonMode).toBe(true);
      expect(caps.features?.toolUse).toBe(true);
    });

    test('anthropic capabilities should be correct', () => {
      const caps = PROVIDER_CAPABILITIES.anthropic;

      expect(caps.supportsStreaming).toBe(true);
      expect(caps.supportsEmbeddings).toBe(false);
      expect(caps.supportsVision).toBe(true);
      expect(caps.requiresApiKey).toBe(true);
      expect(caps.maxContextLength).toBe(200000);
      expect(caps.features?.functionCalling).toBe(true);
      expect(caps.features?.toolUse).toBe(true);
    });

    test('gemini capabilities should be correct', () => {
      const caps = PROVIDER_CAPABILITIES.gemini;

      expect(caps.supportsStreaming).toBe(true);
      expect(caps.supportsEmbeddings).toBe(false);
      expect(caps.supportsVision).toBe(true);
      expect(caps.requiresApiKey).toBe(true);
      expect(caps.maxContextLength).toBe(1000000);
      expect(caps.features?.functionCalling).toBe(true);
    });

    test('ollama capabilities should be correct', () => {
      const caps = PROVIDER_CAPABILITIES.ollama;

      expect(caps.supportsStreaming).toBe(true);
      expect(caps.supportsEmbeddings).toBe(true);
      expect(caps.supportsVision).toBe(false);
      expect(caps.requiresApiKey).toBe(false);
      expect(caps.maxContextLength).toBe(4096);
    });
  });

  describe('Provider.getCapabilities()', () => {
    test('openai provider should return correct capabilities', () => {
      const provider = ProviderFactory.create({
        type: 'openai',
        apiKey: 'test-key',
      });

      const caps = provider.getCapabilities();

      expect(caps).toEqual(PROVIDER_CAPABILITIES.openai);
    });

    test('anthropic provider should return correct capabilities', () => {
      const provider = ProviderFactory.create({
        type: 'anthropic',
        apiKey: 'test-key',
      });

      const caps = provider.getCapabilities();

      expect(caps).toEqual(PROVIDER_CAPABILITIES.anthropic);
    });

    test('gemini provider should return correct capabilities', () => {
      const provider = ProviderFactory.create({
        type: 'gemini',
        apiKey: 'test-key',
      });

      const caps = provider.getCapabilities();

      expect(caps).toEqual(PROVIDER_CAPABILITIES.gemini);
    });

    test('ollama provider should return correct capabilities', () => {
      const provider = ProviderFactory.create({
        type: 'ollama',
      });

      const caps = provider.getCapabilities();

      expect(caps).toEqual(PROVIDER_CAPABILITIES.ollama);
    });
  });

  describe('ProviderFactory.getCapabilities()', () => {
    test('should get capabilities without instantiating provider', () => {
      const caps = ProviderFactory.getCapabilities('openai');

      expect(caps).toBeDefined();
      expect(caps?.supportsStreaming).toBe(true);
      expect(caps?.requiresApiKey).toBe(true);
    });

    test('should work for all provider types', () => {
      expect(ProviderFactory.getCapabilities('openai')).toBeDefined();
      expect(ProviderFactory.getCapabilities('anthropic')).toBeDefined();
      expect(ProviderFactory.getCapabilities('gemini')).toBeDefined();
      expect(ProviderFactory.getCapabilities('ollama')).toBeDefined();
    });

    test('should allow checking features before creating provider', () => {
      const openaiCaps = ProviderFactory.getCapabilities('openai');
      const anthropicCaps = ProviderFactory.getCapabilities('anthropic');

      // Can check if provider supports a feature before instantiation
      expect(openaiCaps?.supportsEmbeddings).toBe(true);
      expect(anthropicCaps?.supportsEmbeddings).toBe(false);
    });
  });

  describe('Capability-based provider selection', () => {
    test('should be able to filter providers by capability', () => {
      const providerTypes: Array<'openai' | 'anthropic' | 'gemini' | 'ollama'> = [
        'openai',
        'anthropic',
        'gemini',
        'ollama',
      ];

      const streamingProviders = providerTypes.filter((type) => {
        const caps = ProviderFactory.getCapabilities(type);
        return caps?.supportsStreaming;
      });

      // All providers support streaming
      expect(streamingProviders).toHaveLength(4);
    });

    test('should filter providers that support embeddings', () => {
      const providerTypes: Array<'openai' | 'anthropic' | 'gemini' | 'ollama'> = [
        'openai',
        'anthropic',
        'gemini',
        'ollama',
      ];

      const embeddingProviders = providerTypes.filter((type) => {
        const caps = ProviderFactory.getCapabilities(type);
        return caps?.supportsEmbeddings;
      });

      expect(embeddingProviders).toContain('openai');
      expect(embeddingProviders).toContain('ollama');
      expect(embeddingProviders).not.toContain('anthropic');
      expect(embeddingProviders).not.toContain('gemini');
    });

    test('should filter providers that do not require API key', () => {
      const providerTypes: Array<'openai' | 'anthropic' | 'gemini' | 'ollama'> = [
        'openai',
        'anthropic',
        'gemini',
        'ollama',
      ];

      const noKeyProviders = providerTypes.filter((type) => {
        const caps = ProviderFactory.getCapabilities(type);
        return !caps?.requiresApiKey;
      });

      expect(noKeyProviders).toEqual(['ollama']);
    });

    test('should find provider with largest context window', () => {
      const providerTypes: Array<'openai' | 'anthropic' | 'gemini' | 'ollama'> = [
        'openai',
        'anthropic',
        'gemini',
        'ollama',
      ];

      const largestContext = providerTypes.reduce((largest, type) => {
        const caps = ProviderFactory.getCapabilities(type);
        const largestCaps = ProviderFactory.getCapabilities(largest);
        return (caps?.maxContextLength || 0) > (largestCaps?.maxContextLength || 0)
          ? type
          : largest;
      });

      expect(largestContext).toBe('gemini'); // 1M tokens
    });
  });
});
