/**
 * End-to-End Message Flow Test
 * Tests the complete workflow:
 * 1. Create conversation with @lia-code/core
 * 2. Send user message and store in @lia-code/core
 * 3. Get provider response (mocked)
 * 4. Store assistant response in @lia-code/core
 * 5. Retrieve full conversation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationAdapter, MessageAdapter } from '../lib/api/core-adapter';
import { ProviderFactory } from '@lia-code/core';
import * as fs from 'fs';
import * as path from 'path';

describe.sequential('E2E Message Flow', () => {
  let testDbPath: string;
  let conversationAdapter: ConversationAdapter;
  let messageAdapter: MessageAdapter;

  beforeEach(() => {
    // Create test database
    const fixturesDir = path.join(process.cwd(), 'src/__tests__/fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    const timestamp = Date.now();
    testDbPath = path.join(fixturesDir, `e2e-flow-${timestamp}.db`);

    conversationAdapter = new ConversationAdapter(testDbPath);
    messageAdapter = new MessageAdapter(testDbPath);
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Complete Message Flow', () => {
    it('should complete full conversation workflow: create → send message → get response → store', async () => {
      // Step 1: Create conversation
      const conversation = await conversationAdapter.create({
        title: 'E2E Test Conversation',
        model: 'gpt-4',
        provider: 'openai',
      });

      expect(conversation).toBeDefined();
      expect(conversation.id).toBeDefined();
      expect(conversation.title).toBe('E2E Test Conversation');

      // Step 2: Store user message
      const userMessage = await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'user',
        content: 'What is TypeScript?',
      });

      expect(userMessage).toBeDefined();
      expect(userMessage.role).toBe('user');
      expect(userMessage.content).toBe('What is TypeScript?');
      expect(userMessage.conversation_id).toBe(conversation.id);

      // Step 3: Simulate provider response (mocked)
      // In real app, this would call the actual provider
      const mockProviderResponse = `TypeScript is a programming language built on top of JavaScript that adds static type checking. It allows you to catch errors at compile time rather than runtime, making code more robust and maintainable.`;

      // Step 4: Store assistant response
      const assistantMessage = await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'assistant',
        content: mockProviderResponse,
      });

      expect(assistantMessage).toBeDefined();
      expect(assistantMessage.role).toBe('assistant');
      expect(assistantMessage.content).toContain('TypeScript');
      expect(assistantMessage.conversation_id).toBe(conversation.id);

      // Step 5: Retrieve full conversation
      const messages = await messageAdapter.getByConversation(conversation.id);

      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('What is TypeScript?');
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].content).toContain('TypeScript');

      // Step 6: Verify conversation metadata
      const retrievedConversation = await conversationAdapter.get(conversation.id);
      expect(retrievedConversation).toBeDefined();
      expect(retrievedConversation?.title).toBe('E2E Test Conversation');
      expect(retrievedConversation?.provider).toBe('openai');
      expect(retrievedConversation?.model).toBe('gpt-4');
    });

    it('should handle multiple exchanges in single conversation', async () => {
      // Create conversation
      const conversation = await conversationAdapter.create({
        title: 'Multi-Turn Conversation',
        model: 'claude-3-sonnet-20240229',
        provider: 'anthropic',
      });

      // Exchange 1
      await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'user',
        content: 'Explain React',
      });

      await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'assistant',
        content: 'React is a JavaScript library for building UIs...',
      });

      // Exchange 2
      await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'user',
        content: 'What about Vue?',
      });

      await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'assistant',
        content: 'Vue is another popular JavaScript framework...',
      });

      // Exchange 3
      await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'user',
        content: 'Which one should I learn?',
      });

      await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'assistant',
        content: 'It depends on your project needs and preferences...',
      });

      // Verify all messages are stored
      const messages = await messageAdapter.getByConversation(conversation.id);
      expect(messages.length).toBe(6); // 3 exchanges = 6 messages

      // Verify message order
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('user');
      expect(messages[3].role).toBe('assistant');
      expect(messages[4].role).toBe('user');
      expect(messages[5].role).toBe('assistant');
    });

    it('should support different providers in different conversations', async () => {
      // Conversation 1: OpenAI
      const openaiConv = await conversationAdapter.create({
        title: 'OpenAI Test',
        model: 'gpt-4',
        provider: 'openai',
      });

      await messageAdapter.create({
        conversation_id: openaiConv.id,
        role: 'user',
        content: 'Test with OpenAI',
      });

      // Conversation 2: Anthropic
      const anthropicConv = await conversationAdapter.create({
        title: 'Anthropic Test',
        model: 'claude-3-sonnet-20240229',
        provider: 'anthropic',
      });

      await messageAdapter.create({
        conversation_id: anthropicConv.id,
        role: 'user',
        content: 'Test with Anthropic',
      });

      // Conversation 3: Gemini
      const geminiConv = await conversationAdapter.create({
        title: 'Gemini Test',
        model: 'gemini-1.5-pro',
        provider: 'gemini',
      });

      await messageAdapter.create({
        conversation_id: geminiConv.id,
        role: 'user',
        content: 'Test with Gemini',
      });

      // Verify each conversation is isolated
      const openaiMessages = await messageAdapter.getByConversation(openaiConv.id);
      const anthropicMessages = await messageAdapter.getByConversation(anthropicConv.id);
      const geminiMessages = await messageAdapter.getByConversation(geminiConv.id);

      expect(openaiMessages).toHaveLength(1);
      expect(openaiMessages[0].content).toBe('Test with OpenAI');

      expect(anthropicMessages).toHaveLength(1);
      expect(anthropicMessages[0].content).toBe('Test with Anthropic');

      expect(geminiMessages).toHaveLength(1);
      expect(geminiMessages[0].content).toBe('Test with Gemini');

      // Verify conversation metadata
      expect(openaiConv.provider).toBe('openai');
      expect(anthropicConv.provider).toBe('anthropic');
      expect(geminiConv.provider).toBe('gemini');
    });

    it('should integrate with ProviderFactory for multi-provider support', async () => {
      // Create conversation
      const conversation = await conversationAdapter.create({
        title: 'Provider Integration Test',
        model: 'gpt-4',
        provider: 'openai',
      });

      // Create provider for this conversation
      const provider = ProviderFactory.create({
        type: conversation.provider as any,
        apiKey: 'test-key',
        model: conversation.model,
      });

      expect(provider).toBeDefined();
      expect(provider.type).toBe('openai');
      expect(provider.currentModel).toBe('gpt-4');

      // Store user message
      const userMsg = await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'user',
        content: 'Test message',
      });

      expect(userMsg).toBeDefined();

      // In real app, would call provider.complete() here
      // For now, just verify the setup works
      expect(provider.type).toBe(conversation.provider);
    });

    it('should support message search after storing multiple exchanges', async () => {
      const conversation = await conversationAdapter.create({
        title: 'Search Test Conversation',
        model: 'gpt-4',
        provider: 'openai',
      });

      // Store multiple messages with searchable content
      await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'user',
        content: 'Tell me about machine learning algorithms',
      });

      await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'assistant',
        content: 'Machine learning algorithms include supervised and unsupervised learning...',
      });

      await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'user',
        content: 'What are neural networks?',
      });

      await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'assistant',
        content: 'Neural networks are inspired by biological neural networks...',
      });

      // Search for messages
      const searchResults = await messageAdapter.search('neural networks');
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].content).toContain('neural networks');

      // Search for another term
      const mlResults = await messageAdapter.search('machine learning');
      expect(mlResults.length).toBeGreaterThan(0);
    });

    it('should maintain conversation history integrity across updates', async () => {
      // Create conversation
      const conversation = await conversationAdapter.create({
        title: 'Original Title',
        model: 'gpt-4',
        provider: 'openai',
      });

      // Add messages
      const msg1 = await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'user',
        content: 'First message',
      });

      const msg2 = await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'assistant',
        content: 'First response',
      });

      // Update conversation title
      await conversationAdapter.updateTitle(conversation.id, 'Updated Title');

      // Add more messages
      const msg3 = await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'user',
        content: 'Second message',
      });

      const msg4 = await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'assistant',
        content: 'Second response',
      });

      // Verify all messages are still there
      const messages = await messageAdapter.getByConversation(conversation.id);
      expect(messages).toHaveLength(4);

      // Verify conversation updated
      const updated = await conversationAdapter.get(conversation.id);
      expect(updated?.title).toBe('Updated Title');

      // Verify message IDs
      expect(messages[0].id).toBe(msg1.id);
      expect(messages[1].id).toBe(msg2.id);
      expect(messages[2].id).toBe(msg3.id);
      expect(messages[3].id).toBe(msg4.id);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing conversation gracefully', async () => {
      const result = await conversationAdapter.get('non-existent-id');
      expect(result).toBeNull();
    });

    it('should handle empty conversation history', async () => {
      const conversation = await conversationAdapter.create({
        title: 'Empty Conversation',
        model: 'gpt-4',
        provider: 'openai',
      });

      const messages = await messageAdapter.getByConversation(conversation.id);
      expect(messages).toHaveLength(0);
    });

    it('should handle message deletion', async () => {
      const conversation = await conversationAdapter.create({
        title: 'Delete Test',
        model: 'gpt-4',
        provider: 'openai',
      });

      const msg1 = await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'user',
        content: 'Message 1',
      });

      const msg2 = await messageAdapter.create({
        conversation_id: conversation.id,
        role: 'user',
        content: 'Message 2',
      });

      // Delete first message
      await messageAdapter.delete(msg1.id);

      // Verify deletion
      const messages = await messageAdapter.getByConversation(conversation.id);
      expect(messages.length).toBe(1);
      expect(messages[0].id).toBe(msg2.id);
    });
  });
});
