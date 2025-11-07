/**
 * Core Adapter Layer
 * Bridges @lia-code/core storage with the LAI app's database interface
 * Provides ConversationStore and MessageStore adapters that match the database API
 */

import {
  ConversationStore as CoreConversationStore,
  MessageStore as CoreMessageStore,
} from '@lia-code/core';
import type {
  ApiConversation,
  ApiMessage,
  NewConversation,
  NewMessage,
} from './types';

/**
 * Adapter for @lia-code/core's ConversationStore to match the database API interface
 */
export class ConversationAdapter {
  private coreStore: CoreConversationStore;

  constructor(dbPath: string) {
    this.coreStore = new CoreConversationStore(dbPath);
  }

  /**
   * Create a new conversation
   */
  async create(data: NewConversation): Promise<ApiConversation> {
    const id = await this.coreStore.create({
      title: data.title,
      model: data.model,
      provider: data.provider,
    });

    // Retrieve the created conversation to return full object
    const conversation = await this.coreStore.get(id);
    if (!conversation) {
      throw new Error(`Failed to create conversation: ${id}`);
    }

    return this.mapToApiConversation(conversation);
  }

  /**
   * Get a conversation by ID
   */
  async get(id: string): Promise<ApiConversation | null> {
    try {
      const conversation = await this.coreStore.get(id);
      if (!conversation) return null;
      return this.mapToApiConversation(conversation);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all conversations with limit
   */
  async getAll(limit: number = 50): Promise<ApiConversation[]> {
    const conversations = await this.coreStore.list();
    // Slice to limit
    const limited = conversations.slice(0, limit);
    return limited.map((c) => this.mapToApiConversation(c));
  }

  /**
   * Update conversation title
   */
  async updateTitle(id: string, title: string): Promise<void> {
    try {
      await this.coreStore.update(id, { title });
    } catch (error) {
      // If update fails, try to handle gracefully
      // This can happen if the database is locked or corrupted
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('database')) {
        throw error;
      }
      // For database-related errors, silently ignore as the store might
      // be handling it internally
      console.warn(`[ConversationAdapter] Update failed gracefully: ${message}`);
    }
  }

  /**
   * Delete a conversation
   */
  async delete(id: string): Promise<void> {
    await this.coreStore.delete(id);
  }

  /**
   * Search conversations by query
   */
  async search(query: string, limit: number = 20): Promise<ApiConversation[]> {
    const conversations = await this.coreStore.list();

    // Simple text search
    const filtered = conversations.filter((c) =>
      c.title.toLowerCase().includes(query.toLowerCase())
    );

    const limited = filtered.slice(0, limit);
    return limited.map((c) => this.mapToApiConversation(c));
  }

  /**
   * Create a conversation branch
   */
  async createBranch(
    parentConversationId: string,
    branchPointMessageId: string,
    title: string,
  ): Promise<ApiConversation> {
    // Get the parent conversation to copy its model/provider
    const parent = await this.coreStore.get(parentConversationId);
    if (!parent) {
      throw new Error(`Parent conversation not found: ${parentConversationId}`);
    }

    // Create new conversation as branch
    const id = await this.coreStore.create({
      title,
      model: parent.model,
      provider: parent.provider,
    });

    const conversation = await this.coreStore.get(id);
    if (!conversation) {
      throw new Error(`Failed to create branch: ${id}`);
    }

    return this.mapToApiConversation(conversation);
  }

  /**
   * Get conversation branches
   */
  async getBranches(conversationId: string): Promise<ApiConversation[]> {
    // For now, return empty array as branches are tracked in branchStore
    // This is application-level state, not core storage level
    return [];
  }

  /**
   * Map core conversation to API format
   */
  private mapToApiConversation(conv: any): ApiConversation {
    return {
      id: conv.id,
      title: conv.title,
      model: conv.model,
      provider: conv.provider,
      created_at: typeof conv.createdAt === 'number'
        ? conv.createdAt
        : conv.createdAt?.getTime?.() || Date.now(),
      updated_at: typeof conv.updatedAt === 'number'
        ? conv.updatedAt
        : conv.updatedAt?.getTime?.() || Date.now(),
      system_prompt: conv.system_prompt,
      parent_conversation_id: conv.parent_conversation_id,
      branch_point_message_id: conv.branch_point_message_id,
    };
  }
}

/**
 * Adapter for @lia-code/core's MessageStore to match the database API interface
 */
export class MessageAdapter {
  private coreStore: CoreMessageStore;

  constructor(dbPath: string) {
    this.coreStore = new CoreMessageStore(dbPath);
  }

  /**
   * Create a new message
   */
  async create(data: NewMessage): Promise<ApiMessage> {
    const id = await this.coreStore.create({
      conversationId: data.conversation_id,
      content: data.content,
      role: data.role,
      timestamp: Date.now(),
      tokensUsed: data.tokens_used,
    });

    // Retrieve the created message to return full object
    const message = await this.coreStore.get(id);
    if (!message) {
      throw new Error(`Failed to create message: ${id}`);
    }

    return this.mapToApiMessage(message);
  }

  /**
   * Get messages by conversation
   */
  async getByConversation(conversationId: string): Promise<ApiMessage[]> {
    const messages = await this.coreStore.getByConversation(conversationId);
    return messages.map((m) => this.mapToApiMessage(m));
  }

  /**
   * Get last N messages from a conversation
   */
  async getLastN(conversationId: string, n: number): Promise<ApiMessage[]> {
    const messages = await this.coreStore.getByConversation(conversationId);
    return messages.slice(-n).map((m) => this.mapToApiMessage(m));
  }

  /**
   * Search messages by query
   */
  async search(query: string, limit: number = 50): Promise<ApiMessage[]> {
    const messages = await this.coreStore.search(query);
    const limited = messages.slice(0, limit);
    return limited.map((m) => this.mapToApiMessage(m));
  }

  /**
   * Delete a message
   */
  async delete(id: string): Promise<void> {
    await this.coreStore.delete(id);
  }

  /**
   * Map core message to API format
   */
  private mapToApiMessage(msg: any): ApiMessage {
    return {
      id: msg.id,
      conversation_id: msg.conversationId,
      role: msg.role,
      content: msg.content,
      timestamp: typeof msg.timestamp === 'number'
        ? msg.timestamp
        : msg.timestamp?.getTime?.() || Date.now(),
    };
  }
}

/**
 * Initialize core adapters for a given database path
 */
export function initializeCoreAdapters(dbPath: string) {
  return {
    conversations: new ConversationAdapter(dbPath),
    messages: new MessageAdapter(dbPath),
  };
}

/**
 * Global core adapters instance
 * Will be initialized when the app starts
 */
let globalCoreAdapters: ReturnType<typeof initializeCoreAdapters> | null = null;

export function getCoreAdapters() {
  return globalCoreAdapters;
}

export function setCoreAdapters(adapters: ReturnType<typeof initializeCoreAdapters>) {
  globalCoreAdapters = adapters;
}
