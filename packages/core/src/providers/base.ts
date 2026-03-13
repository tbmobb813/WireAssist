// @lai/core/src/providers/base.ts

import type { ProviderType, AIContext } from '../types';
import type { ProviderCapabilities } from './capabilities';

export interface ModelInfo {
  id: string;
  name: string;
  contextLength?: number;
  description?: string;
  deprecated?: boolean;
}

export interface Provider {
  type: ProviderType;
  currentModel: string;

  complete(options: ProviderCompletionOptions): Promise<ProviderResponse>;
  stream(options: ProviderCompletionOptions): Promise<AsyncGenerator<string>>;
  listModels(): Promise<string[]>;
  validateConfig(): Promise<boolean>;
  
  // NEW: Capability discovery
  getCapabilities(): ProviderCapabilities;
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
  model: string;
  finishReason?: string;
}

export { ProviderType } from '../types';
