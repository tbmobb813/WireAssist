"use strict";
// @lai/core/src/client.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIClient = void 0;
const providers_1 = require("./providers");
const storage_1 = require("./storage");
const context_1 = require("./context");
const privacy_1 = require("./privacy");
class AIClient {
    constructor(config) {
        Object.defineProperty(this, "provider", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "conversations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "messages", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "privacy", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "contextBuilder", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.provider = providers_1.ProviderFactory.create(config.provider);
        this.conversations = new storage_1.ConversationStore(config.storagePath);
        this.messages = new storage_1.MessageStore(config.storagePath);
        this.privacy = new privacy_1.PrivacyController(config.privacy);
        this.contextBuilder = new context_1.ContextBuilder();
    }
    async complete(options) {
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
    async *stream(options) {
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
    async ask(prompt, conversationId) {
        return this.complete({ prompt, conversationId });
    }
    async withContext(prompt, contextOptions) {
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
    async switchProvider(config) {
        this.provider = providers_1.ProviderFactory.create(config);
    }
    getCurrentProvider() {
        return this.provider.type;
    }
    // Conversation management
    async createConversation(title) {
        return this.conversations.create({
            title,
            provider: this.provider.type,
            model: this.provider.currentModel,
        });
    }
    async getConversation(id) {
        const conversation = await this.conversations.get(id);
        const messages = await this.messages.getByConversation(id);
        return { ...conversation, messages };
    }
    async searchConversations(query) {
        return this.conversations.search(query);
    }
}
exports.AIClient = AIClient;
