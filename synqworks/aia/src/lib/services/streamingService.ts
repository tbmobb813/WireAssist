/**
 * Streaming Service
 * Manages real-time streaming of AI responses
 * Handles chunk processing, buffering, and UI updates
 */

export interface StreamingConfig {
  maxBufferSize?: number;
  chunkTimeoutMs?: number;
  debounceMs?: number;
}

export interface StreamingSession {
  sessionId: string;
  startedAt: number;
  conversationId: string;
  totalChunks: number;
  totalBytes: number;
}

export class StreamingService {
  private activeSessions: Map<string, StreamingSession> = new Map();
  private config: Required<StreamingConfig>;

  constructor(config: StreamingConfig = {}) {
    this.config = {
      maxBufferSize: config.maxBufferSize ?? 1024 * 1024, // 1MB
      chunkTimeoutMs: config.chunkTimeoutMs ?? 30000, // 30s
      debounceMs: config.debounceMs ?? 50, // 50ms
    };
  }

  /**
   * Create a new streaming session
   */
  createSession(conversationId: string): string {
    const sessionId = this.generateSessionId();
    const session: StreamingSession = {
      sessionId,
      startedAt: Date.now(),
      conversationId,
      totalChunks: 0,
      totalBytes: 0,
    };

    this.activeSessions.set(sessionId, session);

    // Auto-cleanup session after timeout
    setTimeout(() => {
      this.endSession(sessionId);
    }, this.config.chunkTimeoutMs);

    return sessionId;
  }

  /**
   * Record a chunk in an active session
   */
  recordChunk(sessionId: string, chunk: string): StreamingSession | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    session.totalChunks++;
    session.totalBytes += chunk.length;

    // Validate buffer size
    if (session.totalBytes > this.config.maxBufferSize) {
      console.warn(
        `[StreamingService] Session ${sessionId} exceeded max buffer size`,
      );
    }

    return session;
  }

  /**
   * End a streaming session and cleanup
   */
  endSession(sessionId: string): StreamingSession | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    const duration = Date.now() - session.startedAt;
    console.log(
      `[StreamingService] Session ${sessionId} completed: ${session.totalChunks} chunks, ${session.totalBytes} bytes in ${duration}ms`,
    );

    this.activeSessions.delete(sessionId);
    return session;
  }

  /**
   * Get active session info
   */
  getSession(sessionId: string): StreamingSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): StreamingSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Check if session is active
   */
  isSessionActive(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  /**
   * Process chunks with debouncing for UI updates
   * Returns a debounced function that processes chunks
   */
  createChunkProcessor(onChunk: (chunk: string) => void, sessionId: string) {
    let timeout: NodeJS.Timeout | null = null;
    let buffer = '';

    return {
      process: (chunk: string) => {
        const session = this.recordChunk(sessionId, chunk);
        if (!session) return;

        buffer += chunk;

        // Clear existing timeout
        if (timeout) clearTimeout(timeout);

        // Set new debounced update
        timeout = setTimeout(() => {
          if (buffer) {
            onChunk(buffer);
            buffer = '';
          }
          timeout = null;
        }, this.config.debounceMs);
      },

      flush: () => {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        if (buffer) {
          onChunk(buffer);
          buffer = '';
        }
      },
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all sessions
   */
  clearAll(): void {
    this.activeSessions.clear();
  }
}

// Export singleton instance
export const streamingService = new StreamingService();
