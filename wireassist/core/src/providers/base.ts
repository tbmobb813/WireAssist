// @aia/core/src/providers/base.ts

import type { ProviderType, AIContext } from '../types';

export interface Provider {
  type: ProviderType;
  currentModel: string;

  complete(options: ProviderCompletionOptions): Promise<ProviderResponse>;
  stream(options: ProviderCompletionOptions): Promise<AsyncGenerator<string>>;
  listModels(): Promise<string[]>;
  validateConfig(): Promise<boolean>;
}

// JSON-Schema tool definition handed to the model, and the structured call
// it hands back — shape mirrors Anthropic's tool_use, since that's the only
// provider that implements tool-calling today (see anthropic.ts).
export interface ProviderToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ProviderToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// Turn history for a multi-turn tool-calling loop. Providers without tool
// support can ignore `messages`/`tools` entirely and fall back to `prompt`.
export type ProviderMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ProviderToolCall[] }
  | { role: 'tool_result'; toolCallId: string; content: string; isError?: boolean };

export interface ProviderCompletionOptions {
  prompt: string;
  // Full turn history for a tool-calling loop. When set, takes precedence
  // over `prompt` for providers that support it (`prompt` stays required so
  // non-tool-calling providers and callers have a single-shot fallback).
  messages?: ProviderMessage[];
  tools?: ProviderToolDefinition[];
  context?: AIContext;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ProviderResponse {
  content: string;
  // Present when the model chose to call one or more tools instead of (or
  // alongside) returning a final answer. Only populated by providers that
  // implement tool-calling.
  toolCalls?: ProviderToolCall[];
  tokensUsed?: number;
  // Split input/output counts, when the provider's API exposes them —
  // needed for accurate per-token cost accounting (output tokens are
  // priced differently than input tokens).
  promptTokens?: number;
  completionTokens?: number;
  model: string;
  finishReason?: string;
}

export { ProviderType } from '../types';
