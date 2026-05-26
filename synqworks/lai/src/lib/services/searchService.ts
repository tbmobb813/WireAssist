/**
 * Search Service
 * Advanced search with FTS5, filtering, caching, and ranking
 */

import { database as db } from '../api/database';
import { privacyService } from './privacyService';
import type { ApiConversation as Conversation, ApiMessage as Message } from '../api/types';

export interface SearchFilter {
  startDate?: number; // timestamp
  endDate?: number; // timestamp
  provider?: string; // 'openai', 'anthropic', 'gemini', 'ollama'
  model?: string;
  role?: 'user' | 'assistant'; // for message search
  conversationId?: string; // for message search within conversation
}

export interface SearchOptions extends SearchFilter {
  limit?: number;
  offset?: number;
  includeMessages?: boolean; // when searching conversations
  sortBy?: 'relevance' | 'date' | 'title';
}

export interface SearchResult<T = Conversation | Message> {
  item: T;
  score: number;
  snippet?: string;
  matchFields?: string[]; // which fields matched
}

export interface SearchResultSet {
  conversations: SearchResult<Conversation>[];
  messages: SearchResult<Message>[];
  total: number;
  query: string;
  executionTimeMs: number;
}

export interface SearchHistory {
  query: string;
  timestamp: number;
  resultCount: number;
}

export class SearchService {
  private cache: Map<string, { results: SearchResultSet; timestamp: number }> = new Map();
  private history: SearchHistory[] = [];
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_HISTORY = 100;

  /**
   * Search conversations and messages
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResultSet> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(query, options);

    // Check cache
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      // Log successful cached search
      const executionTime = Date.now() - startTime;
      privacyService.logSearch(query, cached.conversations.length + cached.messages.length, executionTime);
      return cached;
    }

    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const includeMessages = options.includeMessages !== false;

    const results: SearchResultSet = {
      conversations: [],
      messages: [],
      total: 0,
      query,
      executionTimeMs: 0,
    };

    try {
      // Search conversations
      const conversations = await this.searchConversations(query, {
        ...options,
        limit,
        offset,
      });
      results.conversations = conversations;

      // Search messages if requested
      if (includeMessages) {
        const messages = await this.searchMessages(query, {
          ...options,
          limit,
          offset,
        });
        results.messages = messages;
      }

      results.total = results.conversations.length + results.messages.length;
      results.executionTimeMs = Date.now() - startTime;

      // Cache results
      this.cacheResults(cacheKey, results);

      // Add to history
      this.addToHistory(query, results.total);

      // Log search in audit trail
      privacyService.logSearch(query, results.total, results.executionTimeMs);

      return results;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      privacyService.logSearch(query, 0, executionTime, errorMessage);
      console.error('[SearchService] Search failed:', error);
      throw new Error(`Search failed: ${errorMessage}`);
    }
  }

  /**
   * Search only conversations
   */
  private async searchConversations(
    query: string,
    options: SearchOptions,
  ): Promise<SearchResult<Conversation>[]> {
    try {
      const allConversations = await db.conversations.getAll(1000);

      // Filter by query
      let results = allConversations.filter((conv) =>
        this.matchesQuery(conv.title, query),
      );

      // Apply filters
      if (options.provider) {
        results = results.filter((c) => c.provider === options.provider);
      }
      if (options.model) {
        results = results.filter((c) => c.model === options.model);
      }
      if (options.startDate) {
        results = results.filter((c) => c.created_at >= options.startDate!);
      }
      if (options.endDate) {
        results = results.filter((c) => c.created_at <= options.endDate!);
      }

      // Score results
      const scored = results.map((conv) => ({
        item: conv,
        score: this.scoreConversation(conv, query),
        matchFields: ['title'],
      }));

      // Sort by score or specified sort
      const sorted = this.sortResults(scored, options.sortBy ?? 'relevance');

      // Apply pagination
      const limited = sorted.slice(
        options.offset ?? 0,
        (options.offset ?? 0) + (options.limit ?? 50),
      );

      return limited;
    } catch (error) {
      console.error('[SearchService] Conversation search failed:', error);
      return [];
    }
  }

  /**
   * Search only messages
   */
  private async searchMessages(
    query: string,
    options: SearchOptions,
  ): Promise<SearchResult<Message>[]> {
    try {
      // Use core search for FTS support
      const searchResults = await db.messages.search(query, options.limit ?? 50);

      // Convert to SearchResult format with scoring
      let results = searchResults.map((msg) => ({
        item: msg,
        score: this.scoreMessage(msg, query),
        matchFields: ['content'],
      }));

      // Apply filters
      if (options.role) {
        results = results.filter((r) => r.item.role === options.role);
      }
      if (options.conversationId) {
        results = results.filter((r) => r.item.conversation_id === options.conversationId);
      }
      if (options.startDate) {
        results = results.filter((r) => r.item.timestamp >= options.startDate!);
      }
      if (options.endDate) {
        results = results.filter((r) => r.item.timestamp <= options.endDate!);
      }

      // Sort
      const sorted = this.sortResults(results, options.sortBy ?? 'relevance');

      // Pagination
      const limited = sorted.slice(
        options.offset ?? 0,
        (options.offset ?? 0) + (options.limit ?? 50),
      );

      return limited;
    } catch (error) {
      console.error('[SearchService] Message search failed:', error);
      return [];
    }
  }

  /**
   * Search within a specific conversation
   */
  async searchConversation(conversationId: string, query: string, limit: number = 50) {
    return this.search(query, {
      conversationId,
      limit,
      includeMessages: true,
    });
  }

  /**
   * Get search suggestions for autocomplete
   */
  async getSuggestions(query: string, limit: number = 10): Promise<string[]> {
    const suggestions = new Set<string>();

    // Add from history
    this.history
      .filter((h) => h.query.toLowerCase().includes(query.toLowerCase()))
      .slice(-limit)
      .forEach((h) => suggestions.add(h.query));

    // Add from conversation titles
    const conversations = await db.conversations.getAll(100);
    conversations
      .filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit)
      .forEach((c) => suggestions.add(c.title));

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Get search history
   */
  getHistory(limit: number = 20): SearchHistory[] {
    return this.history.slice(-limit).reverse();
  }

  /**
   * Clear search history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get trending search terms
   */
  getTrendingSearches(limit: number = 10): Array<{ query: string; count: number }> {
    const counts: Record<string, number> = {};

    this.history.forEach((item) => {
      counts[item.query] = (counts[item.query] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Match query against text
   */
  private matchesQuery(text: string, query: string): boolean {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Exact match
    if (lowerText === lowerQuery) return true;

    // Contains match
    if (lowerText.includes(lowerQuery)) return true;

    // All words match
    const queryWords = lowerQuery.split(/\s+/);
    return queryWords.every((word) => lowerText.includes(word));
  }

  /**
   * Score conversation relevance
   */
  private scoreConversation(conversation: Conversation, query: string): number {
    let score = 0;
    const lowerTitle = conversation.title.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Exact match bonus
    if (lowerTitle === lowerQuery) score += 100;

    // Starts with bonus
    if (lowerTitle.startsWith(lowerQuery)) score += 50;

    // Contains bonus (per occurrence)
    const occurrences = (lowerTitle.match(new RegExp(lowerQuery, 'g')) || []).length;
    score += occurrences * 10;

    // Length penalty (prefer shorter titles)
    score -= lowerTitle.length * 0.1;

    return Math.max(score, 0);
  }

  /**
   * Score message relevance
   */
  private scoreMessage(message: Message, query: string): number {
    let score = 0;
    const lowerContent = message.content.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // User messages score higher
    if (message.role === 'user') score += 5;

    // Exact match bonus
    if (lowerContent === lowerQuery) score += 100;

    // Starts with bonus
    if (lowerContent.startsWith(lowerQuery)) score += 50;

    // Contains bonus (per word)
    const queryWords = lowerQuery.split(/\s+/);
    queryWords.forEach((word) => {
      const matches = (lowerContent.match(new RegExp(word, 'g')) || []).length;
      score += matches * 5;
    });

    // Recency bonus (newer is better)
    const ageMinutes = (Date.now() - message.timestamp) / (1000 * 60);
    score += Math.max(50 - ageMinutes, 0) / 10;

    return Math.max(score, 0);
  }

  /**
   * Sort results by specified criteria
   */
  private sortResults<T extends { score: number; item: any }>(
    results: T[],
    sortBy: 'relevance' | 'date' | 'title',
  ): T[] {
    switch (sortBy) {
      case 'date':
        return results.sort((a, b) => {
          const aTime = 'timestamp' in a.item ? a.item.timestamp : a.item.created_at;
          const bTime = 'timestamp' in b.item ? b.item.timestamp : b.item.created_at;
          return bTime - aTime; // newest first
        });

      case 'title':
        return results.sort((a, b) => {
          const aTitle = a.item.title || a.item.content;
          const bTitle = b.item.title || b.item.content;
          return aTitle.localeCompare(bTitle);
        });

      case 'relevance':
      default:
        return results.sort((a, b) => b.score - a.score);
    }
  }

  /**
   * Get cache key
   */
  private getCacheKey(query: string, options: SearchOptions): string {
    const filterParts = [
      options.provider,
      options.model,
      options.role,
      options.conversationId,
      options.startDate,
      options.endDate,
      options.sortBy,
    ]
      .filter(Boolean)
      .join(':');

    return `${query}:${filterParts}`;
  }

  /**
   * Get from cache
   */
  private getFromCache(key: string): SearchResultSet | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check TTL
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.results;
  }

  /**
   * Cache results
   */
  private cacheResults(key: string, results: SearchResultSet): void {
    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      results,
      timestamp: Date.now(),
    });
  }

  /**
   * Add to history
   */
  private addToHistory(query: string, resultCount: number): void {
    this.history.push({
      query,
      timestamp: Date.now(),
      resultCount,
    });

    // Limit history size
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }
  }
}

// Export singleton
export const searchService = new SearchService();
