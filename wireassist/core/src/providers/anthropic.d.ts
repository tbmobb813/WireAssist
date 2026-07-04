import { Provider, ProviderCompletionOptions, ProviderResponse, ProviderType } from './base';
import type { ProviderConfig } from '../types';
export declare class AnthropicProvider implements Provider {
  type: ProviderType;
  currentModel: string;
  private apiKey;
  private baseUrl;
  private timeout;
  constructor(config: ProviderConfig);
  complete(options: ProviderCompletionOptions): Promise<ProviderResponse>;
  stream(options: ProviderCompletionOptions): Promise<AsyncGenerator<string>>;
  private streamGenerator;
  listModels(): Promise<string[]>;
  validateConfig(): Promise<boolean>;
  private buildSystemPrompt;
  private buildMessages;
}
//# sourceMappingURL=anthropic.d.ts.map
