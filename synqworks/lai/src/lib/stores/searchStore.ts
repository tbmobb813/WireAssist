/**
 * Search Store
 * Zustand store for managing search state and integrating with SearchService
 */

import { create } from 'zustand';
import { searchService } from '../services/searchService';
import type { SearchFilter, SearchOptions, SearchHistory } from '../services/searchService';
import type { ApiConversation as Conversation, ApiMessage as Message } from '../api/types';

interface SearchState {
  // Search state
  query: string;
  isSearching: boolean;
  error: string | null;

  // Results
  conversations: Conversation[];
  messages: Message[];
  totalResults: number;
  executionTime: number;

  // Options
  filters: SearchFilter;
  sortBy: 'relevance' | 'date' | 'title';
  limit: number;
  offset: number;

  // Suggestions
  suggestions: string[];
  showSuggestions: boolean;

  // History
  history: SearchHistory[];

  // Actions
  search: (query: string, options?: SearchOptions) => Promise<void>;
  clearSearch: () => void;
  setFilter: (filter: Partial<SearchFilter>) => void;
  clearFilters: () => void;
  setSortBy: (sortBy: 'relevance' | 'date' | 'title') => void;
  setLimit: (limit: number) => void;
  setOffset: (offset: number) => void;
  nextPage: () => Promise<void>;
  previousPage: () => Promise<void>;

  // Suggestions
  getSuggestions: (query: string) => Promise<void>;
  clearSuggestions: () => void;

  // History
  loadHistory: () => void;
  clearHistory: () => void;

  // Advanced
  searchConversation: (conversationId: string, query: string) => Promise<void>;
  getTrendingSearches: () => Promise<Array<{ query: string; count: number }>>;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  // Initial state
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

  // Search action
  search: async (query, options = {}) => {
    const state = get();

    if (!query.trim()) {
      set({
        query: '',
        conversations: [],
        messages: [],
        totalResults: 0,
        error: null,
      });
      return;
    }

    try {
      set({ isSearching: true, error: null, query });

      const searchOptions: SearchOptions = {
        ...options,
        ...state.filters,
        sortBy: state.sortBy,
        limit: state.limit,
        offset: state.offset,
      };

      const results = await searchService.search(query, searchOptions);

      set({
        conversations: results.conversations.map((r) => r.item),
        messages: results.messages.map((r) => r.item),
        totalResults: results.total,
        executionTime: results.executionTimeMs,
        isSearching: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isSearching: false,
      });
    }
  },

  // Clear search
  clearSearch: () => {
    set({
      query: '',
      conversations: [],
      messages: [],
      totalResults: 0,
      error: null,
      offset: 0,
      suggestions: [],
      showSuggestions: false,
    });
  },

  // Set single filter
  setFilter: (filter) => {
    const state = get();
    const newFilters = { ...state.filters, ...filter };
    set({ filters: newFilters, offset: 0 });

    // Re-search with new filters
    if (state.query) {
      state.search(state.query, { ...newFilters });
    }
  },

  // Clear all filters
  clearFilters: () => {
    set({ filters: {}, offset: 0 });
    const state = get();
    if (state.query) {
      state.search(state.query);
    }
  },

  // Set sort order
  setSortBy: (sortBy) => {
    set({ sortBy, offset: 0 });
    const state = get();
    if (state.query) {
      state.search(state.query);
    }
  },

  // Set result limit
  setLimit: (limit) => {
    set({ limit, offset: 0 });
  },

  // Set result offset
  setOffset: (offset) => {
    set({ offset });
    const state = get();
    if (state.query) {
      state.search(state.query);
    }
  },

  // Next page
  nextPage: async () => {
    const state = get();
    const newOffset = state.offset + state.limit;
    state.setOffset(newOffset);
  },

  // Previous page
  previousPage: async () => {
    const state = get();
    const newOffset = Math.max(0, state.offset - state.limit);
    state.setOffset(newOffset);
  },

  // Get suggestions
  getSuggestions: async (query) => {
    if (!query.trim()) {
      set({ suggestions: [], showSuggestions: false });
      return;
    }

    try {
      const suggestions = await searchService.getSuggestions(query, 10);
      set({ suggestions, showSuggestions: true });
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      set({ suggestions: [] });
    }
  },

  // Clear suggestions
  clearSuggestions: () => {
    set({ suggestions: [], showSuggestions: false });
  },

  // Load history
  loadHistory: () => {
    const history = searchService.getHistory(20);
    set({ history });
  },

  // Clear history
  clearHistory: () => {
    searchService.clearHistory();
    set({ history: [] });
  },

  // Search within conversation
  searchConversation: async (conversationId, query) => {
    const state = get();

    if (!query.trim()) {
      state.clearSearch();
      return;
    }

    try {
      set({ isSearching: true, error: null, query });

      const results = await searchService.searchConversation(conversationId, query);

      set({
        messages: results.messages.map((r) => r.item),
        conversations: results.conversations.map((r) => r.item),
        totalResults: results.total,
        executionTime: results.executionTimeMs,
        isSearching: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isSearching: false,
      });
    }
  },

  // Get trending searches
  getTrendingSearches: async () => {
    return searchService.getTrendingSearches(10);
  },
}));
