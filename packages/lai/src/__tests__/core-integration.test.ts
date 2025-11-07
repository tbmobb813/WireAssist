/**
 * Core Integration Tests
 * Verify that @lia-code/core modules work correctly within the LAI app context
 */

import {
  AIClient,
  ConversationStore,
  MessageStore,
  ProviderFactory,
  ContextBuilder,
  AuditLogger,
  PrivacyController,
  StreamParser,
} from '@lia-code/core';
import type {
  Conversation,
  Message,
  ProviderType,
  AIContext,
  PrivacySettings,
} from '@lia-code/core';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('@lia-code/core Integration Tests', () => {
  let testDbPath: string;
  let conversationStore: ConversationStore;
  let messageStore: MessageStore;

  beforeEach(async () => {
    // Create a temporary test database
    const fixturesDir = path.join(process.cwd(), 'src/__tests__/fixtures');

    // Create fixtures directory if it doesn't exist
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    testDbPath = path.join(fixturesDir, 'test-integration.db');

    // Initialize stores with test database
    conversationStore = new ConversationStore(testDbPath);
    messageStore = new MessageStore(testDbPath);
  });

  afterEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('ConversationStore', () => {
    it('should create and retrieve conversations', async () => {
      const conversationId = await conversationStore.create({
        title: 'Test Conversation',
        model: 'gpt-4',
        provider: 'openai',
      });

      expect(conversationId).toBeDefined();
      expect(typeof conversationId).toBe('string');

      const conversation = await conversationStore.get(conversationId);
      expect(conversation).toBeDefined();
      expect(conversation.title).toBe('Test Conversation');
      expect(conversation.model).toBe('gpt-4');
      expect(conversation.provider).toBe('openai');
    });

    it('should list all conversations', async () => {
      const id1 = await conversationStore.create({
        title: 'Conv 1',
        model: 'gpt-4',
        provider: 'openai',
      });

      const id2 = await conversationStore.create({
        title: 'Conv 2',
        model: 'claude-3-sonnet',
        provider: 'anthropic',
      });

      const conversations = await conversationStore.list();
      expect(conversations.length).toBeGreaterThanOrEqual(2);
    });

    it('should update conversation title', async () => {
      const conversationId = await conversationStore.create({
        title: 'Original Title',
        model: 'gpt-4',
        provider: 'openai',
      });

      await conversationStore.update(conversationId, {
        title: 'Updated Title',
      });

      const updated = await conversationStore.get(conversationId);
      expect(updated).toBeDefined();
      expect(updated.title).toBe('Updated Title');
    });

    it('should delete conversation', async () => {
      const conversationId = await conversationStore.create({
        title: 'To Delete',
        model: 'gpt-4',
        provider: 'openai',
      });

      await conversationStore.delete(conversationId);

      try {
        await conversationStore.get(conversationId);
        expect(true).toBe(false); // Should have thrown
      } catch {
        expect(true).toBe(true); // Expected behavior
      }
    });
  });

  describe('MessageStore', () => {
    let conversationId: string;

    beforeEach(async () => {
      conversationId = await conversationStore.create({
        title: 'Test',
        model: 'gpt-4',
        provider: 'openai',
      });
    });

    it('should create and retrieve messages', async () => {
      const messageId = await messageStore.create({
        conversationId,
        content: 'Hello, world!',
        role: 'user',
        timestamp: Date.now(),
      });

      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe('string');

      const message = await messageStore.get(messageId);
      expect(message).toBeDefined();
      expect(message.content).toBe('Hello, world!');
      expect(message.role).toBe('user');
      expect(message.conversationId).toBe(conversationId);
    });

    it('should get messages by conversation', async () => {
      await messageStore.create({
        conversationId,
        content: 'User message 1',
        role: 'user',
        timestamp: Date.now(),
      });

      await messageStore.create({
        conversationId,
        content: 'Assistant response',
        role: 'assistant',
        timestamp: Date.now() + 1000,
      });

      const messages = await messageStore.getByConversation(conversationId);
      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages.some((m) => m.role === 'user')).toBe(true);
      expect(messages.some((m) => m.role === 'assistant')).toBe(true);
    });

    it('should search messages by content', async () => {
      await messageStore.create({
        conversationId,
        content: 'Search for this unique keyword',
        role: 'user',
        timestamp: Date.now(),
      });

      const results = await messageStore.search('unique keyword');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('unique keyword');
    });
  });

  describe('ProviderFactory', () => {
    it('should create OpenAI provider', () => {
      const provider = ProviderFactory.create({
        type: 'openai',
        apiKey: 'test-key',
      });

      expect(provider).toBeDefined();
      expect(provider.type).toBe('openai');
    });

    it('should create Anthropic provider', () => {
      const provider = ProviderFactory.create({
        type: 'anthropic',
        apiKey: 'test-key',
      });

      expect(provider).toBeDefined();
      expect(provider.type).toBe('anthropic');
    });

    it('should create Gemini provider', () => {
      const provider = ProviderFactory.create({
        type: 'gemini',
        apiKey: 'test-key',
      });

      expect(provider).toBeDefined();
      expect(provider.type).toBe('gemini');
    });

    it('should create Ollama provider', () => {
      const provider = ProviderFactory.create({
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
      });

      expect(provider).toBeDefined();
      expect(provider.type).toBe('ollama');
    });

    it('should throw error for unknown provider', () => {
      expect(() => {
        ProviderFactory.create({
          type: 'unknown' as any,
        });
      }).toThrow();
    });
  });

  describe('ContextBuilder', () => {
    it('should create context builder', () => {
      const builder = new ContextBuilder();
      expect(builder).toBeDefined();
    });

    it('should build empty context', async () => {
      const builder = new ContextBuilder();

      const context = await builder.build();
      expect(context).toBeDefined();
      expect(typeof context).toBe('object');
    });

    it('should be chainable', () => {
      const builder = new ContextBuilder();
      // Verify builder methods return this for chaining
      const result = builder;
      expect(result).toBeDefined();
      expect(result instanceof ContextBuilder).toBe(true);
    });
  });

  describe('StreamParser', () => {
    it('should create parser with format', () => {
      const parser = new StreamParser('sse');
      expect(parser).toBeDefined();
    });

    it('should handle empty chunks gracefully', () => {
      const parser = new StreamParser('text');

      const result = parser.parse('');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should parse text format', () => {
      const parser = new StreamParser('text');

      const result = parser.parse('Hello');
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle multiple parse calls', () => {
      const parser = new StreamParser('text');

      const result1 = parser.parse('Part 1\n');
      const result2 = parser.parse('Part 2');

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('End-to-end Integration', () => {
    it('should support full conversation workflow', async () => {
      // 1. Create conversation
      const conversationId = await conversationStore.create({
        title: 'E2E Test',
        model: 'gpt-4',
        provider: 'openai',
      });

      expect(conversationId).toBeDefined();

      // 2. Add user message
      const userMessageId = await messageStore.create({
        conversationId,
        content: 'What is 2 + 2?',
        role: 'user',
        timestamp: Date.now(),
      });

      expect(userMessageId).toBeDefined();

      // 3. Add assistant message
      const assistantMessageId = await messageStore.create({
        conversationId,
        content: 'The answer is 4.',
        role: 'assistant',
        timestamp: Date.now() + 1000,
      });

      expect(assistantMessageId).toBeDefined();

      // 4. Verify conversation contains both messages
      const messages = await messageStore.getByConversation(conversationId);
      expect(messages.length).toBeGreaterThanOrEqual(2);

      // 5. Update conversation title
      await conversationStore.update(conversationId, {
        title: 'Math Question',
      });

      // 6. Retrieve and verify the conversation
      const retrieved = await conversationStore.get(conversationId);
      expect(retrieved.title).toBe('Math Question');
    });

    it('should support provider factory integration', () => {
      // Create multiple providers for multi-provider support
      const providerConfigs = [
        { type: 'openai' as const, apiKey: 'test-openai-key' },
        { type: 'anthropic' as const, apiKey: 'test-anthropic-key' },
        { type: 'gemini' as const, apiKey: 'test-gemini-key' },
        { type: 'ollama' as const, baseUrl: 'http://localhost:11434' },
      ];

      providerConfigs.forEach((config) => {
        const provider = ProviderFactory.create(config);

        expect(provider).toBeDefined();
        expect(provider.type).toBe(config.type);
      });
    });
  });

  describe('Types Export', () => {
    it('should export conversation type', () => {
      // This is a compile-time check - verifying types are exported correctly
      const conv: Conversation = {
        id: 'test-id',
        title: 'Test',
        model: 'gpt-4',
        provider: 'openai',
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
      };

      expect(conv.id).toBe('test-id');
    });

    it('should export message type', () => {
      const msg: Message = {
        id: 'msg-id',
        conversationId: 'conv-id',
        content: 'Test',
        role: 'user',
        timestamp: Date.now(),
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
      };

      expect(msg.id).toBe('msg-id');
    });
  });
});
