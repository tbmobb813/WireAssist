/**
 * Hybrid Database Module
 * Intelligently switches between Tauri-based and @lia-code/core-based storage
 * Allows the app to work in both native (Tauri) and web contexts
 */

import type {
  NewConversation,
  NewMessage,
  ApiConversation,
  ApiMessage,
  Setting,
  ApiTag,
  NewTag,
  ApiWorkspaceTemplate,
  NewWorkspaceTemplate,
} from './types';

// Import the original Tauri-based database
import { database as tauriDatabase } from './database';

// Import the core-based database
import { coreDatabaseApi } from './database-core';

// Flag to control which database backend to use
let useCoreDatabaseBackend = false;

/**
 * Enable or disable the core database backend
 * When enabled, uses @lia-code/core for storage instead of Tauri IPC
 */
export function setUseCoreDatabase(enable: boolean) {
  useCoreDatabaseBackend = enable;
}

/**
 * Check if core database is currently enabled
 */
export function isUsingCoreDatabase(): boolean {
  return useCoreDatabaseBackend;
}

/**
 * Get the active database implementation
 */
function getActiveDatabase() {
  return useCoreDatabaseBackend ? coreDatabaseApi : tauriDatabase;
}

/**
 * Hybrid database API that matches the interface of both database implementations
 */
export const database = {
  // Conversation operations
  conversations: {
    create: async (data: NewConversation): Promise<ApiConversation> => {
      return getActiveDatabase().conversations.create(data);
    },

    get: async (id: string): Promise<ApiConversation | null> => {
      return getActiveDatabase().conversations.get(id);
    },

    getAll: async (limit: number = 50): Promise<ApiConversation[]> => {
      return getActiveDatabase().conversations.getAll(limit);
    },

    updateTitle: async (id: string, title: string): Promise<void> => {
      return getActiveDatabase().conversations.updateTitle(id, title);
    },

    delete: async (id: string): Promise<void> => {
      return getActiveDatabase().conversations.delete(id);
    },

    restore: async (id: string): Promise<void> => {
      return getActiveDatabase().conversations.restore(id);
    },

    search: async (
      query: string,
      limit: number = 20,
    ): Promise<ApiConversation[]> => {
      return getActiveDatabase().conversations.search(query, limit);
    },

    createBranch: async (
      parentConversationId: string,
      branchPointMessageId: string,
      title: string,
    ): Promise<ApiConversation> => {
      return getActiveDatabase().conversations.createBranch(
        parentConversationId,
        branchPointMessageId,
        title,
      );
    },

    getBranches: async (conversationId: string): Promise<ApiConversation[]> => {
      return getActiveDatabase().conversations.getBranches(conversationId);
    },
  },

  // Message operations
  messages: {
    create: async (data: NewMessage): Promise<ApiMessage> => {
      return getActiveDatabase().messages.create(data);
    },

    getByConversation: async (conversationId: string): Promise<ApiMessage[]> => {
      return getActiveDatabase().messages.getByConversation(conversationId);
    },

    getLastN: async (conversationId: string, n: number): Promise<ApiMessage[]> => {
      return getActiveDatabase().messages.getLastN(conversationId, n);
    },

    search: async (query: string, limit: number = 50): Promise<ApiMessage[]> => {
      return getActiveDatabase().messages.search(query, limit);
    },

    delete: async (id: string): Promise<void> => {
      return getActiveDatabase().messages.delete(id);
    },

    getConversationTokenCount: async (conversationId: string): Promise<number> => {
      return getActiveDatabase().messages.getConversationTokenCount?.(conversationId) ?? 0;
    },
  },

  // Window operations
  window: {
    toggle: async (): Promise<void> => {
      return getActiveDatabase().window?.toggle?.();
    },

    saveState: async (): Promise<void> => {
      return getActiveDatabase().window?.saveState?.();
    },

    restoreState: async (): Promise<void> => {
      return getActiveDatabase().window?.restoreState?.();
    },

    getState: async () => {
      return getActiveDatabase().window?.getState?.();
    },

    resetState: async (): Promise<void> => {
      return getActiveDatabase().window?.resetState?.();
    },
  },

  // Settings operations (delegates to Tauri, not in core yet)
  settings: {
    get: async (key: string): Promise<string | null> => {
      return getActiveDatabase().settings?.get?.(key) ?? null;
    },

    set: async (key: string, value: string): Promise<void> => {
      return getActiveDatabase().settings?.set?.(key, value);
    },

    getAll: async () => {
      return getActiveDatabase().settings?.getAll?.() ?? [];
    },
  },

  // Tag operations (delegates to Tauri, not in core yet)
  tags: {
    create: async (data: NewTag) => {
      return getActiveDatabase().tags?.create?.(data);
    },

    get: async (id: string) => {
      return getActiveDatabase().tags?.get?.(id);
    },

    getAll: async () => {
      return getActiveDatabase().tags?.getAll?.();
    },

    search: async (query: string) => {
      return getActiveDatabase().tags?.search?.(query);
    },

    delete: async (id: string) => {
      return getActiveDatabase().tags?.delete?.(id);
    },

    update: async (id: string, data: any) => {
      return getActiveDatabase().tags?.update?.(id, data);
    },
  },
};
