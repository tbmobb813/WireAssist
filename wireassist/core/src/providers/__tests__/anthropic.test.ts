import { AnthropicProvider } from '../anthropic';

describe('AnthropicProvider — constructor', () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('throws when no API key is provided or set in the environment', () => {
    expect(() => new AnthropicProvider({ type: 'anthropic' })).toThrow(/API key is required/);
  });

  it('accepts an API key from config', () => {
    const provider = new AnthropicProvider({ type: 'anthropic', apiKey: 'k' });
    expect(provider.type).toBe('anthropic');
  });
});

describe('AnthropicProvider.complete()', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('joins all text-type content blocks, not just the first', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          { type: 'text', text: 'Part one. ' },
          { type: 'text', text: 'Part two.' },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-sonnet-5',
        stop_reason: 'end_turn',
      }),
    });

    const provider = new AnthropicProvider({ type: 'anthropic', apiKey: 'k' });
    const result = await provider.complete({ prompt: 'hi' });

    expect(result.content).toBe('Part one. Part two.');
  });

  it('skips non-text blocks when joining content', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [
          { type: 'text', text: 'Visible.' },
          { type: 'tool_use', text: undefined },
        ],
        usage: { input_tokens: 1, output_tokens: 1 },
        model: 'claude-sonnet-5',
        stop_reason: 'end_turn',
      }),
    });

    const provider = new AnthropicProvider({ type: 'anthropic', apiKey: 'k' });
    const result = await provider.complete({ prompt: 'hi' });

    expect(result.content).toBe('Visible.');
  });

  it('populates promptTokens/completionTokens/tokensUsed from usage', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'x' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-sonnet-5',
        stop_reason: 'end_turn',
      }),
    });

    const provider = new AnthropicProvider({ type: 'anthropic', apiKey: 'k' });
    const result = await provider.complete({ prompt: 'hi' });

    expect(result.promptTokens).toBe(10);
    expect(result.completionTokens).toBe(5);
    expect(result.tokensUsed).toBe(15);
  });

  it('sends the x-api-key and anthropic-version headers', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'x' }],
        model: 'claude-sonnet-5',
        stop_reason: 'end_turn',
      }),
    });

    const provider = new AnthropicProvider({ type: 'anthropic', apiKey: 'my-key' });
    await provider.complete({ prompt: 'hi' });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'my-key',
          'anthropic-version': '2023-06-01',
        }),
      })
    );
  });

  it('throws with the response body on a non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'invalid key',
    });

    const provider = new AnthropicProvider({ type: 'anthropic', apiKey: 'bad-key' });
    await expect(provider.complete({ prompt: 'hi' })).rejects.toThrow(
      /Anthropic API error: 401 - invalid key/
    );
  });
});
