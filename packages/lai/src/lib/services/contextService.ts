/**
 * Context Service
 * Manages building and caching AI context from workspace and file changes
 * Integrates with @lia-code/core's ContextBuilder
 */

import { ContextBuilder } from '@lia-code/core';
import type { AIContext, FileChange, FileContext } from '@lia-code/core';

export interface ContextOptions {
  includeFiles?: boolean;
  includeGitContext?: boolean;
  includeRecentChanges?: boolean;
  includeWorkspace?: boolean;
  maxFileSize?: number;
  maxFiles?: number;
  maxChanges?: number;
}

export interface ContextSession {
  conversationId: string;
  context: AIContext;
  createdAt: number;
  filesCached: number;
  contextSize: number;
}

export class ContextService {
  private activeSessions: Map<string, ContextSession> = new Map();
  private fileCache: Map<string, FileContext> = new Map();
  private defaultOptions: Required<ContextOptions>;

  constructor(options: ContextOptions = {}) {
    this.defaultOptions = {
      includeFiles: options.includeFiles ?? true,
      includeGitContext: options.includeGitContext ?? true,
      includeRecentChanges: options.includeRecentChanges ?? true,
      includeWorkspace: options.includeWorkspace ?? true,
      maxFileSize: options.maxFileSize ?? 100 * 1024, // 100KB per file
      maxFiles: options.maxFiles ?? 10,
      maxChanges: options.maxChanges ?? 50,
    };
  }

  /**
   * Build context for a conversation
   */
  async buildContext(
    conversationId: string,
    workspacePath: string,
    fileChanges?: FileChange[],
    selectedFiles?: string[],
  ): Promise<AIContext> {
    const builder = new ContextBuilder();

    // Add selected files or recent changes
    if (this.defaultOptions.includeFiles && selectedFiles?.length) {
      builder.addFiles(selectedFiles.slice(0, this.defaultOptions.maxFiles));
    }

    // Add Git context
    if (this.defaultOptions.includeGitContext) {
      builder.addGitContext(workspacePath);
    }

    // Add recent file changes
    if (this.defaultOptions.includeRecentChanges && fileChanges?.length) {
      builder.addRecentChanges(fileChanges.slice(0, this.defaultOptions.maxChanges));
    }

    // Add workspace structure
    if (this.defaultOptions.includeWorkspace) {
      builder.addWorkspace(workspacePath);
    }

    const context = await builder.build();
    const contextSize = this.estimateContextSize(context);

    // Cache the context
    const session: ContextSession = {
      conversationId,
      context,
      createdAt: Date.now(),
      filesCached: selectedFiles?.length ?? 0,
      contextSize,
    };

    this.activeSessions.set(conversationId, session);

    return context;
  }

  /**
   * Get cached context for conversation
   */
  getContext(conversationId: string): AIContext | null {
    const session = this.activeSessions.get(conversationId);
    return session?.context ?? null;
  }

  /**
   * Update context for existing conversation
   */
  async updateContext(
    conversationId: string,
    workspacePath: string,
    fileChanges?: FileChange[],
    selectedFiles?: string[],
  ): Promise<AIContext> {
    const context = await this.buildContext(
      conversationId,
      workspacePath,
      fileChanges,
      selectedFiles,
    );
    return context;
  }

  /**
   * Cache a file for reuse across conversations
   */
  cacheFile(filePath: string, content: string, language: string): void {
    const fileContext: FileContext = { path: filePath, content, language };
    this.fileCache.set(filePath, fileContext);

    // Limit cache size to 50 files
    if (this.fileCache.size > 50) {
      const firstKey = this.fileCache.keys().next().value;
      if (firstKey) {
        this.fileCache.delete(firstKey);
      }
    }
  }

  /**
   * Get cached file
   */
  getCachedFile(filePath: string): FileContext | null {
    return this.fileCache.get(filePath) ?? null;
  }

  /**
   * Clear cache for a conversation
   */
  clearContext(conversationId: string): void {
    this.activeSessions.delete(conversationId);
  }

  /**
   * Clear all cached context
   */
  clearAllContext(): void {
    this.activeSessions.clear();
  }

  /**
   * Get context session info
   */
  getSession(conversationId: string): ContextSession | null {
    return this.activeSessions.get(conversationId) ?? null;
  }

  /**
   * Get all active context sessions
   */
  getActiveSessions(): ContextSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get context statistics
   */
  getStats(): {
    activeSessions: number;
    cachedFiles: number;
    totalContextSize: number;
  } {
    let totalContextSize = 0;
    this.activeSessions.forEach((session) => {
      totalContextSize += session.contextSize;
    });

    return {
      activeSessions: this.activeSessions.size,
      cachedFiles: this.fileCache.size,
      totalContextSize,
    };
  }

  /**
   * Estimate context size in bytes
   */
  private estimateContextSize(context: AIContext): number {
    let size = 0;

    if (context.files) {
      size += context.files.reduce((sum, f) => sum + f.content.length, 0);
    }

    if (context.gitDiff) {
      size += context.gitDiff.length;
    }

    if (context.gitLog) {
      size += context.gitLog.length;
    }

    if (context.recentChanges) {
      size += context.recentChanges.reduce((sum, c) => sum + (c.diff?.length ?? 0), 0);
    }

    return size;
  }

  /**
   * Format context as string for debugging
   */
  formatContext(context: AIContext): string {
    const parts: string[] = [];

    if (context.files?.length) {
      parts.push(`Files: ${context.files.length}`);
      context.files.forEach((f) => {
        parts.push(`  - ${f.path} (${f.language})`);
      });
    }

    if (context.gitBranch) {
      parts.push(`Git Branch: ${context.gitBranch}`);
    }

    if (context.recentChanges?.length) {
      parts.push(`Recent Changes: ${context.recentChanges.length}`);
      context.recentChanges.slice(0, 5).forEach((c) => {
        parts.push(`  - ${c.path} (${c.type})`);
      });
      if (context.recentChanges.length > 5) {
        parts.push(`  ... and ${context.recentChanges.length - 5} more`);
      }
    }

    return parts.join('\n');
  }
}

// Export singleton instance
export const contextService = new ContextService();
