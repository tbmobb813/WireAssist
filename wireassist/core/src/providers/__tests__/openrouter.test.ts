import { OpenRouterProvider } from '../openrouter';

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status: 200,
    ...response,
  });
}

describe('OpenRouterProvider — constructor', () => {
  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  it('throws when no API key is provided or set in the environment', () => {
    expect(() => new OpenRouterProvider({ type: 'openrouter' })).toThrow(/API key is required/);
  });

  it('accepts an API key from config', () => {
    const provider = new OpenRouterProvider({ type: 'openrouter', apiKey: 'key-from-config' });
    expect(provider.type).toBe('openrouter');
  });

  it('accepts an API key from OPENROUTER_API_KEY', () => {
    process.env.OPENROUTER_API_KEY = 'key-from-env';
    expect(() => new OpenRouterProvider({ type: 'openrouter' })).not.toThrow();
  });

  it('defaults baseUrl to the OpenRouter API and currentModel to a sane default', () => {
    const provider = new OpenRouterProvider({ type: 'openrouter', apiKey: 'k' });
    expect(provider.currentModel).toBe('openai/gpt-4o');
  });

  it('uses the model passed in config', () => {
    const provider = new OpenRouterProvider({
      type: 'openrouter',
      apiKey: 'k',
      model: 'anthropic/claude-sonnet-4.5',
    });
    expect(provider.currentModel).toBe('anthropic/claude-sonnet-4.5');
  });
});

describe('OpenRouterProvider.complete()', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('POSTs to /chat/completions with the Bearer auth header and model/messages body', async () => {
    mockFetchOnce({
      json: async () => ({
        choices: [{ message: { content: 'Hello back' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'openai/gpt-4o',
      }),
    });

    const provider = new OpenRouterProvider({ type: 'openrouter', apiKey: 'my-key' });
    await provider.complete({ prompt: 'Hello', systemPrompt: 'Be nice' });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer my-key' }),
      })
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: 'system', content: 'Be nice' },
      { role: 'user', content: 'Hello' },
    ]);
  });

  it('maps content, tokensUsed, promptTokens, completionTokens, model, and finishReason', async () => {
    mockFetchOnce({
      json: async () => ({
        choices: [{ message: { content: 'Hello back' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'openai/gpt-4o',
      }),
    });

    const provider = new OpenRouterProvider({ type: 'openrouter', apiKey: 'my-key' });
    const result = await provider.complete({ prompt: 'Hello' });

    expect(result).toEqual({
      content: 'Hello back',
      tokensUsed: 15,
      promptTokens: 10,
      completionTokens: 5,
      model: 'openai/gpt-4o',
      finishReason: 'stop',
    });
  });

  it('sends attribution headers only when the corresponding env vars are set', async () => {
    process.env.OPENROUTER_SITE_URL = 'https://wireassist.example';
    process.env.OPENROUTER_SITE_NAME = 'WireAssist';
    mockFetchOnce({
      json: async () => ({
        choices: [{ message: { content: 'x' }, finish_reason: 'stop' }],
        model: 'm',
      }),
    });

    const provider = new OpenRouterProvider({ type: 'openrouter', apiKey: 'k' });
    await provider.complete({ prompt: 'hi' });

    const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers['HTTP-Referer']).toBe('https://wireassist.example');
    expect(headers['X-Title']).toBe('WireAssist');

    delete process.env.OPENROUTER_SITE_URL;
    delete process.env.OPENROUTER_SITE_NAME;
  });

  it('omits attribution headers when the env vars are unset', async () => {
    mockFetchOnce({
      json: async () => ({
        choices: [{ message: { content: 'x' }, finish_reason: 'stop' }],
        model: 'm',
      }),
    });

    const provider = new OpenRouterProvider({ type: 'openrouter', apiKey: 'k' });
    await provider.complete({ prompt: 'hi' });

    const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers['HTTP-Referer']).toBeUndefined();
    expect(headers['X-Title']).toBeUndefined();
  });

  it('throws with the response body on a non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'invalid key',
    });

    const provider = new OpenRouterProvider({ type: 'openrouter', apiKey: 'bad-key' });
    await expect(provider.complete({ prompt: 'hi' })).rejects.toThrow(
      /OpenRouter API error: 401 - invalid key/
    );
  });

  it('omits temperature entirely when the caller does not specify one', async () => {
    mockFetchOnce({
      json: async () => ({
        choices: [{ message: { content: 'x' }, finish_reason: 'stop' }],
        model: 'm',
      }),
    });

    const provider = new OpenRouterProvider({ type: 'openrouter', apiKey: 'k' });
    await provider.complete({ prompt: 'hi' });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).not.toHaveProperty('temperature');
  });

  it('sends temperature when the caller specifies one', async () => {
    mockFetchOnce({
      json: async () => ({
        choices: [{ message: { content: 'x' }, finish_reason: 'stop' }],
        model: 'm',
      }),
    });

    const provider = new OpenRouterProvider({ type: 'openrouter', apiKey: 'k' });
    await provider.complete({ prompt: 'hi', temperature: 0.3 });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.temperature).toBe(0.3);
  });
});

describe('OpenRouterProvider.listModels()', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('returns all model ids sorted, without an OpenAI-only prefix filter', async () => {
    mockFetchOnce({
      json: async () => ({
        data: [
          { id: 'meta/llama-3' },
          { id: 'anthropic/claude-sonnet-4.5' },
          { id: 'openai/gpt-4o' },
        ],
      }),
    });

    const provider = new OpenRouterProvider({ type: 'openrouter', apiKey: 'k' });
    const models = await provider.listModels();

    expect(models).toEqual(['anthropic/claude-sonnet-4.5', 'meta/llama-3', 'openai/gpt-4o']);
  });

  it('throws when the models endpoint fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
    const provider = new OpenRouterProvider({ type: 'openrouter', apiKey: 'k' });
    await expect(provider.listModels()).rejects.toThrow(/Failed to list models: 500/);
  });
});

describe('OpenRouterProvider.validateConfig()', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('returns true when listModels succeeds', async () => {
    mockFetchOnce({ json: async () => ({ data: [] }) });
    const provider = new OpenRouterProvider({ type: 'openrouter', apiKey: 'k' });
    expect(await provider.validateConfig()).toBe(true);
  });

  it('returns false when listModels throws', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401 });
    const provider = new OpenRouterProvider({ type: 'openrouter', apiKey: 'k' });
    expect(await provider.validateConfig()).toBe(false);
  });
});
