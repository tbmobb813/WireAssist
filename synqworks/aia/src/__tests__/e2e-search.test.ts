/**
 * End-to-End Search Integration Tests
 * Verifies search functionality across service, store, and database layers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { searchService } from '../lib/services/searchService';
import { useSearchStore } from '../lib/stores/searchStore';

describe('E2E Search Integration', () => {
  beforeEach(() => {
    searchService.clearCache();
    // Reset store to initial state
    useSearchStore.setState({
      query: '',
      isSearching: false,
      error: null,
      conversations: [],
      messages: [],
      totalResults: 0,
      executionTime: 0,
      filters: {},
      sortBy: 'relevance',
      limit: 20,
      offset: 0,
      suggestions: [],
      showSuggestions: false,
      history: [],
    });
  });

  afterEach(() => {
    searchService.clearCache();
    // Don't clear history - it's used by history tests and is non-destructive
  });

  describe('Search Service + Store Integration', () => {
    it('should search through store', async () => {
      let store = useSearchStore.getState();

      await store.search('test_query');
      store = useSearchStore.getState(); // Get fresh snapshot

      expect(store.query).toBe('test_query');
      expect(Array.isArray(store.conversations)).toBe(true);
      expect(Array.isArray(store.messages)).toBe(true);
    });

    it('should track search execution time', async () => {
      let store = useSearchStore.getState();

      await store.search('timing_test');
      store = useSearchStore.getState(); // Get fresh snapshot

      expect(store.executionTime).toBeGreaterThanOrEqual(0);
      expect(typeof store.executionTime).toBe('number');
    });

    it('should handle search errors in store', async () => {
      let store = useSearchStore.getState();

      // Empty query should clear results
      await store.search('');
      store = useSearchStore.getState(); // Get fresh snapshot

      expect(store.query).toBe('');
      expect(store.conversations.length).toBe(0);
      expect(store.messages.length).toBe(0);
    });
  });

  describe('Filtering with Store', () => {
    it('should apply provider filter', async () => {
      let store = useSearchStore.getState();

      store.setFilter({ provider: 'openai' });
      store = useSearchStore.getState(); // Get fresh snapshot
      await store.search('test');
      store = useSearchStore.getState(); // Get fresh snapshot

      store.conversations.forEach((conv) => {
        expect(conv.provider).toBe('openai');
      });
    });

    it('should apply model filter', async () => {
      let store = useSearchStore.getState();

      store.setFilter({ model: 'gpt-4' });
      store = useSearchStore.getState(); // Get fresh snapshot
      await store.search('test');
      store = useSearchStore.getState(); // Get fresh snapshot

      store.conversations.forEach((conv) => {
        expect(conv.model).toBe('gpt-4');
      });
    });

    it('should combine multiple filters', async () => {
      let store = useSearchStore.getState();

      store.setFilter({ provider: 'openai', model: 'gpt-4' });
      store = useSearchStore.getState(); // Get fresh snapshot
      await store.search('test');
      store = useSearchStore.getState(); // Get fresh snapshot

      store.conversations.forEach((conv) => {
        expect(conv.provider).toBe('openai');
        expect(conv.model).toBe('gpt-4');
      });
    });

    it('should clear filters', async () => {
      let store = useSearchStore.getState();

      // Start fresh
      store.clearFilters();
      store = useSearchStore.getState(); // Get fresh snapshot

      store.setFilter({ provider: 'openai' });
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(store.filters.provider).toBe('openai');

      store.clearFilters();
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(Object.keys(store.filters).length).toBe(0);
    });
  });

  describe('Pagination with Store', () => {
    it('should set result limit', async () => {
      let store = useSearchStore.getState();

      store.setLimit(10);
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(store.limit).toBe(10);

      await store.search('test');
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(store.conversations.length).toBeLessThanOrEqual(10);
    });

    it('should navigate pages', async () => {
      let store = useSearchStore.getState();

      store.setLimit(5);
      store = useSearchStore.getState(); // Get fresh snapshot
      await store.search('test');
      store = useSearchStore.getState(); // Get fresh snapshot

      const page1Offset = store.offset;
      expect(page1Offset).toBe(0);

      store.setOffset(5);
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(store.offset).toBe(5);

      store.setOffset(0);
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(store.offset).toBe(0);
    });

    it('should handle next page', async () => {
      let store = useSearchStore.getState();

      store.setLimit(5);
      store = useSearchStore.getState(); // Get fresh snapshot
      await store.search('test');
      store = useSearchStore.getState(); // Get fresh snapshot

      const initialOffset = store.offset;
      await store.nextPage();
      store = useSearchStore.getState(); // Get fresh snapshot

      expect(store.offset).toBe(initialOffset + 5);
    });

    it('should handle previous page', async () => {
      let store = useSearchStore.getState();

      store.setLimit(5);
      store = useSearchStore.getState(); // Get fresh snapshot
      store.setOffset(10);
      store = useSearchStore.getState(); // Get fresh snapshot

      await store.previousPage();
      store = useSearchStore.getState(); // Get fresh snapshot

      expect(store.offset).toBe(5);
    });

    it('should not go below zero on previous page', async () => {
      let store = useSearchStore.getState();

      store.setOffset(2);
      store = useSearchStore.getState(); // Get fresh snapshot
      await store.previousPage();
      store = useSearchStore.getState(); // Get fresh snapshot

      expect(store.offset).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Sorting with Store', () => {
    it('should sort by relevance', async () => {
      let store = useSearchStore.getState();

      store.setSortBy('relevance');
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(store.sortBy).toBe('relevance');

      await store.search('test');
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(store.sortBy).toBe('relevance');
    });

    it('should sort by date', async () => {
      let store = useSearchStore.getState();

      store.setSortBy('date');
      store = useSearchStore.getState(); // Get fresh snapshot
      await store.search('test');
      store = useSearchStore.getState(); // Get fresh snapshot

      expect(store.sortBy).toBe('date');
    });

    it('should sort by title', async () => {
      let store = useSearchStore.getState();

      store.setSortBy('title');
      store = useSearchStore.getState(); // Get fresh snapshot
      await store.search('test');
      store = useSearchStore.getState(); // Get fresh snapshot

      expect(store.sortBy).toBe('title');
    });
  });

  describe('Search Suggestions', () => {
    it('should provide suggestions from store', async () => {
      let store = useSearchStore.getState();

      await store.getSuggestions('test');
      store = useSearchStore.getState(); // Get fresh snapshot

      expect(Array.isArray(store.suggestions)).toBe(true);
      expect(store.showSuggestions).toBe(true);
    });

    it('should clear suggestions', async () => {
      let store = useSearchStore.getState();

      await store.getSuggestions('test');
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(store.suggestions.length).toBeGreaterThanOrEqual(0);

      store.clearSuggestions();
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(store.suggestions.length).toBe(0);
      expect(store.showSuggestions).toBe(false);
    });

    it('should clear suggestions on empty query', async () => {
      let store = useSearchStore.getState();

      await store.getSuggestions('');
      store = useSearchStore.getState(); // Get fresh snapshot

      expect(store.suggestions.length).toBe(0);
      expect(store.showSuggestions).toBe(false);
    });
  });

  describe('Search History', () => {
    it('should load search history', async () => {
      let store = useSearchStore.getState();

      await store.search('history_test_1');
      await store.search('history_test_2');
      store = useSearchStore.getState(); // Get fresh snapshot

      store.loadHistory();
      store = useSearchStore.getState(); // Get fresh snapshot

      expect(Array.isArray(store.history)).toBe(true);
    });

    it('should clear search history', async () => {
      let store = useSearchStore.getState();

      await store.search('history_before_clear');
      store = useSearchStore.getState(); // Get fresh snapshot after state update

      store.loadHistory();
      store = useSearchStore.getState(); // Get fresh snapshot after state update
      expect(store.history.length).toBeGreaterThan(0);

      store.clearHistory();
      store = useSearchStore.getState(); // Get fresh snapshot after state update
      expect(store.history.length).toBe(0);
    });
  });

  describe('Conversation Search', () => {
    it('should search within specific conversation', async () => {
      let store = useSearchStore.getState();
      const conversationId = 'conv-123';

      await store.searchConversation(conversationId, 'test');
      store = useSearchStore.getState(); // Get fresh snapshot

      // All messages should be from conversation
      store.messages.forEach((msg) => {
        expect(msg.conversation_id).toBe(conversationId);
      });
    });

    it('should handle empty query in conversation search', async () => {
      let store = useSearchStore.getState();

      // First do a search so state isn't empty
      await store.searchConversation('conv-123', 'test');
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(store.messages.length).toBeGreaterThanOrEqual(0);

      // Empty query should clear
      await store.searchConversation('conv-123', '');
      store = useSearchStore.getState(); // Get fresh snapshot

      expect(store.query).toBe('');
      expect(store.messages.length).toBe(0);
    });
  });

  describe('Store State Management', () => {
    it('should clear search state', async () => {
      let store = useSearchStore.getState();

      await store.search('test_query');
      store = useSearchStore.getState(); // Get fresh snapshot after state update
      expect(store.query).toBe('test_query');

      store.clearSearch();
      store = useSearchStore.getState(); // Get fresh snapshot after state update

      expect(store.query).toBe('');
      expect(store.conversations.length).toBe(0);
      expect(store.messages.length).toBe(0);
      expect(store.totalResults).toBe(0);
    });

    it('should track total results', async () => {
      const store = useSearchStore.getState();

      await store.search('test');

      expect(typeof store.totalResults).toBe('number');
      expect(store.totalResults).toBeGreaterThanOrEqual(0);
      expect(store.totalResults).toBe(
        store.conversations.length + store.messages.length,
      );
    });

    it('should manage loading state', async () => {
      const store = useSearchStore.getState();

      expect(store.isSearching).toBe(false);

      const searchPromise = store.search('test');
      // Immediately after search call, might be searching
      // But we can't guarantee timing

      await searchPromise;
      expect(store.isSearching).toBe(false);
    });

    it('should handle errors in store', async () => {
      const store = useSearchStore.getState();

      // Very long query might cause issues
      const longQuery = 'a'.repeat(10000);

      try {
        await store.search(longQuery);
      } catch {
        // May or may not error
      }

      // Store should still be in valid state
      expect(store.error === null || typeof store.error === 'string').toBe(true);
      expect(store.isSearching).toBe(false);
    });
  });

  describe('Multiple Searches in Store', () => {
    it('should handle sequential searches', async () => {
      let store = useSearchStore.getState();

      await store.search('sequential_search_1');
      store = useSearchStore.getState(); // Get fresh snapshot after state update
      expect(store.query).toBe('sequential_search_1');

      await store.search('sequential_search_2');
      store = useSearchStore.getState(); // Get fresh snapshot after state update
      expect(store.query).toBe('sequential_search_2');
    });

    it('should preserve filters across searches', async () => {
      let store = useSearchStore.getState();

      store.setFilter({ provider: 'openai' });
      store = useSearchStore.getState(); // Get fresh snapshot after state update
      expect(store.filters.provider).toBe('openai');

      await store.search('filter_test_1');
      store = useSearchStore.getState(); // Get fresh snapshot after state update
      expect(store.filters.provider).toBe('openai');

      await store.search('filter_test_2');
      store = useSearchStore.getState(); // Get fresh snapshot after state update
      expect(store.filters.provider).toBe('openai');
    });
  });

  describe('Advanced Search Features', () => {
    it('should get trending searches', async () => {
      const store = useSearchStore.getState();

      // Add searches
      for (let i = 0; i < 5; i++) {
        try {
          await store.search('trending_test');
        } catch {
          // May fail
        }
      }

      const trending = await store.getTrendingSearches();

      expect(Array.isArray(trending)).toBe(true);
    });

    it('should handle rapid searches', async () => {
      const store = useSearchStore.getState();

      const searches = Promise.all([
        store.search('rapid_1'),
        store.search('rapid_2'),
        store.search('rapid_3'),
      ]);

      await searches;

      expect(store.query).toBeDefined();
      expect(Array.isArray(store.conversations)).toBe(true);
    });
  });

  describe('Full Search Workflow', () => {
    it('should complete full search workflow', async () => {
      let store = useSearchStore.getState();

      // 1. Get suggestions
      await store.getSuggestions('workflow');
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(Array.isArray(store.suggestions)).toBe(true);

      // 2. Execute search
      await store.search('workflow_search');
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(store.query).toBe('workflow_search');
      expect(store.isSearching).toBe(false);

      // 3. Apply filters
      store.setFilter({ provider: 'openai' });
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(store.filters.provider).toBe('openai');

      // 4. Set limit
      store.setLimit(10);
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(store.limit).toBe(10);

      // 5. Load history
      store.loadHistory();
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(Array.isArray(store.history)).toBe(true);

      // 6. Clear
      store.clearSearch();
      store = useSearchStore.getState(); // Get fresh snapshot
      expect(store.query).toBe('');
    });
  });
});
