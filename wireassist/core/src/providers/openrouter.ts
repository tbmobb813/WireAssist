// OpenRouter implementation — OpenAI-compatible chat completions API that
// proxies to many underlying model vendors (pass e.g. "anthropic/claude-sonnet-4.5"
// or "openai/gpt-4o" as the model).
import {
  Provider,
  ProviderCompletionOptions,
  ProviderContentBlock,
  ProviderResponse,
  ProviderType,
  ProviderToolCall,
  ProviderHttpError,
} from './base';
import type { ProviderConfig } from '../types';

// OpenAI-compatible chat message shapes, just the parts this provider
// reads/writes. `tool_calls`/`tool_call_id` follow OpenAI's function-calling
// wire format (arguments as a JSON *string*, not an object).
interface OpenRouterToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}
type OpenRouterUserContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };
type OpenRouterMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | OpenRouterUserContentBlock[] }
  | { role: 'assistant'; content: string | null; tool_calls?: OpenRouterToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

// Translates a provider-agnostic user turn into OpenAI-compatible wire
// format. Images become data: URIs (image_url blocks) — OpenRouter proxies
// to many vendors, and the data: URI form is the one that works uniformly
// across them, unlike Anthropic's separate base64 source object.
// Document blocks are dropped here defensively — this provider never
// declares supportsDocuments, so base-agent.ts's runToolLoop() already
// strips documents (with a visible note) before content ever reaches this
// function, and completeWithFallback() skips the OpenRouter retry entirely
// for document-bearing requests. This filter should never actually run;
// it exists so a future caller that skips those guards fails safe (drops
// the attachment) instead of sending OpenRouter something it can't use.
function toOpenRouterUserContent(
  content: string | ProviderContentBlock[]
): string | OpenRouterUserContentBlock[] {
  if (typeof content === 'string') return content;
  return content.flatMap((block): OpenRouterUserContentBlock[] => {
    if (block.type === 'image') {
      return [
        { type: 'image_url', image_url: { url: `data:${block.mediaType};base64,${block.data}` } },
      ];
    }
    if (block.type === 'document') return [];
    return [{ type: 'text', text: block.text }];
  });
}

export class OpenRouterProvider implements Provider {
  type: ProviderType = 'openrouter';
  supportsTools = true;
  supportsVision = true;
  currentModel: string;
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey || process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    this.currentModel = config.model || 'openai/gpt-4o';
    this.timeout = config.timeout || 180000;

    if (!this.apiKey) {
      throw new Error('OpenRouter API key is required');
    }
  }

  // OpenRouter recommends these for attribution/rankings — best-effort, not required.
  private attributionHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (process.env.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL;
    if (process.env.OPENROUTER_SITE_NAME) headers['X-Title'] = process.env.OPENROUTER_SITE_NAME;
    return headers;
  }

  async complete(options: ProviderCompletionOptions): Promise<ProviderResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...this.attributionHeaders(),
      },
      body: JSON.stringify({
        model: options.model || this.currentModel,
        messages: this.buildMessages(options),
        // Only send temperature when a caller actually asked for one — some
        // underlying models OpenRouter proxies to reject it outright.
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        max_tokens: options.maxTokens,
        // No tool_choice: leave it at the default ("auto") so the model can
        // end the loop with a plain-text answer instead of being forced to
        // call a tool every turn — same reasoning as AnthropicProvider.
        ...(options.tools?.length
          ? {
              tools: options.tools.map((t) => ({
                type: 'function' as const,
                function: { name: t.name, description: t.description, parameters: t.inputSchema },
              })),
            }
          : {}),
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ProviderHttpError(
        'openrouter',
        response.status,
        `OpenRouter API error: ${response.status} - ${error}`
      );
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: { content: string | null; tool_calls?: OpenRouterToolCall[] };
        finish_reason: string;
      }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    };

    const message = data.choices[0].message;
    const toolCalls: ProviderToolCall[] = (message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments),
    }));

    return {
      // OpenAI-compatible APIs return content: null when the model only
      // calls tools, unlike Anthropic's content-block array.
      content: message.content ?? '',
      ...(toolCalls.length ? { toolCalls } : {}),
      tokensUsed: data.usage?.total_tokens,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      model: data.model,
      finishReason: data.choices[0].finish_reason,
    };
  }

  async stream(options: ProviderCompletionOptions): Promise<AsyncGenerator<string>> {
    return this.streamGenerator(options);
  }

  private async *streamGenerator(options: ProviderCompletionOptions): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...this.attributionHeaders(),
      },
      body: JSON.stringify({
        model: options.model || this.currentModel,
        messages: this.buildMessages(options),
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        max_tokens: options.maxTokens,
        stream: true,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ProviderHttpError(
        'openrouter',
        response.status,
        `OpenRouter API error: ${response.status} - ${error}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Skip invalid JSON (e.g. OpenRouter's SSE keep-alive comments)
          }
        }
      }
    }
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new ProviderHttpError(
        'openrouter',
        response.status,
        `Failed to list models: ${response.status}`
      );
    }

    // OpenRouter aggregates many vendors — unlike OpenAIProvider, no name-prefix filter.
    const data = (await response.json()) as { data: Array<{ id: string }> };
    return data.data.map((model) => model.id).sort();
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch {
      return false;
    }
  }

  private buildMessages(options: ProviderCompletionOptions): OpenRouterMessage[] {
    if (!options.messages?.length) {
      const messages: OpenRouterMessage[] = [];
      if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
      const contextContent = this.buildContextContent(options);
      if (contextContent) messages.push({ role: 'system', content: contextContent });
      messages.push({ role: 'user', content: options.prompt });
      return messages;
    }

    // Translate the provider-agnostic turn history into OpenAI's wire
    // format. Unlike Anthropic, OpenAI has a real `tool` role — each tool
    // result is its own message, no coalescing needed.
    const messages: OpenRouterMessage[] = [];
    if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
    const contextContent = this.buildContextContent(options);
    if (contextContent) messages.push({ role: 'system', content: contextContent });

    for (const message of options.messages) {
      if (message.role === 'user') {
        messages.push({ role: 'user', content: toOpenRouterUserContent(message.content) });
        continue;
      }
      if (message.role === 'assistant') {
        const tool_calls = (message.toolCalls ?? []).map((call) => ({
          id: call.id,
          type: 'function' as const,
          function: { name: call.name, arguments: JSON.stringify(call.input) },
        }));
        messages.push({
          role: 'assistant',
          content: message.content || null,
          ...(tool_calls.length ? { tool_calls } : {}),
        });
        continue;
      }
      // role === 'tool_result'
      messages.push({ role: 'tool', tool_call_id: message.toolCallId, content: message.content });
    }
    return messages;
  }

  private buildContextContent(options: ProviderCompletionOptions): string {
    if (!options.context) return '';
    let contextContent = '';

    if (options.context.files && options.context.files.length > 0) {
      contextContent += '\n\n## Relevant Files:\n';
      for (const file of options.context.files) {
        contextContent += `\n### ${file.path}\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n`;
      }
    }

    if (options.context.gitDiff) {
      contextContent += '\n\n## Git Changes:\n```diff\n' + options.context.gitDiff + '\n```\n';
    }

    return contextContent;
  }
}
