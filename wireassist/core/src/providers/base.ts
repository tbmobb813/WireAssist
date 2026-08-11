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

export interface ProviderCompletionOptions {
  prompt: string;
  context?: AIContext;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ProviderResponse {
  content: string;
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
