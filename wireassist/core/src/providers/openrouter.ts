// OpenRouter implementation — OpenAI-compatible chat completions API that
// proxies to many underlying model vendors (pass e.g. "anthropic/claude-sonnet-4.5"
// or "openai/gpt-4o" as the model).
import { Provider, ProviderCompletionOptions, ProviderResponse, ProviderType } from './base';
import type { ProviderConfig } from '../types';

interface OpenRouterMessage {
  role: 'system' | 'user';
  content: string;
}

export class OpenRouterProvider implements Provider {
  type: ProviderType = 'openrouter';
  currentModel: string;
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey || process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    this.currentModel = config.model || 'openai/gpt-4o';
    this.timeout = config.timeout || 30000;

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
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    };
    return {
      content: data.choices[0].message.content,
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
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
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
      throw new Error(`Failed to list models: ${response.status}`);
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
    const messages: OpenRouterMessage[] = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    if (options.context) {
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

      if (contextContent) {
        messages.push({ role: 'system', content: contextContent });
      }
    }

    messages.push({ role: 'user', content: options.prompt });
    return messages;
  }
}
