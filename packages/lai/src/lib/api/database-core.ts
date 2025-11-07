/**
 * Core-backed Database Module
 * Uses @lia-code/core's ConversationStore and MessageStore instead of Tauri IPC
 * This provides local-first storage with full integration to @lia-code/core
 */

import { initializeCoreAdapters, type ConversationAdapter, type MessageAdapter } from './core-adapter';
import type {
  NewConversation,
  NewMessage,
  ApiConversation,
  ApiMessage,
  ApiTag,
  NewTag,
} from './types';

// Get the database path - use a default or from environment
const getDbPath = (): string => {
  // In the future, this could be configurable
  // For now, use a default path in the user's config directory
  const dbPath = process.env.LAI_DB_PATH ||
    `${process.env.HOME || process.env.USERPROFILE || '/tmp'}/.lai/conversations.db`;
  return dbPath;
};

let adapters: { conversations: ConversationAdapter; messages: MessageAdapter } | null = null;

/**
 * Initialize the core database adapters
 */
export function initializeCoreDatabaseAdapters() {
  if (!adapters) {
    const dbPath = getDbPath();
    adapters = initializeCoreAdapters(dbPath);
  }
  return adapters;
}

/**
 * Get or initialize the adapters
 */
function getAdapters() {
  if (!adapters) {
    initializeCoreDatabaseAdapters();
  }
  if (!adapters) {
    throw new Error('Core database adapters not initialized');
  }
  return adapters;
}

/**
 * Core-backed database interface
 * Matches the same API as the original database module but uses @lia-code/core for storage
 */
export const coreDatabaseApi = {
  // Conversation operations
  conversations: {
    create: async (data: NewConversation): Promise<ApiConversation> => {
      const { conversations } = getAdapters();
      return conversations.create(data);
    },

    get: async (id: string): Promise<ApiConversation | null> => {
      const { conversations } = getAdapters();
      return conversations.get(id);
    },

    getAll: async (limit: number = 50): Promise<ApiConversation[]> => {
      const { conversations } = getAdapters();
      return conversations.getAll(limit);
    },

    updateTitle: async (id: string, title: string): Promise<void> => {
      const { conversations } = getAdapters();
      return conversations.updateTitle(id, title);
    },

    delete: async (id: string): Promise<void> => {
      const { conversations } = getAdapters();
      return conversations.delete(id);
    },

    restore: async (id: string): Promise<void> => {
      // Core doesn't have restore yet - silently succeed
      // In future, could implement soft deletes
    },

    search: async (query: string, limit: number = 20): Promise<ApiConversation[]> => {
      const { conversations } = getAdapters();
      return conversations.search(query, limit);
    },

    createBranch: async (
      parentConversationId: string,
      branchPointMessageId: string,
      title: string,
    ): Promise<ApiConversation> => {
      const { conversations } = getAdapters();
      return conversations.createBranch(parentConversationId, branchPointMessageId, title);
    },

    getBranches: async (conversationId: string): Promise<ApiConversation[]> => {
      const { conversations } = getAdapters();
      return conversations.getBranches(conversationId);
    },
  },

  // Message operations
  messages: {
    create: async (data: NewMessage): Promise<ApiMessage> => {
      const { messages } = getAdapters();
      return messages.create(data);
    },

    getByConversation: async (conversationId: string): Promise<ApiMessage[]> => {
      const { messages } = getAdapters();
      return messages.getByConversation(conversationId);
    },

    getLastN: async (conversationId: string, n: number): Promise<ApiMessage[]> => {
      const { messages } = getAdapters();
      return messages.getLastN(conversationId, n);
    },

    search: async (query: string, limit: number = 50): Promise<ApiMessage[]> => {
      const { messages } = getAdapters();
      return messages.search(query, limit);
    },

    delete: async (id: string): Promise<void> => {
      const { messages } = getAdapters();
      return messages.delete(id);
    },

    getConversationTokenCount: async (conversationId: string): Promise<number> => {
      // Not implemented in core yet - return 0
      return 0;
    },
  },

  // Window operations (not applicable to core)
  window: {
    toggle: async (): Promise<void> => {
      // No-op for core database
    },

    saveState: async (): Promise<void> => {
      // No-op for core database
    },

    restoreState: async (): Promise<void> => {
      // No-op for core database
    },

    getState: async () => {
      return null;
    },

    resetState: async (): Promise<void> => {
      // No-op for core database
    },
  },

  // Settings operations (not implemented in core yet)
  settings: {
    get: async (key: string): Promise<string | null> => {
      // Not implemented in core
      return null;
    },

    set: async (key: string, value: string): Promise<void> => {
      // Not implemented in core
    },

    getAll: async () => {
      return [];
    },
  },

  // Tag operations (not implemented in core yet)
  tags: {
    create: async (data: NewTag): Promise<ApiTag> => {
      throw new Error('Tags not yet implemented in @lia-code/core');
    },

    get: async (id: string): Promise<ApiTag | null> => {
      return null;
    },

    getAll: async (): Promise<ApiTag[]> => {
      return [];
    },

    search: async (query: string): Promise<ApiTag[]> => {
      return [];
    },

    delete: async (id: string): Promise<void> => {
      // No-op
    },

    update: async (id: string, data: Partial<ApiTag>): Promise<void> => {
      // No-op
    },

    addToConversation: async (conversationId: string, tagId: string): Promise<void> => {
      // No-op
    },

    removeFromConversation: async (conversationId: string, tagId: string): Promise<void> => {
      // No-op
    },
  },
};
