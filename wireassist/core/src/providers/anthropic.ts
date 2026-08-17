// Anthropic/Claude implementation
import {
  Provider,
  ProviderCompletionOptions,
  ProviderResponse,
  ProviderType,
  ProviderToolCall,
} from './base';
import type { ProviderConfig } from '../types';

// Anthropic's content-block shapes, just the parts this provider reads/writes.
interface AnthropicTextBlock {
  type: 'text';
  text: string;
}
interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}
interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}
type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock;
type AnthropicMessage =
  | { role: 'user'; content: string | AnthropicToolResultBlock[] }
  | { role: 'assistant'; content: AnthropicContentBlock[] };

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
    // 30s was too short for large completions (e.g. NixOps's DATA-loop
    // stages with maxTokens up to 8192, writing a full article in one
    // call) — non-streaming responses of that size routinely take over a
    // minute.
    this.timeout = config.timeout || 180000;

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
        // Only send temperature when a caller actually asked for one — some
        // models reject it outright ("temperature is deprecated for this
        // model"), and nothing in this codebase currently passes one.
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        system: this.buildSystemPrompt(options),
        messages: this.buildMessages(options),
        // No tool_choice: leave it at Anthropic's default ("auto") so the
        // model can end the loop with a plain-text answer instead of being
        // forced to call a tool every turn.
        ...(options.tools?.length
          ? {
              tools: options.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.inputSchema,
              })),
            }
          : {}),
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      content: Array<AnthropicContentBlock>;
      usage?: { input_tokens: number; output_tokens: number };
      model: string;
      stop_reason: string;
    };

    const toolCalls: ProviderToolCall[] = data.content
      .filter((block): block is AnthropicToolUseBlock => block.type === 'tool_use')
      .map((block) => ({ id: block.id, name: block.name, input: block.input }));

    return {
      content: data.content
        .filter((block): block is AnthropicTextBlock => block.type === 'text' && !!block.text)
        .map((block) => block.text)
        .join(''),
      ...(toolCalls.length ? { toolCalls } : {}),
      tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      promptTokens: data.usage?.input_tokens,
      completionTokens: data.usage?.output_tokens,
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
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
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

  private buildMessages(options: ProviderCompletionOptions): AnthropicMessage[] {
    if (!options.messages?.length) {
      return [{ role: 'user', content: options.prompt }];
    }

    // Translate the provider-agnostic turn history into Anthropic's wire
    // format: Anthropic has no native "tool" role — tool results are
    // content blocks inside a user-turn message, keyed by tool_use_id. The
    // API also requires strictly alternating user/assistant turns, so
    // consecutive tool_result entries (multiple tool calls from the same
    // assistant turn) must be coalesced into one user message, not emitted
    // as back-to-back user turns.
    const result: AnthropicMessage[] = [];
    for (const message of options.messages) {
      if (message.role === 'user') {
        result.push({ role: 'user', content: message.content });
        continue;
      }
      if (message.role === 'assistant') {
        const blocks: AnthropicContentBlock[] = [];
        if (message.content) blocks.push({ type: 'text', text: message.content });
        for (const call of message.toolCalls ?? []) {
          blocks.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
        }
        result.push({ role: 'assistant', content: blocks });
        continue;
      }

      // role === 'tool_result' — append to the trailing user message if it's
      // already a coalesced tool_result batch, otherwise start a new one.
      const resultBlock: AnthropicToolResultBlock = {
        type: 'tool_result',
        tool_use_id: message.toolCallId,
        content: message.content,
        is_error: message.isError,
      };
      const last = result[result.length - 1];
      if (last?.role === 'user' && Array.isArray(last.content)) {
        last.content.push(resultBlock);
      } else {
        result.push({ role: 'user', content: [resultBlock] });
      }
    }
    return result;
  }
}
