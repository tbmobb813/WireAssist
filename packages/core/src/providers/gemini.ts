// Google Gemini implementation
import { Provider, ProviderCompletionOptions, ProviderResponse, ProviderType } from './base';
import type { ProviderConfig } from '../types';
import { PROVIDER_CAPABILITIES, type ProviderCapabilities } from './capabilities';

export class GeminiProvider implements Provider {
  type: ProviderType = 'gemini';
  currentModel: string;
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1';
    this.currentModel = config.model || 'gemini-pro';
    this.timeout = config.timeout || 30000;

    if (!this.apiKey) {
      throw new Error('Gemini API key is required');
    }
  }

  async complete(options: ProviderCompletionOptions): Promise<ProviderResponse> {
    const model = options.model || this.currentModel;
    const response = await fetch(
      `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: this.buildContents(options),
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens,
          },
        }),
        signal: AbortSignal.timeout(this.timeout),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      candidates: Array<{
        content: { parts: Array<{ text: string }> };
        finishReason: string;
      }>;
      usageMetadata?: { totalTokenCount: number };
    };
    const candidate = data.candidates[0];

    return {
      content: candidate.content.parts[0].text,
      tokensUsed: data.usageMetadata?.totalTokenCount,
      model,
      finishReason: candidate.finishReason,
    };
  }

  async stream(options: ProviderCompletionOptions): Promise<AsyncGenerator<string>> {
    return this.streamGenerator(options);
  }

  private async *streamGenerator(options: ProviderCompletionOptions): AsyncGenerator<string> {
    const model = options.model || this.currentModel;
    const response = await fetch(
      `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: this.buildContents(options),
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens,
          },
        }),
        signal: AbortSignal.timeout(this.timeout),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
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
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield text;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`);

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status}`);
    }

    const data = (await response.json()) as { models: Array<{ name: string }> };
    return data.models
      .filter((model: any) => model.name.includes('gemini'))
      .map((model: any) => model.name.split('/').pop())
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
    return PROVIDER_CAPABILITIES.gemini;
  }

  private buildContents(options: ProviderCompletionOptions): any[] {
    let prompt = options.prompt;

    // Add context if provided
    if (options.context) {
      if (options.context.files && options.context.files.length > 0) {
        prompt = '## Relevant Files:\n';
        for (const file of options.context.files) {
          prompt += `\n### ${file.path}\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n`;
        }
        prompt += '\n\n' + options.prompt;
      }

      if (options.context.gitDiff) {
        prompt = '## Git Changes:\n```diff\n' + options.context.gitDiff + '\n```\n\n' + prompt;
      }
    }

    return [
      {
        parts: [{ text: prompt }],
      },
    ];
  }
}
