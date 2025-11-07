/**
 * Context-Aware Provider
 * Wraps streaming providers to automatically include AI context in requests
 */

import { contextService } from '../services/contextService';
import type { ProviderMessage, Provider } from './provider';
import type { AIContext, FileChange } from '@lia-code/core';

export interface ContextAwareOptions {
  conversationId: string;
  workspacePath?: string;
  fileChanges?: FileChange[];
  selectedFiles?: string[];
  autoRefresh?: boolean;
}

export class ContextAwareProvider implements Provider {
  private wrappedProvider: Provider;
  private options: ContextAwareOptions;

  constructor(wrappedProvider: Provider, options: ContextAwareOptions) {
    this.wrappedProvider = wrappedProvider;
    this.options = {
      autoRefresh: true,
      ...options,
    };
  }

  async generateResponse(
    conversationId: string,
    messages: ProviderMessage[],
    onChunk?: (chunk: string) => void,
  ): Promise<string> {
    // Build or fetch context
    let context: AIContext | null = null;

    if (this.options.workspacePath) {
      if (this.options.autoRefresh) {
        // Always rebuild for fresh context
        context = await contextService.buildContext(
          conversationId,
          this.options.workspacePath,
          this.options.fileChanges,
          this.options.selectedFiles,
        );
      } else {
        // Try to use cached context
        context = contextService.getContext(conversationId);
        if (!context) {
          context = await contextService.buildContext(
            conversationId,
            this.options.workspacePath,
            this.options.fileChanges,
            this.options.selectedFiles,
          );
        }
      }
    }

    // Inject context into messages
    const messagesWithContext = this.injectContext(messages, context);

    // Call wrapped provider
    return this.wrappedProvider.generateResponse(
      conversationId,
      messagesWithContext,
      onChunk,
    );
  }

  /**
   * Inject context into messages as a system message
   */
  private injectContext(
    messages: ProviderMessage[],
    context: AIContext | null,
  ): ProviderMessage[] {
    if (!context || this.isEmptyContext(context)) {
      return messages;
    }

    const contextMessage = this.buildContextMessage(context);

    // Insert context message as first message or after existing system message
    const result = [...messages];
    const systemMessageIndex = result.findIndex((m) => m.role === 'system');

    if (systemMessageIndex >= 0) {
      // Append context to existing system message
      result[systemMessageIndex] = {
        ...result[systemMessageIndex],
        content: `${result[systemMessageIndex].content}\n\n${contextMessage}`,
      };
    } else {
      // Insert new system message at the beginning
      result.unshift({
        role: 'system',
        content: contextMessage,
      });
    }

    return result;
  }

  /**
   * Build context message for provider
   */
  private buildContextMessage(context: AIContext): string {
    const parts: string[] = ['# AI Context'];

    if (context.files?.length) {
      parts.push('\n## Project Files');
      context.files.forEach((file) => {
        parts.push(`\n### ${file.path} (${file.language})`);
        // Include file content with proper formatting
        if (file.content.length > 5000) {
          // Truncate very large files
          parts.push(
            `\`\`\`${file.language}\n${file.content.substring(0, 5000)}...\n\`\`\``,
          );
        } else {
          parts.push(`\`\`\`${file.language}\n${file.content}\n\`\`\``);
        }
      });
    }

    if (context.gitBranch) {
      parts.push(`\n## Git Information`);
      parts.push(`- Current Branch: ${context.gitBranch}`);

      if (context.gitLog) {
        parts.push(`\n### Recent Commits`);
        parts.push(`\`\`\`\n${context.gitLog}\n\`\`\``);
      }

      if (context.gitDiff) {
        parts.push(`\n### Recent Changes`);
        const diffPreview = context.gitDiff.substring(0, 2000);
        parts.push(
          `\`\`\`diff\n${diffPreview}${context.gitDiff.length > 2000 ? '...' : ''}\n\`\`\``,
        );
      }
    }

    if (context.recentChanges?.length) {
      parts.push(`\n## File Changes`);
      context.recentChanges.forEach((change) => {
        parts.push(
          `- **${change.type}**: ${change.path} (${new Date(change.timestamp).toLocaleString()})`,
        );
      });
    }

    if (context.workspace?.structure) {
      parts.push(`\n## Project Structure`);
      parts.push(`- Type: ${context.workspace.structure.type}`);
      parts.push(`- Path: ${context.workspace.structure.rootPath}`);
    }

    return parts.join('\n');
  }

  /**
   * Check if context is empty
   */
  private isEmptyContext(context: AIContext): boolean {
    return (
      !context.files?.length &&
      !context.gitBranch &&
      !context.recentChanges?.length &&
      !context.workspace
    );
  }

  /**
   * Update context options
   */
  updateOptions(options: Partial<ContextAwareOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Clear cached context
   */
  clearContext(): void {
    contextService.clearContext(this.options.conversationId);
  }

  /**
   * Get current context
   */
  getContext(): AIContext | null {
    return contextService.getContext(this.options.conversationId);
  }
}

/**
 * Wrap a provider with context awareness
 */
export function wrapWithContext(
  provider: Provider,
  options: ContextAwareOptions,
): ContextAwareProvider {
  return new ContextAwareProvider(provider, options);
}
