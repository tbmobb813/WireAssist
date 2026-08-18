import { AnthropicProvider } from '../anthropic';
import { ProviderHttpError } from '../base';
import type { ProviderMessage, ProviderToolDefinition } from '../base';

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

  it('throws a ProviderHttpError carrying the real status code', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 529,
      text: async () => 'overloaded',
    });

    const provider = new AnthropicProvider({ type: 'anthropic', apiKey: 'k' });
    let caught: unknown;
    try {
      await provider.complete({ prompt: 'hi' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ProviderHttpError);
    expect((caught as ProviderHttpError).provider).toBe('anthropic');
    expect((caught as ProviderHttpError).status).toBe(529);
  });

  it('omits temperature entirely when the caller does not specify one', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'x' }],
        model: 'claude-sonnet-5',
        stop_reason: 'end_turn',
      }),
    });

    const provider = new AnthropicProvider({ type: 'anthropic', apiKey: 'k' });
    await provider.complete({ prompt: 'hi' });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).not.toHaveProperty('temperature');
  });

  it('sends temperature when the caller specifies one', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'x' }],
        model: 'claude-sonnet-5',
        stop_reason: 'end_turn',
      }),
    });

    const provider = new AnthropicProvider({ type: 'anthropic', apiKey: 'k' });
    await provider.complete({ prompt: 'hi', temperature: 0.3 });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.temperature).toBe(0.3);
  });
});

describe('AnthropicProvider tool-calling', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  const tool: ProviderToolDefinition = {
    name: 'gmail_search',
    description: 'Search email',
    inputSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
  };

  function mockResponse(body: unknown) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => body });
  }

  it('omits `tools` from the request body when none are passed', async () => {
    mockResponse({
      content: [{ type: 'text', text: 'hi' }],
      model: 'claude-sonnet-5',
      stop_reason: 'end_turn',
    });
    const provider = new AnthropicProvider({ type: 'anthropic', apiKey: 'k' });
    await provider.complete({ prompt: 'hello' });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
  });

  it('sends tools as input_schema-shaped definitions and never forces tool_choice', async () => {
    mockResponse({
      content: [{ type: 'text', text: 'hi' }],
      model: 'claude-sonnet-5',
      stop_reason: 'end_turn',
    });
    const provider = new AnthropicProvider({ type: 'anthropic', apiKey: 'k' });
    await provider.complete({ prompt: 'search my inbox', tools: [tool] });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.tools).toEqual([
      { name: 'gmail_search', description: 'Search email', input_schema: tool.inputSchema },
    ]);
    expect(body.tool_choice).toBeUndefined();
  });

  it('parses tool_use content blocks into response.toolCalls', async () => {
    mockResponse({
      content: [
        { type: 'text', text: "I'll check that." },
        { type: 'tool_use', id: 'call_1', name: 'gmail_search', input: { q: 'from:x' } },
      ],
      model: 'claude-sonnet-5',
      stop_reason: 'tool_use',
    });
    const provider = new AnthropicProvider({ type: 'anthropic', apiKey: 'k' });
    const response = await provider.complete({ prompt: 'search', tools: [tool] });

    expect(response.content).toBe("I'll check that.");
    expect(response.toolCalls).toEqual([
      { id: 'call_1', name: 'gmail_search', input: { q: 'from:x' } },
    ]);
    expect(response.finishReason).toBe('tool_use');
  });

  it('leaves toolCalls undefined on a plain text-only response', async () => {
    mockResponse({
      content: [{ type: 'text', text: 'just an answer' }],
      model: 'claude-sonnet-5',
      stop_reason: 'end_turn',
    });
    const provider = new AnthropicProvider({ type: 'anthropic', apiKey: 'k' });
    const response = await provider.complete({ prompt: 'hi' });
    expect(response.toolCalls).toBeUndefined();
  });

  it('falls back to the single-prompt message shape when no `messages` history is given', async () => {
    mockResponse({
      content: [{ type: 'text', text: 'ok' }],
      model: 'claude-sonnet-5',
      stop_reason: 'end_turn',
    });
    const provider = new AnthropicProvider({ type: 'anthropic', apiKey: 'k' });
    await provider.complete({ prompt: 'hello there' });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.messages).toEqual([{ role: 'user', content: 'hello there' }]);
  });

  it('translates a multi-turn tool-calling history into alternating user/assistant turns', async () => {
    mockResponse({
      content: [{ type: 'text', text: 'final answer' }],
      model: 'claude-sonnet-5',
      stop_reason: 'end_turn',
    });
    const provider = new AnthropicProvider({ type: 'anthropic', apiKey: 'k' });

    const messages: ProviderMessage[] = [
      { role: 'user', content: 'search my inbox for invoices' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'call_1', name: 'gmail_search', input: { q: 'invoice' } },
          { id: 'call_2', name: 'gmail_search', input: { q: 'receipt' } },
        ],
      },
      { role: 'tool_result', toolCallId: 'call_1', content: '[]' },
      { role: 'tool_result', toolCallId: 'call_2', content: '[{"id":"t1"}]' },
    ];

    await provider.complete({ prompt: 'search my inbox for invoices', messages, tools: [tool] });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: 'user', content: 'search my inbox for invoices' },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'call_1', name: 'gmail_search', input: { q: 'invoice' } },
          { type: 'tool_use', id: 'call_2', name: 'gmail_search', input: { q: 'receipt' } },
        ],
      },
      // Both tool results from the same assistant turn must be coalesced
      // into a single user message — Anthropic requires strictly
      // alternating roles, so two separate user turns here would be
      // rejected by the API.
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'call_1', content: '[]', is_error: undefined },
          {
            type: 'tool_result',
            tool_use_id: 'call_2',
            content: '[{"id":"t1"}]',
            is_error: undefined,
          },
        ],
      },
    ]);
  });
});
