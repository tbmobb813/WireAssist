/**
 * Streaming Service Tests
 * Verifies real-time streaming session management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StreamingService } from '../lib/services/streamingService';

describe('Streaming Service', () => {
  let service: StreamingService;

  beforeEach(() => {
    service = new StreamingService();
  });

  afterEach(() => {
    service.clearAll();
  });

  describe('Session Management', () => {
    it('should create a new streaming session', () => {
      const sessionId = service.createSession('conv-123');

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toMatch(/^stream-/);
    });

    it('should track active sessions', () => {
      const sessionId1 = service.createSession('conv-1');
      const sessionId2 = service.createSession('conv-2');

      const activeSessions = service.getActiveSessions();
      expect(activeSessions.length).toBe(2);
      expect(activeSessions.some((s) => s.sessionId === sessionId1)).toBe(true);
      expect(activeSessions.some((s) => s.sessionId === sessionId2)).toBe(true);
    });

    it('should retrieve session by ID', () => {
      const sessionId = service.createSession('conv-123');
      const session = service.getSession(sessionId);

      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(sessionId);
      expect(session?.conversationId).toBe('conv-123');
    });

    it('should return null for non-existent session', () => {
      const session = service.getSession('non-existent');
      expect(session).toBeNull();
    });

    it('should check if session is active', () => {
      const sessionId = service.createSession('conv-123');

      expect(service.isSessionActive(sessionId)).toBe(true);
      expect(service.isSessionActive('non-existent')).toBe(false);
    });

    it('should end a session', () => {
      const sessionId = service.createSession('conv-123');

      expect(service.isSessionActive(sessionId)).toBe(true);

      const endedSession = service.endSession(sessionId);
      expect(endedSession?.sessionId).toBe(sessionId);
      expect(service.isSessionActive(sessionId)).toBe(false);
    });

    it('should return null when ending non-existent session', () => {
      const result = service.endSession('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('Chunk Recording', () => {
    it('should record chunks in a session', () => {
      const sessionId = service.createSession('conv-123');

      service.recordChunk(sessionId, 'Hello ');
      service.recordChunk(sessionId, 'World');

      const session = service.getSession(sessionId);
      expect(session?.totalChunks).toBe(2);
      expect(session?.totalBytes).toBe(11); // "Hello " (6) + "World" (5)
    });

    it('should track total bytes in session', () => {
      const sessionId = service.createSession('conv-123');

      service.recordChunk(sessionId, 'A'.repeat(100));
      service.recordChunk(sessionId, 'B'.repeat(200));

      const session = service.getSession(sessionId);
      expect(session?.totalBytes).toBe(300);
    });

    it('should return null when recording chunk in non-existent session', () => {
      const result = service.recordChunk('non-existent', 'chunk');
      expect(result).toBeNull();
    });

    it('should handle empty chunks', () => {
      const sessionId = service.createSession('conv-123');

      service.recordChunk(sessionId, '');
      service.recordChunk(sessionId, 'content');

      const session = service.getSession(sessionId);
      expect(session?.totalChunks).toBe(2);
      expect(session?.totalBytes).toBe(7); // only "content"
    });
  });

  describe('Session Timestamps', () => {
    it('should record session start time', () => {
      const beforeCreate = Date.now();
      const sessionId = service.createSession('conv-123');
      const afterCreate = Date.now();

      const session = service.getSession(sessionId);
      expect(session?.startedAt).toBeGreaterThanOrEqual(beforeCreate);
      expect(session?.startedAt).toBeLessThanOrEqual(afterCreate);
    });

    it('should calculate session duration on end', async () => {
      const sessionId = service.createSession('conv-123');

      // Wait 100ms
      await new Promise((r) => setTimeout(r, 100));

      const endedSession = service.endSession(sessionId);
      const duration = Date.now() - (endedSession?.startedAt || 0);

      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Chunk Processor', () => {
    it('should create a chunk processor', () => {
      const sessionId = service.createSession('conv-123');
      const processor = service.createChunkProcessor(() => {}, sessionId);

      expect(processor).toBeDefined();
      expect(typeof processor.process).toBe('function');
      expect(typeof processor.flush).toBe('function');
    });

    it('should process chunks through processor', async () => {
      const sessionId = service.createSession('conv-123');
      const chunks: string[] = [];

      const processor = service.createChunkProcessor((chunk) => {
        chunks.push(chunk);
      }, sessionId);

      processor.process('Hello ');
      processor.process('World');

      // Wait for debounce (default 50ms)
      await new Promise((r) => setTimeout(r, 100));

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should flush buffered chunks', async () => {
      const sessionId = service.createSession('conv-123');
      const chunks: string[] = [];

      const processor = service.createChunkProcessor((chunk) => {
        chunks.push(chunk);
      }, sessionId);

      processor.process('Hello ');
      processor.process('World');

      // Flush immediately without waiting for debounce
      processor.flush();

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should debounce chunk processing', async () => {
      const sessionId = service.createSession('conv-123');
      const callCount = { count: 0 };

      const processor = service.createChunkProcessor(() => {
        callCount.count++;
      }, sessionId);

      // Send multiple chunks rapidly
      for (let i = 0; i < 10; i++) {
        processor.process(`chunk-${i}`);
      }

      // Should not have called callback yet (debouncing)
      expect(callCount.count).toBe(0);

      // Wait for debounce
      await new Promise((r) => setTimeout(r, 100));

      // Should have called callback once after debounce
      expect(callCount.count).toBeGreaterThan(0);
    });

    it('should handle processor with multiple chunks', async () => {
      const sessionId = service.createSession('conv-123');
      const collected: string[] = [];

      const processor = service.createChunkProcessor((chunk) => {
        collected.push(chunk);
      }, sessionId);

      processor.process('This ');
      processor.process('is ');
      processor.process('a ');
      processor.process('test');

      processor.flush();

      const fullText = collected.join('');
      expect(fullText).toContain('This');
      expect(fullText).toContain('is');
      expect(fullText).toContain('a');
      expect(fullText).toContain('test');
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const defaultService = new StreamingService();
      const sessionId = defaultService.createSession('conv-123');

      expect(service.isSessionActive(sessionId)).toBe(false);
    });

    it('should accept custom configuration', async () => {
      const customService = new StreamingService({
        debounceMs: 10,
        maxBufferSize: 512,
        chunkTimeoutMs: 5000,
      });

      const sessionId = customService.createSession('conv-123');
      const chunks: string[] = [];

      const processor = customService.createChunkProcessor((chunk) => {
        chunks.push(chunk);
      }, sessionId);

      processor.process('Test');

      // Wait for custom debounce (10ms)
      await new Promise((r) => setTimeout(r, 50));

      expect(chunks.length).toBeGreaterThan(0);

      customService.endSession(sessionId);
    });
  });

  describe('Session Cleanup', () => {
    it('should clear all sessions', () => {
      service.createSession('conv-1');
      service.createSession('conv-2');
      service.createSession('conv-3');

      expect(service.getActiveSessions().length).toBe(3);

      service.clearAll();

      expect(service.getActiveSessions().length).toBe(0);
    });

    it('should auto-cleanup expired sessions', async () => {
      const shortTimeoutService = new StreamingService({ chunkTimeoutMs: 50 });
      const sessionId = shortTimeoutService.createSession('conv-123');

      expect(shortTimeoutService.isSessionActive(sessionId)).toBe(true);

      // Wait for auto-cleanup timeout
      await new Promise((r) => setTimeout(r, 100));

      expect(shortTimeoutService.isSessionActive(sessionId)).toBe(false);
    });
  });

  describe('Session Metadata', () => {
    it('should track conversation ID', () => {
      const sessionId = service.createSession('conv-abc-123');
      const session = service.getSession(sessionId);

      expect(session?.conversationId).toBe('conv-abc-123');
    });

    it('should initialize chunk count to zero', () => {
      const sessionId = service.createSession('conv-123');
      const session = service.getSession(sessionId);

      expect(session?.totalChunks).toBe(0);
      expect(session?.totalBytes).toBe(0);
    });

    it('should accumulate metrics across multiple records', () => {
      const sessionId = service.createSession('conv-123');

      for (let i = 0; i < 5; i++) {
        service.recordChunk(sessionId, `chunk-${i}`);
      }

      const session = service.getSession(sessionId);
      expect(session?.totalChunks).toBe(5);
      expect(session?.totalBytes).toBeGreaterThan(0);
    });
  });

  describe('Multiple Concurrent Sessions', () => {
    it('should handle multiple concurrent sessions', () => {
      const sessionIds: string[] = [];

      for (let i = 0; i < 5; i++) {
        sessionIds.push(service.createSession(`conv-${i}`));
      }

      const activeSessions = service.getActiveSessions();
      expect(activeSessions.length).toBe(5);

      sessionIds.forEach((id) => {
        expect(service.isSessionActive(id)).toBe(true);
      });
    });

    it('should track metrics independently for each session', () => {
      const sessionId1 = service.createSession('conv-1');
      const sessionId2 = service.createSession('conv-2');

      service.recordChunk(sessionId1, 'A'.repeat(100));
      service.recordChunk(sessionId2, 'B'.repeat(200));

      const session1 = service.getSession(sessionId1);
      const session2 = service.getSession(sessionId2);

      expect(session1?.totalBytes).toBe(100);
      expect(session2?.totalBytes).toBe(200);
    });

    it('should end sessions independently', () => {
      const sessionId1 = service.createSession('conv-1');
      const sessionId2 = service.createSession('conv-2');

      service.endSession(sessionId1);

      expect(service.isSessionActive(sessionId1)).toBe(false);
      expect(service.isSessionActive(sessionId2)).toBe(true);

      const remaining = service.getActiveSessions();
      expect(remaining.length).toBe(1);
      expect(remaining[0].sessionId).toBe(sessionId2);
    });
  });
});
