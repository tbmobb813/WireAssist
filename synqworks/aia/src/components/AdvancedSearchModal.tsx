import React, { useState, useEffect } from "react";
import {
  database,
  type Conversation,
  type Message,
  type Tag,
} from "../lib/api/database";
import {
  Search,
  X,
  Calendar,
  MessageCircle,
  User,
  Bot,
  Save,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation?: (conversationId: string) => void;
  onSelectMessage?: (conversationId: string, messageId: string) => void;
}

interface SearchFilters {
  query: string;
  messageContent: string;
  dateRange: {
    start: string;
    end: string;
  };
  providers: string[];
  models: string[];
  tags: string[];
  messageRole: "all" | "user" | "assistant";
  sortBy: "relevance" | "date" | "title";
  sortOrder: "asc" | "desc";
}

interface SearchResult {
  conversation: Conversation;
  messages: (Message & { snippet?: string; highlights?: string[] })[];
  matchCount: number;
  relevanceScore: number;
}

interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilters;
  created_at: number;
}

export const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectConversation,
  onSelectMessage,
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    messageContent: "",
    dateRange: { start: "", end: "" },
    providers: [],
    models: [],
    tags: [],
    messageRole: "all",
    sortBy: "relevance",
    sortOrder: "desc",
  });

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    advanced: false,
    saved: false,
  });

  // Available providers and models (could be fetched dynamically)
  // const availableProviders = ['openai', 'anthropic', 'google', 'ollama', 'local'];
  // const availableModels = {
  //   openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  //   anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  //   google: ['gemini-pro', 'gemini-pro-vision'],
  //   ollama: ['llama2', 'codellama', 'mistral'],
  //   local: ['local-model'],
  // };    // Load initial data
  useEffect(() => {
    if (isOpen) {
      loadTags();
      loadSavedSearches();
    }
  }, [isOpen]);

  const loadTags = async () => {
    try {
      const tags = await database.tags.getAll();
      setAvailableTags(tags);
    } catch (err) {
      console.error("Failed to load tags:", err);
    }
  };

  const loadSavedSearches = async () => {
    try {
      // For now, use localStorage. Could be moved to database later
      const saved = localStorage.getItem("savedSearches");
      if (saved) {
        try {
          setSavedSearches(JSON.parse(saved));
        } catch (parseErr) {
          console.error("Corrupted saved searches in localStorage:", parseErr);
          setSavedSearches([]);
        }
      }
    } catch (err) {
      console.error("Failed to load saved searches:", err);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (filters.query.trim() || filters.messageContent.trim()) {
        performSearch();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filters]);

  const performSearch = async () => {
    setLoading(true);
    setError(null);

    try {
      let conversations: Conversation[] = [];
      let messages: Message[] = [];

      // Search conversations by title if query is provided
      if (filters.query.trim()) {
        conversations = await database.conversations.search(filters.query, 100);
      } else {
        conversations = await database.conversations.getAll(100);
      }

      // Search messages if message content filter is provided
      if (filters.messageContent.trim()) {
        messages = await database.messages.search(filters.messageContent, 200);
      }

      // Apply filters and build results
      const searchResults = await buildSearchResults(conversations, messages);
      setResults(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const buildSearchResults = async (
    conversations: Conversation[],
    messages: Message[],
  ): Promise<SearchResult[]> => {
    const resultsMap = new Map<string, SearchResult>();

    // Process conversation matches
    for (const conv of conversations) {
      if (!matchesFilters(conv)) continue;

      if (!resultsMap.has(conv.id)) {
        resultsMap.set(conv.id, {
          conversation: conv,
          messages: [],
          matchCount: 0,
          relevanceScore: 0,
        });
      }

      const result = resultsMap.get(conv.id)!;
      result.matchCount += 1;
      result.relevanceScore += calculateRelevanceScore(conv, filters.query);
    }

    // Process message matches
    const messagesByConversation = new Map<string, Message[]>();
    for (const msg of messages) {
      if (filters.messageRole !== "all" && msg.role !== filters.messageRole)
        continue;

      if (!messagesByConversation.has(msg.conversation_id)) {
        messagesByConversation.set(msg.conversation_id, []);
      }
      messagesByConversation.get(msg.conversation_id)!.push(msg);
    }

    for (const [convId, msgs] of messagesByConversation) {
      // Get conversation details if not already in results
      if (!resultsMap.has(convId)) {
        try {
          const conv = await database.conversations.get(convId);
          if (!conv || !matchesFilters(conv)) continue;

          resultsMap.set(convId, {
            conversation: conv,
            messages: [],
            matchCount: 0,
            relevanceScore: 0,
          });
        } catch {
          continue;
        }
      }

      const result = resultsMap.get(convId)!;
      result.messages = msgs.map((msg) => ({
        ...msg,
        snippet: generateSnippet(msg.content, filters.messageContent),
        highlights: extractHighlights(msg.content, filters.messageContent),
      }));
      result.matchCount += msgs.length;
      result.relevanceScore += msgs.reduce(
        (acc, msg) =>
          acc + calculateMessageRelevanceScore(msg, filters.messageContent),
        0,
      );
    }

    // Apply tag filters
    if (filters.tags.length > 0) {
      const filteredResults: SearchResult[] = [];
      for (const result of resultsMap.values()) {
        try {
          const convTags = await database.tags.getForConversation(
            result.conversation.id,
          );
          const tagIds = convTags.map((tag) => tag.id);
          const hasMatchingTag = filters.tags.some((tagId) =>
            tagIds.includes(tagId),
          );
          if (hasMatchingTag) {
            filteredResults.push(result);
          }
        } catch {
          // Skip if tag lookup fails
        }
      }
      return sortResults(filteredResults);
    }

    return sortResults(Array.from(resultsMap.values()));
  };

  const matchesFilters = (conversation: Conversation): boolean => {
    // Date range filter
    if (
      filters.dateRange.start &&
      new Date(conversation.created_at) < new Date(filters.dateRange.start)
    ) {
      return false;
    }
    if (
      filters.dateRange.end &&
      new Date(conversation.created_at) > new Date(filters.dateRange.end)
    ) {
      return false;
    }

    // Provider filter
    if (
      filters.providers.length > 0 &&
      !filters.providers.includes(conversation.provider)
    ) {
      return false;
    }

    // Model filter
    if (
      filters.models.length > 0 &&
      !filters.models.includes(conversation.model)
    ) {
      return false;
    }

    return true;
  };

  const calculateRelevanceScore = (
    conversation: Conversation,
    query: string,
  ): number => {
    if (!query.trim()) return 1;

    const title = conversation.title.toLowerCase();
    const queryLower = query.toLowerCase();

    if (title.includes(queryLower)) {
      return title.indexOf(queryLower) === 0 ? 3 : 2; // Boost for title matches
    }

    return 1;
  };

  const calculateMessageRelevanceScore = (
    message: Message,
    query: string,
  ): number => {
    if (!query.trim()) return 1;

    const content = message.content.toLowerCase();
    const queryLower = query.toLowerCase();
    const matches = (content.match(new RegExp(queryLower, "g")) || []).length;

    return matches * (message.role === "user" ? 1.2 : 1); // Slight boost for user messages
  };

  const generateSnippet = (content: string, query: string): string => {
    if (!query.trim()) return content.slice(0, 150) + "...";

    const index = content.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return content.slice(0, 150) + "...";

    const start = Math.max(0, index - 75);
    const end = Math.min(content.length, index + query.length + 75);
    const snippet = content.slice(start, end);

    return (
      (start > 0 ? "..." : "") + snippet + (end < content.length ? "..." : "")
    );
  };

  const extractHighlights = (content: string, query: string): string[] => {
    if (!query.trim()) return [];

    const regex = new RegExp(`(${query})`, "gi");
    return content.match(regex) || [];
  };

  const sortResults = (results: SearchResult[]): SearchResult[] => {
    return results.sort((a, b) => {
      switch (filters.sortBy) {
        case "relevance":
          return filters.sortOrder === "desc"
            ? b.relevanceScore - a.relevanceScore
            : a.relevanceScore - b.relevanceScore;
        case "date":
          return filters.sortOrder === "desc"
            ? b.conversation.updated_at - a.conversation.updated_at
            : a.conversation.updated_at - b.conversation.updated_at;
        case "title":
          return filters.sortOrder === "desc"
            ? b.conversation.title.localeCompare(a.conversation.title)
            : a.conversation.title.localeCompare(b.conversation.title);
        default:
          return 0;
      }
    });
  };

  const handleSaveSearch = async () => {
    if (!saveSearchName.trim()) return;

    const savedSearch: SavedSearch = {
      id: Date.now().toString(),
      name: saveSearchName,
      filters: { ...filters },
      created_at: Date.now(),
    };

    const updated = [...savedSearches, savedSearch];
    setSavedSearches(updated);
    localStorage.setItem("savedSearches", JSON.stringify(updated));

    setSaveSearchName("");
    setShowSaveDialog(false);
  };

  const loadSavedSearch = (search: SavedSearch) => {
    setFilters(search.filters);
    setExpandedSections({ ...expandedSections, saved: false });
  };

  const deleteSavedSearch = (searchId: string) => {
    const updated = savedSearches.filter((s) => s.id !== searchId);
    setSavedSearches(updated);
    localStorage.setItem("savedSearches", JSON.stringify(updated));
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section],
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1b26] rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex border border-[#414868]">
        {/* Filters Panel */}
        <div className="w-80 border-r border-[#414868] p-6 overflow-y-auto bg-[#1a1b26]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[#c0caf5]">
              Advanced Search
            </h2>
            <button
              onClick={onClose}
              className="text-[#565f89] hover:text-[#c0caf5] transition-colors duration-150"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Basic Search */}
          <div className="space-y-4">
            <button
              onClick={() => toggleSection("basic")}
              className="flex items-center justify-between w-full text-left text-[#c0caf5] hover:text-[#7aa2f7] transition-colors duration-150"
            >
              <h3 className="font-medium">Basic Search</h3>
              {expandedSections.basic ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {expandedSections.basic && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-[#9aa5ce] mb-1">
                    Conversation Title
                  </label>
                  <input
                    type="text"
                    value={filters.query}
                    onChange={(e) =>
                      setFilters({ ...filters, query: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#414868] rounded-lg bg-[#24283b] text-[#c0caf5] placeholder-[#565f89] focus:outline-none focus:ring-2 focus:ring-[#7aa2f7] focus:border-transparent transition-all duration-150"
                    placeholder="Search in conversation titles..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#9aa5ce] mb-1">
                    Message Content
                  </label>
                  <input
                    type="text"
                    value={filters.messageContent}
                    onChange={(e) =>
                      setFilters({ ...filters, messageContent: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#414868] rounded-lg bg-[#24283b] text-[#c0caf5] placeholder-[#565f89] focus:outline-none focus:ring-2 focus:ring-[#7aa2f7] focus:border-transparent transition-all duration-150"
                    placeholder="Search in message content..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Advanced Filters */}
          <div className="space-y-4 mt-6">
            <button
              onClick={() => toggleSection("advanced")}
              className="flex items-center justify-between w-full text-left text-[#c0caf5] hover:text-[#7aa2f7] transition-colors duration-150"
            >
              <h3 className="font-medium">Advanced Filters</h3>
              {expandedSections.advanced ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {expandedSections.advanced && (
              <div className="space-y-4">
                {/* Date Range */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-[#9aa5ce] mb-1">
                      From
                    </label>
                    <input
                      type="date"
                      value={filters.dateRange.start}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          dateRange: {
                            ...filters.dateRange,
                            start: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-[#414868] rounded-lg bg-[#24283b] text-[#c0caf5] focus:outline-none focus:ring-2 focus:ring-[#7aa2f7] focus:border-transparent transition-all duration-150"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#9aa5ce] mb-1">
                      To
                    </label>
                    <input
                      type="date"
                      value={filters.dateRange.end}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          dateRange: {
                            ...filters.dateRange,
                            end: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-[#414868] rounded-lg bg-[#24283b] text-[#c0caf5] focus:outline-none focus:ring-2 focus:ring-[#7aa2f7] focus:border-transparent transition-all duration-150"
                    />
                  </div>
                </div>

                {/* Message Role */}
                <div>
                  <label className="block text-sm font-medium text-[#9aa5ce] mb-1">
                    Message Type
                  </label>
                  <select
                    value={filters.messageRole}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        messageRole: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 border border-[#414868] rounded-lg bg-[#24283b] text-[#c0caf5] focus:outline-none focus:ring-2 focus:ring-[#7aa2f7] focus:border-transparent transition-all duration-150"
                  >
                    <option value="all">All messages</option>
                    <option value="user">User messages</option>
                    <option value="assistant">Assistant messages</option>
                  </select>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-[#9aa5ce] mb-1">
                    Tags
                  </label>
                  <div className="max-h-32 overflow-y-auto border border-[#414868] rounded-lg p-2 bg-[#24283b]">
                    {availableTags.map((tag) => (
                      <label
                        key={tag.id}
                        className="flex items-center space-x-2 py-1 text-[#c0caf5] hover:text-[#7aa2f7] transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={filters.tags.includes(tag.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilters({
                                ...filters,
                                tags: [...filters.tags, tag.id],
                              });
                            } else {
                              setFilters({
                                ...filters,
                                tags: filters.tags.filter((t) => t !== tag.id),
                              });
                            }
                          }}
                          className="rounded bg-[#414868] border-[#565f89] text-[#7aa2f7] focus:ring-[#7aa2f7] focus:ring-offset-[#24283b]"
                        />
                        <span className="text-sm">{tag.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sort Options */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-[#9aa5ce] mb-1">
                      Sort by
                    </label>
                    <select
                      value={filters.sortBy}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          sortBy: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 border border-[#414868] rounded-lg bg-[#24283b] text-[#c0caf5] focus:outline-none focus:ring-2 focus:ring-[#7aa2f7] focus:border-transparent transition-all duration-150"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="date">Date</option>
                      <option value="title">Title</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#9aa5ce] mb-1">
                      Order
                    </label>
                    <select
                      value={filters.sortOrder}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          sortOrder: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 border border-[#414868] rounded-lg bg-[#24283b] text-[#c0caf5] focus:outline-none focus:ring-2 focus:ring-[#7aa2f7] focus:border-transparent transition-all duration-150"
                    >
                      <option value="desc">Descending</option>
                      <option value="asc">Ascending</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Save Search */}
          <div className="mt-6">
            <button
              onClick={() => setShowSaveDialog(!showSaveDialog)}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-[#7aa2f7] text-[#1a1b26] rounded-lg hover:bg-[#7aa2f7]/80 transition-all duration-150 font-medium"
            >
              <Save className="h-4 w-4" />
              <span>Save Search</span>
            </button>

            {showSaveDialog && (
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                  placeholder="Search name..."
                  className="w-full px-3 py-2 border border-[#414868] rounded-lg bg-[#24283b] text-[#c0caf5] placeholder-[#565f89] focus:outline-none focus:ring-2 focus:ring-[#7aa2f7] focus:border-transparent transition-all duration-150"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleSaveSearch}
                    disabled={!saveSearchName.trim()}
                    className="flex-1 px-3 py-1 bg-[#9ece6a] text-[#1a1b26] rounded-lg hover:bg-[#9ece6a]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowSaveDialog(false)}
                    className="flex-1 px-3 py-1 bg-[#414868] text-[#c0caf5] rounded-lg hover:bg-[#565f89] transition-all duration-150 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Saved Searches */}
          {savedSearches.length > 0 && (
            <div className="space-y-4 mt-6">
              <button
                onClick={() => toggleSection("saved")}
                className="flex items-center justify-between w-full text-left text-[#c0caf5] hover:text-[#7aa2f7] transition-colors duration-150"
              >
                <h3 className="font-medium">Saved Searches</h3>
                {expandedSections.saved ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              {expandedSections.saved && (
                <div className="space-y-2">
                  {savedSearches.map((search) => (
                    <div
                      key={search.id}
                      className="flex items-center justify-between p-2 bg-[#24283b] hover:bg-[#414868]/30 rounded-lg transition-all duration-150 border border-[#414868]"
                    >
                      <button
                        onClick={() => loadSavedSearch(search)}
                        className="flex-1 text-left text-sm text-[#c0caf5] hover:text-[#7aa2f7] transition-colors"
                      >
                        {search.name}
                      </button>
                      <button
                        onClick={() => deleteSavedSearch(search.id)}
                        className="text-[#f7768e] hover:text-[#f7768e]/80 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="flex-1 p-6 overflow-y-auto bg-[#1a1b26]">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7aa2f7]"></div>
              <span className="ml-2 text-[#9aa5ce]">Searching...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-[#f7768e]/10 border border-[#f7768e]/30 rounded-lg">
              <p className="text-[#f7768e]">{error}</p>
            </div>
          )}

          {!loading &&
            !error &&
            results.length === 0 &&
            (filters.query || filters.messageContent) && (
              <div className="text-center py-8 text-[#565f89]">
                <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-[#9aa5ce]">No results found</p>
                <p className="text-sm">Try adjusting your search criteria</p>
              </div>
            )}

          {!loading &&
            !error &&
            results.length === 0 &&
            !filters.query &&
            !filters.messageContent && (
              <div className="text-center py-8 text-[#565f89]">
                <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-[#9aa5ce]">
                  Enter a search query to get started
                </p>
              </div>
            )}

          {!loading && !error && results.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[#c0caf5]">
                  Search Results ({results.length})
                </h3>
              </div>

              <div className="space-y-4">
                {results.map((result) => (
                  <div
                    key={result.conversation.id}
                    className="border border-[#414868] rounded-lg p-4 hover:bg-[#24283b] hover:shadow-md transition-all duration-150"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <button
                        onClick={() =>
                          onSelectConversation?.(result.conversation.id)
                        }
                        className="text-left flex-1"
                      >
                        <h4 className="font-medium text-[#c0caf5] hover:text-[#7aa2f7] transition-colors">
                          {result.conversation.title}
                        </h4>
                        <div className="flex items-center space-x-3 text-xs text-[#565f89] mt-1">
                          <span className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {new Date(
                                result.conversation.created_at,
                              ).toLocaleDateString()}
                            </span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <MessageCircle className="h-3 w-3" />
                            <span>{result.matchCount} matches</span>
                          </span>
                          <span>
                            {result.conversation.provider} /{" "}
                            {result.conversation.model}
                          </span>
                        </div>
                      </button>
                    </div>

                    {/* Message matches */}
                    {result.messages.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {result.messages.slice(0, 3).map((message) => (
                          <button
                            key={message.id}
                            onClick={() =>
                              onSelectMessage?.(
                                result.conversation.id,
                                message.id,
                              )
                            }
                            className="w-full text-left p-2 bg-[#24283b] rounded border border-[#414868] hover:bg-[#414868]/30 transition-all duration-150"
                          >
                            <div className="flex items-center space-x-2 mb-1">
                              {message.role === "user" ? (
                                <User className="h-3 w-3 text-[#7aa2f7]" />
                              ) : (
                                <Bot className="h-3 w-3 text-[#9ece6a]" />
                              )}
                              <span className="text-xs font-medium text-[#9aa5ce]">
                                {message.role === "user" ? "You" : "Assistant"}
                              </span>
                            </div>
                            <p className="text-sm text-[#c0caf5]">
                              {message.snippet ||
                                message.content.slice(0, 200) + "..."}
                            </p>
                          </button>
                        ))}
                        {result.messages.length > 3 && (
                          <p className="text-xs text-[#565f89] text-center">
                            +{result.messages.length - 3} more messages
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
