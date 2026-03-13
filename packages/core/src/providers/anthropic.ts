// Anthropic/Claude implementation
import { Provider, ProviderCompletionOptions, ProviderResponse, ProviderType } from './base';
import type { ProviderConfig } from '../types';
import { PROVIDER_CAPABILITIES, type ProviderCapabilities } from './capabilities';

export class AnthropicProvider implements Provider {
  type: ProviderType = 'anthropic';
  currentModel: string;
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    this.currentModel = config.model || 'claude-3-5-sonnet-20241022';
    this.timeout = config.timeout || 30000;

    if (!this.apiKey) {
      throw new Error('Anthropic API key is required');
    }
  }

  async complete(options: ProviderCompletionOptions): Promise<ProviderResponse> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model || this.currentModel,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        system: this.buildSystemPrompt(options),
        messages: this.buildMessages(options),
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      content: Array<{ text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
      model: string;
      stop_reason: string;
    };
    return {
      content: data.content[0].text,
      tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      model: data.model,
      finishReason: data.stop_reason,
    };
  }

  async stream(options: ProviderCompletionOptions): Promise<AsyncGenerator<string>> {
    return this.streamGenerator(options);
  }

  private async *streamGenerator(options: ProviderCompletionOptions): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model || this.currentModel,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        system: this.buildSystemPrompt(options),
        messages: this.buildMessages(options),
        stream: true,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
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

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              yield parsed.delta.text;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  async listModels(): Promise<string[]> {
    // Anthropic doesn't have a models endpoint, return known models
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
  }

  async validateConfig(): Promise<boolean> {
    try {
      // Test with a minimal request
      await this.complete({
        prompt: 'Hi',
        maxTokens: 10,
      });
      return true;
    } catch {
      return false;
    }
  }

  getCapabilities(): ProviderCapabilities {
    return PROVIDER_CAPABILITIES.anthropic;
  }

  private buildSystemPrompt(options: ProviderCompletionOptions): string {
    let systemPrompt = options.systemPrompt || '';

    // Add context if provided
    if (options.context) {
      if (options.context.files && options.context.files.length > 0) {
        systemPrompt += '\n\n## Relevant Files:\n';
        for (const file of options.context.files) {
          systemPrompt += `\n### ${file.path}\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n`;
        }
      }

      if (options.context.gitDiff) {
        systemPrompt += '\n\n## Git Changes:\n```diff\n' + options.context.gitDiff + '\n```\n';
      }
    }

    return systemPrompt;
  }

  private buildMessages(options: ProviderCompletionOptions): any[] {
    return [{ role: 'user', content: options.prompt }];
  }
}
