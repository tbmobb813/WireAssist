// OpenAI implementation
import { Provider, ProviderCompletionOptions, ProviderResponse, ProviderType } from './base';
import type { ProviderConfig } from '../types';
import { PROVIDER_CAPABILITIES, type ProviderCapabilities } from './capabilities';

export class OpenAIProvider implements Provider {
  type: ProviderType = 'openai';
  currentModel: string;
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.currentModel = config.model || 'gpt-4';
    this.timeout = config.timeout || 30000;

    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  async complete(options: ProviderCompletionOptions): Promise<ProviderResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || this.currentModel,
        messages: this.buildMessages(options),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      usage?: { total_tokens: number };
      model: string;
    };
    return {
      content: data.choices[0].message.content,
      tokensUsed: data.usage?.total_tokens,
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
      },
      body: JSON.stringify({
        model: options.model || this.currentModel,
        messages: this.buildMessages(options),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: true,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
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
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            // Skip invalid JSON
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

    const data = (await response.json()) as { data: Array<{ id: string }> };
    return data.data
      .filter((model: any) => model.id.startsWith('gpt'))
      .map((model: any) => model.id)
      .sort();
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch {
      return false;
    }
  }

  getCapabilities(): ProviderCapabilities {
    return PROVIDER_CAPABILITIES.openai;
  }

  private buildMessages(options: ProviderCompletionOptions): any[] {
    const messages: any[] = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    // Add context if provided
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
