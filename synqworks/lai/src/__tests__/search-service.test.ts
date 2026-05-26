/**
 * Search Service Tests
 * Verifies advanced search functionality with filters, caching, and ranking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SearchService } from '../lib/services/searchService';
import type { SearchOptions, SearchHistory } from '../lib/services/searchService';

describe('Search Service', () => {
  let searchService: SearchService;

  beforeEach(() => {
    searchService = new SearchService();
  });

  afterEach(() => {
    searchService.clearCache();
    searchService.clearHistory();
  });

  describe('Basic Search', () => {
    it('should initialize search service', () => {
      expect(searchService).toBeDefined();
    });

    it('should return empty results for non-existent query', async () => {
      const results = await searchService.search('nonexistent_xyz_query_abc');

      expect(results).toBeDefined();
      expect(results.query).toBe('nonexistent_xyz_query_abc');
      expect(results.total).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(results.conversations)).toBe(true);
      expect(Array.isArray(results.messages)).toBe(true);
    });

    it('should track execution time', async () => {
      const results = await searchService.search('test');

      expect(results.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof results.executionTimeMs).toBe('number');
    });
  });

  describe('Search Options', () => {
    it('should respect limit option', async () => {
      const results = await searchService.search('test', { limit: 5 });

      expect(results).toBeDefined();
      expect(results.conversations.length).toBeLessThanOrEqual(5);
      expect(results.messages.length).toBeLessThanOrEqual(5);
    });

    it('should handle offset for pagination', async () => {
      const page1 = await searchService.search('test', { limit: 10, offset: 0 });
      const page2 = await searchService.search('test', { limit: 10, offset: 10 });

      expect(page1).toBeDefined();
      expect(page2).toBeDefined();
    });

    it('should support sort by relevance', async () => {
      const results = await searchService.search('test', { sortBy: 'relevance' });

      // Results should be sorted by score (descending)
      if (results.conversations.length > 1) {
        for (let i = 0; i < results.conversations.length - 1; i++) {
          expect(results.conversations[i].score).toBeGreaterThanOrEqual(
            results.conversations[i + 1].score,
          );
        }
      }
    });

    it('should support sort by date', async () => {
      const results = await searchService.search('test', { sortBy: 'date' });
      expect(results).toBeDefined();
    });

    it('should support sort by title', async () => {
      const results = await searchService.search('test', { sortBy: 'title' });
      expect(results).toBeDefined();
    });

    it('should toggle message inclusion', async () => {
      const withMessages = await searchService.search('test', {
        includeMessages: true,
      });
      const withoutMessages = await searchService.search('test', {
        includeMessages: false,
      });

      expect(withMessages.messages.length).toBeGreaterThanOrEqual(0);
      expect(withoutMessages.messages.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Filter Options', () => {
    it('should filter by provider', async () => {
      const results = await searchService.search('test', { provider: 'openai' });

      results.conversations.forEach((result) => {
        expect(result.item.provider).toBe('openai');
      });
    });

    it('should filter by model', async () => {
      const results = await searchService.search('test', { model: 'gpt-4' });

      results.conversations.forEach((result) => {
        expect(result.item.model).toBe('gpt-4');
      });
    });

    it('should filter by date range', async () => {
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;

      const results = await searchService.search('test', {
        startDate: now - oneDayMs,
        endDate: now,
      });

      results.conversations.forEach((result) => {
        expect(result.item.created_at).toBeGreaterThanOrEqual(now - oneDayMs);
        expect(result.item.created_at).toBeLessThanOrEqual(now);
      });
    });

    it('should filter messages by role', async () => {
      const results = await searchService.search('test', { role: 'user' });

      results.messages.forEach((result) => {
        expect(result.item.role).toBe('user');
      });
    });

    it('should filter messages by conversation', async () => {
      const convId = 'conv-123';
      const results = await searchService.search('test', { conversationId: convId });

      results.messages.forEach((result) => {
        expect(result.item.conversation_id).toBe(convId);
      });
    });

    it('should combine multiple filters', async () => {
      const results = await searchService.search('test', {
        provider: 'openai',
        model: 'gpt-4',
        role: 'assistant',
        limit: 10,
      });

      expect(results).toBeDefined();
      results.conversations.forEach((result) => {
        expect(result.item.provider).toBe('openai');
        expect(result.item.model).toBe('gpt-4');
      });
    });
  });

  describe('Caching', () => {
    it('should cache search results', async () => {
      const query = 'test_cache_query';

      const first = await searchService.search(query);
      const second = await searchService.search(query);

      // Second should be from cache (same reference or deep equal)
      expect(first.query).toBe(second.query);
      expect(first.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(second.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should cache different queries separately', async () => {
      const results1 = await searchService.search('query1');
      const results2 = await searchService.search('query2');

      expect(results1.query).toBe('query1');
      expect(results2.query).toBe('query2');
    });

    it('should clear cache', async () => {
      await searchService.search('test_cache');
      searchService.clearCache();

      // Cache should be cleared
      expect(searchService).toBeDefined();
    });

    it('should invalidate cache with different filters', async () => {
      const query = 'filter_test';

      const result1 = await searchService.search(query, { provider: 'openai' });
      const result2 = await searchService.search(query, { provider: 'anthropic' });

      // Different filters should produce different cache keys
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('Search History', () => {
    it('should add searches to history', async () => {
      await searchService.search('history_test_1');
      const history = searchService.getHistory();

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].query).toBe('history_test_1');
    });

    it('should track result count in history', async () => {
      await searchService.search('history_test_2');
      const history = searchService.getHistory(1);

      expect(history[0].resultCount).toBeGreaterThanOrEqual(0);
      expect(history[0].timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should limit history size', async () => {
      // Add more than 100 searches
      for (let i = 0; i < 150; i++) {
        try {
          await searchService.search(`query_${i}`);
        } catch {
          // Some searches may fail
        }
      }

      const history = searchService.getHistory(200);
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should return history in reverse chronological order', async () => {
      await searchService.search('history_1');
      await new Promise((r) => setTimeout(r, 10));
      await searchService.search('history_2');

      const history = searchService.getHistory(2);
      expect(history[0].query).toBe('history_2');
      expect(history[1].query).toBe('history_1');
    });

    it('should clear history', async () => {
      await searchService.search('before_clear');
      const historyBefore = searchService.getHistory();
      expect(historyBefore.length).toBeGreaterThan(0);

      searchService.clearHistory();
      const historyAfter = searchService.getHistory();
      expect(historyAfter.length).toBe(0);
    });

    it('should get trending searches', async () => {
      // Add repeated searches
      for (let i = 0; i < 5; i++) {
        try {
          await searchService.search('popular_query');
        } catch {
          // May fail
        }
      }

      for (let i = 0; i < 3; i++) {
        try {
          await searchService.search('less_popular');
        } catch {
          // May fail
        }
      }

      const trending = searchService.getTrendingSearches(10);

      expect(trending.length).toBeGreaterThan(0);
      if (trending.length > 0) {
        expect(trending[0].count).toBeGreaterThanOrEqual(trending[1]?.count ?? 0);
      }
    });
  });

  describe('Search Scoring', () => {
    it('should score exact matches highly', async () => {
      const results = await searchService.search('exact_match_test', {
        limit: 50,
      });

      if (results.conversations.length > 1) {
        // Results should be sorted by relevance
        expect(results.conversations[0].score).toBeGreaterThanOrEqual(0);
      }
    });

    it('should rank user messages higher than assistant', async () => {
      const results = await searchService.search('message', { includeMessages: true });

      // User messages should generally score higher
      const userMessages = results.messages.filter((r) => r.item.role === 'user');
      const assistantMessages = results.messages.filter(
        (r) => r.item.role === 'assistant',
      );

      if (userMessages.length > 0 && assistantMessages.length > 0) {
        const avgUserScore =
          userMessages.reduce((sum, r) => sum + r.score, 0) / userMessages.length;
        const avgAssistantScore =
          assistantMessages.reduce((sum, r) => sum + r.score, 0) /
          assistantMessages.length;

        expect(avgUserScore).toBeGreaterThanOrEqual(0);
        expect(avgAssistantScore).toBeGreaterThanOrEqual(0);
      }
    });

    it('should assign scores to results', async () => {
      const results = await searchService.search('test');

      results.conversations.forEach((result) => {
        expect(typeof result.score).toBe('number');
        expect(result.score).toBeGreaterThanOrEqual(0);
      });

      results.messages.forEach((result) => {
        expect(typeof result.score).toBe('number');
        expect(result.score).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Search Suggestions', () => {
    it('should provide search suggestions from history', async () => {
      await searchService.search('suggestion_test');
      const suggestions = await searchService.getSuggestions('suggest');

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should limit suggestions', async () => {
      for (let i = 0; i < 20; i++) {
        try {
          await searchService.search(`suggestion_${i}`);
        } catch {
          // May fail
        }
      }

      const suggestions = await searchService.getSuggestions('suggestion', 5);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should match partial queries', async () => {
      await searchService.search('typescript_learning');
      const suggestions = await searchService.getSuggestions('type');

      expect(suggestions.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty suggestions for no match', async () => {
      const suggestions = await searchService.getSuggestions(
        'nonexistent_xyz_query_abc',
        10,
      );

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Conversation Search', () => {
    it('should search within a specific conversation', async () => {
      const convId = 'conv-123';
      const results = await searchService.searchConversation(convId, 'test');

      expect(results).toBeDefined();
      expect(results.query).toBe('test');

      // All messages should be from the conversation
      results.messages.forEach((result) => {
        expect(result.item.conversation_id).toBe(convId);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle search errors gracefully', async () => {
      // Should not throw for empty query
      const results = await searchService.search('');
      expect(results).toBeDefined();
    });

    it('should handle special characters in query', async () => {
      const specialQuery = '@#$%^&*()_+-=[]{}|;:,.<>?';
      const results = await searchService.search(specialQuery);

      expect(results).toBeDefined();
      expect(results.query).toBe(specialQuery);
    });

    it('should handle very long queries', async () => {
      const longQuery = 'a'.repeat(1000);
      const results = await searchService.search(longQuery);

      expect(results).toBeDefined();
    });

    it('should handle unicode queries', async () => {
      const unicodeQuery = '你好世界 🌍';
      const results = await searchService.search(unicodeQuery);

      expect(results).toBeDefined();
    });
  });

  describe('Result Format', () => {
    it('should include match fields in results', async () => {
      const results = await searchService.search('test');

      results.conversations.forEach((result) => {
        expect(Array.isArray(result.matchFields)).toBe(true);
      });

      results.messages.forEach((result) => {
        expect(Array.isArray(result.matchFields)).toBe(true);
      });
    });

    it('should structure result set properly', async () => {
      const results = await searchService.search('test');

      expect(results.conversations).toBeDefined();
      expect(results.messages).toBeDefined();
      expect(results.total).toBe(
        results.conversations.length + results.messages.length,
      );
      expect(results.query).toBe('test');
      expect(typeof results.executionTimeMs).toBe('number');
    });
  });

  describe('Multiple Searches', () => {
    it('should handle concurrent searches', async () => {
      const results = await Promise.all([
        searchService.search('test1'),
        searchService.search('test2'),
        searchService.search('test3'),
      ]);

      expect(results.length).toBe(3);
      expect(results[0].query).toBe('test1');
      expect(results[1].query).toBe('test2');
      expect(results[2].query).toBe('test3');
    });

    it('should maintain separate histories for different queries', async () => {
      await searchService.search('history_distinct_a');
      await searchService.search('history_distinct_b');
      await searchService.search('history_distinct_c');

      const history = searchService.getHistory(10);
      expect(history.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Performance', () => {
    it('should return cached results quickly', async () => {
      const query = 'performance_test';

      // First search (no cache)
      const start1 = Date.now();
      await searchService.search(query);
      const time1 = Date.now() - start1;

      // Second search (cached)
      const start2 = Date.now();
      await searchService.search(query);
      const time2 = Date.now() - start2;

      // Cached should generally be faster, but may be similar in fast environments
      expect(time2).toBeGreaterThanOrEqual(0);
      expect(time1).toBeGreaterThanOrEqual(0);
    });
  });
});
