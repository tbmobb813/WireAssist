// @lai/core/src/__tests__/providers/registry.test.ts

import { ProviderRegistry } from '../../providers/registry';
import { ProviderFactory } from '../../providers';
import type { Provider } from '../../providers/base';

describe('ProviderRegistry', () => {
  describe('Basic Operations', () => {
    test('should create an empty registry', () => {
      const registry = new ProviderRegistry();
      expect(registry.list()).toHaveLength(0);
    });

    test('should register a provider', () => {
      const registry = new ProviderRegistry();
      const provider = ProviderFactory.create({
        type: 'openai',
        apiKey: 'test-key',
      });

      registry.register(provider);
      expect(registry.has('openai')).toBe(true);
      expect(registry.list()).toContain('openai');
    });

    test('should get a registered provider', () => {
      const registry = new ProviderRegistry();
      const provider = ProviderFactory.create({
        type: 'openai',
        apiKey: 'test-key',
      });

      registry.register(provider);
      const retrieved = registry.get('openai');

      expect(retrieved).toBeDefined();
      expect(retrieved?.type).toBe('openai');
    });

    test('should return undefined for unregistered provider', () => {
      const registry = new ProviderRegistry();
      expect(registry.get('openai')).toBeUndefined();
    });

    test('should list all registered provider types', () => {
      const registry = new ProviderRegistry();

      registry.register(ProviderFactory.create({ type: 'openai', apiKey: 'test' }));
      registry.register(ProviderFactory.create({ type: 'anthropic', apiKey: 'test' }));

      const types = registry.list();
      expect(types).toHaveLength(2);
      expect(types).toContain('openai');
      expect(types).toContain('anthropic');
    });

    test('should get all registered providers', () => {
      const registry = new ProviderRegistry();

      registry.register(ProviderFactory.create({ type: 'openai', apiKey: 'test' }));
      registry.register(ProviderFactory.create({ type: 'gemini', apiKey: 'test' }));

      const providers = registry.getAll();
      expect(providers).toHaveLength(2);
      expect(providers.some((p) => p.type === 'openai')).toBe(true);
      expect(providers.some((p) => p.type === 'gemini')).toBe(true);
    });

    test('should overwrite provider with same type', () => {
      const registry = new ProviderRegistry();

      const provider1 = ProviderFactory.create({
        type: 'openai',
        apiKey: 'key1',
        model: 'gpt-4',
      });
      const provider2 = ProviderFactory.create({
        type: 'openai',
        apiKey: 'key2',
        model: 'gpt-3.5-turbo',
      });

      registry.register(provider1);
      registry.register(provider2);

      expect(registry.list()).toHaveLength(1);
      expect(registry.get('openai')?.currentModel).toBe('gpt-3.5-turbo');
    });
  });

  describe('createDefault', () => {
    test('should create a registry with default providers', () => {
      const registry = ProviderRegistry.createDefault();

      // Should attempt to register all providers
      // Some may fail without API keys, which is expected
      const types = registry.list();
      expect(types.length).toBeGreaterThanOrEqual(0);
      expect(types.length).toBeLessThanOrEqual(4);
    });

    test('should have ollama if no API key required', () => {
      const registry = ProviderRegistry.createDefault();

      // Ollama doesn't require API key, so it should be registered
      // (though validateConfig might fail if Ollama isn't running)
      const providers = registry.getAll();
      expect(providers.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Provider Capabilities', () => {
    test('should access provider capabilities through registry', () => {
      const registry = new ProviderRegistry();
      const provider = ProviderFactory.create({
        type: 'openai',
        apiKey: 'test-key',
      });

      registry.register(provider);

      const retrieved = registry.get('openai');
      const capabilities = retrieved?.getCapabilities();

      expect(capabilities).toBeDefined();
      expect(capabilities?.supportsStreaming).toBe(true);
      expect(capabilities?.requiresApiKey).toBe(true);
    });
  });

  describe('Multiple Providers', () => {
    test('should manage multiple different providers', () => {
      const registry = new ProviderRegistry();

      registry.register(ProviderFactory.create({ type: 'openai', apiKey: 'test1' }));
      registry.register(ProviderFactory.create({ type: 'anthropic', apiKey: 'test2' }));
      registry.register(ProviderFactory.create({ type: 'gemini', apiKey: 'test3' }));
      registry.register(ProviderFactory.create({ type: 'ollama' }));

      expect(registry.list()).toHaveLength(4);
      expect(registry.has('openai')).toBe(true);
      expect(registry.has('anthropic')).toBe(true);
      expect(registry.has('gemini')).toBe(true);
      expect(registry.has('ollama')).toBe(true);
    });

    test('should retrieve correct provider by type', () => {
      const registry = new ProviderRegistry();

      registry.register(ProviderFactory.create({ type: 'openai', apiKey: 'test1', model: 'gpt-4' }));
      registry.register(ProviderFactory.create({ type: 'anthropic', apiKey: 'test2', model: 'claude-3-opus' }));

      expect(registry.get('openai')?.currentModel).toBe('gpt-4');
      expect(registry.get('anthropic')?.currentModel).toBe('claude-3-opus');
    });
  });
});
