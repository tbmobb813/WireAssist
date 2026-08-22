import type {
  CompletionOptions,
  StreamOptions,
  ProviderConfig,
  PrivacySettings,
  Conversation,
  ContextOptions,
  ProviderType,
} from './types';
export declare class AIClient {
  private provider;
  private conversations;
  private messages;
  private privacy;
  private contextBuilder;
  constructor(config: {
    provider: ProviderConfig;
    storagePath?: string;
    privacy?: PrivacySettings;
  });
  complete(options: CompletionOptions): Promise<string>;
  stream(options: StreamOptions): AsyncGenerator<string>;
  ask(prompt: string, conversationId?: string): Promise<string>;
  withContext(prompt: string, contextOptions: ContextOptions): Promise<string>;
  switchProvider(config: ProviderConfig): Promise<void>;
  getCurrentProvider(): ProviderType;
  createConversation(title: string): Promise<string>;
  getConversation(id: string): Promise<Conversation>;
  searchConversations(query: string): Promise<Conversation[]>;
}
//# sourceMappingURL=client.d.ts.map
