import { ProviderFactory } from '../../providers';

describe('ProviderFactory', () => {
  test('should create OpenAI provider', () => {
    const provider = ProviderFactory.create({
      type: 'openai',
      apiKey: 'test-key',
      model: 'gpt-4',
    });

    expect(provider).toBeDefined();
    expect(provider.type).toBe('openai');
    expect(provider.currentModel).toBe('gpt-4');
  });

  test('should create Anthropic provider', () => {
    const provider = ProviderFactory.create({
      type: 'anthropic',
      apiKey: 'test-key',
      model: 'claude-3-opus',
    });

    expect(provider).toBeDefined();
    expect(provider.type).toBe('anthropic');
    expect(provider.currentModel).toBe('claude-3-opus');
  });

  test('should create Gemini provider', () => {
    const provider = ProviderFactory.create({
      type: 'gemini',
      apiKey: 'test-key',
      model: 'gemini-pro',
    });

    expect(provider).toBeDefined();
    expect(provider.type).toBe('gemini');
    expect(provider.currentModel).toBe('gemini-pro');
  });

  test('should create Ollama provider', () => {
    const provider = ProviderFactory.create({
      type: 'ollama',
      model: 'llama2',
    });

    expect(provider).toBeDefined();
    expect(provider.type).toBe('ollama');
    expect(provider.currentModel).toBe('llama2');
  });

  test('should throw error for unknown provider type', () => {
    expect(() => {
      ProviderFactory.create({
        type: 'unknown' as any,
      });
    }).toThrow('Unknown provider type');
  });

  test('should throw error when API key missing for OpenAI', () => {
    expect(() => {
      ProviderFactory.create({
        type: 'openai',
        model: 'gpt-4',
      });
    }).toThrow('API key is required');
  });
});
