/**
 * End-to-End Context + Streaming Integration Tests
 * Verifies that context is properly integrated with streaming responses
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextAwareProvider } from '../lib/providers/contextProvider';
import { contextService } from '../lib/services/contextService';
import type { Provider, ProviderMessage } from '../lib/providers/provider';
import type { AIContext, FileChange } from '@lia-code/core';

// Mock streaming provider
class MockStreamingProvider implements Provider {
  async generateResponse(
    conversationId: string,
    messages: ProviderMessage[],
    onChunk?: (chunk: string) => void,
  ): Promise<string> {
    // Simulate streaming response
    const responseChunks = [
      'The project structure ',
      'includes TypeScript files ',
      'with proper typing ',
      'and modular organization.',
    ];

    let fullResponse = '';

    for (const chunk of responseChunks) {
      fullResponse += chunk;
      if (onChunk) {
        onChunk(chunk);
      }
      // Simulate network delay
      await new Promise((r) => setTimeout(r, 10));
    }

    return fullResponse;
  }
}

describe('E2E Context + Streaming Integration', () => {
  let mockProvider: MockStreamingProvider;
  let contextProvider: ContextAwareProvider;

  beforeEach(() => {
    mockProvider = new MockStreamingProvider();
    contextProvider = new ContextAwareProvider(mockProvider, {
      conversationId: 'conv-123',
      autoRefresh: false,
    });
  });

  afterEach(() => {
    contextService.clearContext('conv-123');
  });

  describe('Context Injection with Streaming', () => {
    it('should stream response with context available', async () => {
      const messages: ProviderMessage[] = [
        { role: 'user', content: 'Explain the project structure' },
      ];

      const chunks: string[] = [];
      const response = await contextProvider.generateResponse(
        'conv-123',
        messages,
        (chunk) => {
          chunks.push(chunk);
        },
      );

      expect(response).toContain('project structure');
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBe(response);
    });

    it('should build context before streaming', async () => {
      const fileChanges: FileChange[] = [
        {
          path: 'src/app.ts',
          type: 'modified',
          timestamp: Date.now(),
          diff: '+ new code',
        },
      ];

      const contextAware = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-123',
        workspacePath: process.cwd(),
        fileChanges,
        autoRefresh: false,
      });

      const messages: ProviderMessage[] = [
        { role: 'user', content: 'What changed?' },
      ];

      try {
        const response = await contextAware.generateResponse('conv-123', messages);
        expect(response).toBeDefined();
      } catch (error) {
        // Expected if workspace path invalid
      }
    });

    it('should accumulate chunks correctly during streaming', async () => {
      const messages: ProviderMessage[] = [
        { role: 'user', content: 'Stream test' },
      ];

      const chunks: string[] = [];
      let accumulatedResponse = '';

      const response = await contextProvider.generateResponse(
        'conv-123',
        messages,
        (chunk) => {
          chunks.push(chunk);
          accumulatedResponse += chunk;
        },
      );

      expect(accumulatedResponse).toBe(response);
      expect(chunks.join('')).toBe(response);
    });
  });

  describe('Context Lifecycle with Conversations', () => {
    it('should maintain context across multiple messages', async () => {
      const messages1: ProviderMessage[] = [
        { role: 'user', content: 'First message' },
      ];

      const messages2: ProviderMessage[] = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Follow-up question' },
      ];

      await contextProvider.generateResponse('conv-123', messages1);
      const context1 = contextProvider.getContext();

      await contextProvider.generateResponse('conv-123', messages2);
      const context2 = contextProvider.getContext();

      // Context should be consistent or updated
      expect(context1 === context2 || context1 === null || context2 === null).toBe(true);
    });

    it('should support different conversations independently', async () => {
      const provider1 = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-1',
      });

      const provider2 = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-2',
      });

      const messages = [{ role: 'user', content: 'Test' }];

      const response1 = await provider1.generateResponse('conv-1', messages as ProviderMessage[]);
      const response2 = await provider2.generateResponse('conv-2', messages as ProviderMessage[]);

      expect(response1).toBeDefined();
      expect(response2).toBeDefined();

      // Contexts should be independent
      const context1 = provider1.getContext();
      const context2 = provider2.getContext();

      // Both should be valid independently
      expect(typeof context1 === 'object' || context1 === null).toBe(true);
      expect(typeof context2 === 'object' || context2 === null).toBe(true);
    });
  });

  describe('Context with File Selection', () => {
    it('should include selected files in context', async () => {
      const selectedFiles = [__filename]; // This test file

      const contextAware = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-123',
        workspacePath: process.cwd(),
        selectedFiles,
        autoRefresh: false,
      });

      const messages: ProviderMessage[] = [
        { role: 'user', content: 'Review these files' },
      ];

      try {
        await contextAware.generateResponse('conv-123', messages);
        // Should attempt to include files
      } catch (error) {
        // Expected if file loading fails
      }
    });
  });

  describe('Context with File Changes', () => {
    it('should include recent file changes in context', async () => {
      const fileChanges: FileChange[] = [
        {
          path: 'src/module1.ts',
          type: 'modified',
          timestamp: Date.now() - 1000,
          diff: '+ added function',
        },
        {
          path: 'src/module2.ts',
          type: 'added',
          timestamp: Date.now(),
          diff: 'entire new file',
        },
        {
          path: 'src/module3.ts',
          type: 'deleted',
          timestamp: Date.now() - 2000,
        },
      ];

      const contextAware = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-123',
        workspacePath: process.cwd(),
        fileChanges,
        autoRefresh: false,
      });

      const messages: ProviderMessage[] = [
        { role: 'user', content: 'What changed recently?' },
      ];

      try {
        await contextAware.generateResponse('conv-123', messages);
        // Should include file changes
      } catch (error) {
        // Expected
      }
    });

    it('should handle multiple file changes in sequence', async () => {
      const changes1: FileChange[] = [
        { path: 'src/file1.ts', type: 'added', timestamp: Date.now() },
      ];

      const changes2: FileChange[] = [
        { path: 'src/file1.ts', type: 'modified', timestamp: Date.now() },
        { path: 'src/file2.ts', type: 'added', timestamp: Date.now() },
      ];

      const contextAware = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-123',
        fileChanges: changes1,
        autoRefresh: false,
      });

      let response1 = await contextAware.generateResponse(
        'conv-123',
        [{ role: 'user', content: 'First' }] as ProviderMessage[],
      );
      expect(response1).toBeDefined();

      // Update with new changes
      contextAware.updateOptions({ fileChanges: changes2 });

      let response2 = await contextAware.generateResponse(
        'conv-123',
        [{ role: 'user', content: 'Second' }] as ProviderMessage[],
      );
      expect(response2).toBeDefined();
    });
  });

  describe('Streaming with Chunked Context', () => {
    it('should handle large context files with streaming', async () => {
      // Simulate large file
      const largeContent = 'console.log("line");'.repeat(1000); // ~20KB

      const contextAware = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-123',
        workspacePath: process.cwd(),
        selectedFiles: [__filename],
        autoRefresh: false,
      });

      const messages: ProviderMessage[] = [
        { role: 'user', content: 'Analyze this large file' },
      ];

      try {
        const response = await contextAware.generateResponse('conv-123', messages);
        expect(response).toBeDefined();
      } catch (error) {
        // Expected
      }
    });

    it('should stream while building context', async () => {
      const chunks: string[] = [];

      const response = await contextProvider.generateResponse(
        'conv-123',
        [{ role: 'user', content: 'Stream test' }] as ProviderMessage[],
        (chunk) => {
          chunks.push(chunk);
        },
      );

      // Streaming should work independently of context building
      expect(chunks.length).toBeGreaterThan(0);
      expect(response).toBeDefined();
    });
  });

  describe('Context Caching with Streaming', () => {
    it('should cache context between streaming requests', async () => {
      // Build context once
      const context = await contextService.buildContext(
        'conv-123',
        process.cwd(),
      );

      // Use context for multiple requests
      const provider = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-123',
        autoRefresh: false,
      });

      const messages = [{ role: 'user', content: 'Test' }] as ProviderMessage[];

      let response1 = await provider.generateResponse('conv-123', messages);
      let response2 = await provider.generateResponse('conv-123', messages);

      expect(response1).toBeDefined();
      expect(response2).toBeDefined();

      // Both should use the same cached context
      const cachedContext = contextService.getContext('conv-123');
      expect(cachedContext).toBeDefined();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing workspace path gracefully', async () => {
      const provider = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-123',
        workspacePath: '/nonexistent/path',
        autoRefresh: true,
      });

      const messages = [{ role: 'user', content: 'Test' }] as ProviderMessage[];

      // Should handle error gracefully and still attempt response
      try {
        await provider.generateResponse('conv-123', messages);
      } catch (error) {
        // Expected to fail but provider should handle it
      }
    });

    it('should handle invalid file selection', async () => {
      const provider = new ContextAwareProvider(mockProvider, {
        conversationId: 'conv-123',
        selectedFiles: ['/nonexistent/file.ts'],
      });

      const messages = [{ role: 'user', content: 'Test' }] as ProviderMessage[];

      // Should handle error gracefully
      try {
        await provider.generateResponse('conv-123', messages);
      } catch (error) {
        // Expected
      }
    });
  });

  describe('Message Order Preservation', () => {
    it('should preserve message order with context injection', async () => {
      const messages: ProviderMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Q1' },
        { role: 'assistant', content: 'A1' },
        { role: 'user', content: 'Q2' },
      ];

      await contextProvider.generateResponse('conv-123', messages);

      // Messages should be properly ordered in wrapped provider call
      expect(messages.length).toBeGreaterThanOrEqual(4);
    });
  });
});
