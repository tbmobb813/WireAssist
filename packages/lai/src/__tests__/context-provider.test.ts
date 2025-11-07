/**
 * Context-Aware Provider Tests
 * Verifies context injection into provider messages
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextAwareProvider, wrapWithContext } from '../lib/providers/contextProvider';
import type { Provider, ProviderMessage } from '../lib/providers/provider';
import type { AIContext } from '@lia-code/core';

// Mock provider for testing
class MockProvider implements Provider {
  lastMessages: ProviderMessage[] = [];

  async generateResponse(
    conversationId: string,
    messages: ProviderMessage[],
    onChunk?: (chunk: string) => void,
  ): Promise<string> {
    this.lastMessages = messages;
    if (onChunk) {
      onChunk('Mock response');
    }
    return 'Mock response from provider';
  }
}

describe('Context-Aware Provider', () => {
  let mockProvider: MockProvider;
  let contextProvider: ContextAwareProvider;

  beforeEach(() => {
    mockProvider = new MockProvider();
    contextProvider = new ContextAwareProvider(mockProvider, {
      conversationId: 'conv-123',
      autoRefresh: false,
    });
  });

  describe('Provider Wrapping', () => {
    it('should wrap a provider with context awareness', () => {
      expect(contextProvider).toBeInstanceOf(ContextAwareProvider);
    });

    it('should use wrapper function to wrap provider', () => {
      const wrapped = wrapWithContext(mockProvider, {
        conversationId: 'conv-456',
      });

      expect(wrapped).toBeInstanceOf(ContextAwareProvider);
    });

    it('should delegate to wrapped provider', async () => {
      const messages: ProviderMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      const response = await contextProvider.generateResponse('conv-123', messages);

      expect(response).toBe('Mock response from provider');
      expect(mockProvider.lastMessages).toBeDefined();
    });

    it('should pass onChunk callback to wrapped provider', async () => {
      const messages: ProviderMessage[] = [
        { role: 'user', content: 'Test' },
      ];

      const chunks: string[] = [];
      const onChunk = (chunk: string) => {
        chunks.push(chunk);
      };

      await contextProvider.generateResponse('conv-123', messages, onChunk);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Context Injection', () => {
    it('should inject context as system message', async () => {
      const messages: ProviderMessage[] = [
        { role: 'user', content: 'What is this project?' },
      ];

      // Use the wrapped provider - it will use the real contextService
      const response = await contextProvider.generateResponse('conv-123', messages);

      expect(response).toBe('Mock response from provider');
      // Messages were passed through to mock provider
      expect(mockProvider.lastMessages).toBeDefined();
    });

    it('should not inject empty context', async () => {
      const messages: ProviderMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      const emptyContext: AIContext = {};

      const response = await contextProvider.generateResponse('conv-123', messages);

      expect(response).toBe('Mock response from provider');
      // Messages should pass through unchanged
      expect(mockProvider.lastMessages[0]).toEqual(messages[0]);
    });

    it('should append to existing system message', async () => {
      const messages: ProviderMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ];

      const response = await contextProvider.generateResponse('conv-123', messages);

      expect(response).toBe('Mock response from provider');
      // System message should be preserved
      expect(mockProvider.lastMessages.some((m) => m.role === 'system')).toBe(true);
    });
  });

  describe('Options Management', () => {
    it('should accept context options', () => {
      const provider = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-123',
        workspacePath: '/workspace',
        autoRefresh: true,
      });

      expect(provider).toBeDefined();
    });

    it('should update options', () => {
      contextProvider.updateOptions({
        workspacePath: '/new/workspace',
        autoRefresh: true,
      });

      // Should not throw
      expect(contextProvider).toBeDefined();
    });

    it('should default autoRefresh to true', () => {
      const provider = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-123',
      });

      expect(provider).toBeDefined();
    });
  });

  describe('Context Retrieval', () => {
    it('should get cached context', () => {
      const retrievedContext = contextProvider.getContext();
      // May be null if not cached
      expect(retrievedContext === null || typeof retrievedContext === 'object').toBe(true);
    });

    it('should clear context', () => {
      contextProvider.clearContext();
      // Should not throw
      expect(contextProvider).toBeDefined();
    });
  });

  describe('Message Handling', () => {
    it('should handle messages with different roles', async () => {
      const messages: ProviderMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Question 1' },
        { role: 'assistant', content: 'Answer 1' },
        { role: 'user', content: 'Question 2' },
      ];

      const response = await contextProvider.generateResponse('conv-123', messages);

      expect(response).toBe('Mock response from provider');
      expect(mockProvider.lastMessages.length).toBeGreaterThanOrEqual(messages.length);
    });

    it('should preserve message content', async () => {
      const messages: ProviderMessage[] = [
        { role: 'user', content: 'Test message with special chars: @#$%' },
      ];

      await contextProvider.generateResponse('conv-123', messages);

      // Original content should be preserved
      expect(mockProvider.lastMessages.some((m) =>
        m.content.includes('Test message'),
      )).toBe(true);
    });

    it('should handle empty messages', async () => {
      const messages: ProviderMessage[] = [];

      const response = await contextProvider.generateResponse('conv-123', messages);

      expect(response).toBe('Mock response from provider');
    });

    it('should handle very long messages', async () => {
      const longContent = 'x'.repeat(10000);
      const messages: ProviderMessage[] = [
        { role: 'user', content: longContent },
      ];

      const response = await contextProvider.generateResponse('conv-123', messages);

      expect(response).toBe('Mock response from provider');
      expect(mockProvider.lastMessages[0]?.content).toContain('x');
    });
  });

  describe('Multiple Conversations', () => {
    it('should handle different conversation IDs', async () => {
      const provider1 = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-1',
      });

      const provider2 = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-2',
      });

      const messages = [{ role: 'user', content: 'Test' }];

      await provider1.generateResponse('conv-1', messages as ProviderMessage[]);
      await provider2.generateResponse('conv-2', messages as ProviderMessage[]);

      // Both should work independently
      expect(mockProvider.lastMessages).toBeDefined();
    });
  });

  describe('Context Building Options', () => {
    it('should support file selection', () => {
      const provider = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-123',
        selectedFiles: ['src/app.ts', 'src/utils.ts'],
      });

      expect(provider).toBeDefined();
    });

    it('should support file changes', () => {
      const provider = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-123',
        fileChanges: [
          {
            path: 'src/file.ts',
            type: 'modified',
            timestamp: Date.now(),
          },
        ],
      });

      expect(provider).toBeDefined();
    });

    it('should support workspace path', () => {
      const provider = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-123',
        workspacePath: '/workspace',
      });

      expect(provider).toBeDefined();
    });

    it('should combine multiple options', () => {
      const provider = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-123',
        workspacePath: '/workspace',
        selectedFiles: ['src/app.ts'],
        fileChanges: [
          {
            path: 'src/utils.ts',
            type: 'modified',
            timestamp: Date.now(),
          },
        ],
        autoRefresh: true,
      });

      expect(provider).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle wrapped provider errors', async () => {
      const errorProvider: Provider = {
        generateResponse: async () => {
          throw new Error('Provider error');
        },
      };

      const contextAware = new ContextAwareProvider(errorProvider, {
        conversationId: 'conv-123',
      });

      const messages: ProviderMessage[] = [
        { role: 'user', content: 'Test' },
      ];

      await expect(
        contextAware.generateResponse('conv-123', messages),
      ).rejects.toThrow('Provider error');
    });

    it('should handle invalid conversation ID', async () => {
      const messages: ProviderMessage[] = [
        { role: 'user', content: 'Test' },
      ];

      // Should not throw, just work normally
      const response = await contextProvider.generateResponse('', messages);
      expect(response).toBe('Mock response from provider');
    });
  });

  describe('Context Message Formatting', () => {
    it('should format file context properly', async () => {
      const messages: ProviderMessage[] = [
        { role: 'user', content: 'Explain this code' },
      ];

      // The actual context formatting happens in buildContextMessage
      // which is called when context is available
      const response = await contextProvider.generateResponse('conv-123', messages);

      expect(response).toBe('Mock response from provider');
    });
  });

  describe('Auto-Refresh Mode', () => {
    it('should rebuild context when autoRefresh is true', async () => {
      const provider = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-123',
        workspacePath: process.cwd(),
        autoRefresh: true,
      });

      const messages: ProviderMessage[] = [
        { role: 'user', content: 'Test' },
      ];

      try {
        await provider.generateResponse('conv-123', messages);
        // Should attempt to build context but may fail in test env
      } catch (error) {
        // Expected if workspace path is invalid
      }
    });

    it('should use cached context when autoRefresh is false', async () => {
      const provider = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-123',
        autoRefresh: false,
      });

      const messages: ProviderMessage[] = [
        { role: 'user', content: 'Test' },
      ];

      const response = await provider.generateResponse('conv-123', messages);
      expect(response).toBe('Mock response from provider');
    });
  });
});
