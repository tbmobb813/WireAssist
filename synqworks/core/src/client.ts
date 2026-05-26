// @lai/core/src/client.ts

import { ProviderFactory } from './providers';
import type { Provider } from './providers/base';
import { ConversationStore, MessageStore } from './storage';
import { ContextBuilder } from './context';
import { PrivacyController } from './privacy';
import type {
  CompletionOptions,
  StreamOptions,
  ProviderConfig,
  PrivacySettings,
  Conversation,
  ContextOptions,
  ProviderType,
} from './types';

export class AIClient {
  private provider: Provider;
  private conversations: ConversationStore;
  private messages: MessageStore;
  private privacy: PrivacyController;
  private contextBuilder: ContextBuilder;

  constructor(config: {
    provider: ProviderConfig;
    storagePath?: string;
    privacy?: PrivacySettings;
  }) {
    this.provider = ProviderFactory.create(config.provider);
    this.conversations = new ConversationStore(config.storagePath);
    this.messages = new MessageStore(config.storagePath);
    this.privacy = new PrivacyController(config.privacy);
    this.contextBuilder = new ContextBuilder();
  }

  async complete(options: CompletionOptions): Promise<string> {
    // Check privacy settings
    const shouldUseLocal = await this.privacy.shouldUseLocal(options.prompt);
    if (shouldUseLocal && this.provider.type !== 'ollama') {
      throw new Error('Privacy settings require local processing');
    }

    // Log request for audit
    if (this.privacy.auditEnabled) {
      await this.privacy.logRequest({
        prompt: options.prompt,
        provider: this.provider.type,
        model: options.model,
        timestamp: Date.now(),
      });
    }

    // Make API call
    const response = await this.provider.complete({
      prompt: options.prompt,
      context: options.context,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });

    // Store message if conversation tracking enabled
    if (options.conversationId) {
      await this.messages.create({
        conversationId: options.conversationId,
        role: 'user',
        content: options.prompt,
        timestamp: Date.now(),
      });

      await this.messages.create({
        conversationId: options.conversationId,
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        tokensUsed: response.tokensUsed,
      });
    }

    return response.content;
  }

  async *stream(options: StreamOptions): AsyncGenerator<string> {
    // Similar to complete but yields chunks
    const stream = await this.provider.stream(options);

    let fullResponse = '';
    for await (const chunk of stream) {
      fullResponse += chunk;
      yield chunk;
    }

    // Store after streaming completes
    if (options.conversationId) {
      await this.messages.create({
        conversationId: options.conversationId,
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      });
    }
  }

  // Convenience methods
  async ask(prompt: string, conversationId?: string): Promise<string> {
    return this.complete({ prompt, conversationId });
  }

  async withContext(prompt: string, contextOptions: ContextOptions): Promise<string> {
    let builder = this.contextBuilder;

    if (contextOptions.files) {
      builder = builder.addFiles(contextOptions.files);
    }

    if (contextOptions.gitRepo) {
      builder = builder.addGitContext(contextOptions.gitRepo);
    }

    if (contextOptions.workspace) {
      builder = builder.addWorkspace(contextOptions.workspace);
    }

    const context = await builder.build();

    return this.complete({ prompt, context });
  }

  // Provider management
  async switchProvider(config: ProviderConfig): Promise<void> {
    this.provider = ProviderFactory.create(config);
  }

  getCurrentProvider(): ProviderType {
    return this.provider.type;
  }

  // Conversation management
  async createConversation(title: string): Promise<string> {
    return this.conversations.create({
      title,
      provider: this.provider.type,
      model: this.provider.currentModel,
    });
  }

  async getConversation(id: string): Promise<Conversation> {
    const conversation = await this.conversations.get(id);
    const messages = await this.messages.getByConversation(id);
    return { ...conversation, messages };
  }

  async searchConversations(query: string): Promise<Conversation[]> {
    return this.conversations.search(query);
  }
}
