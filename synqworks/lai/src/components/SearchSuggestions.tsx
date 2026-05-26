import React, { useState, useEffect, useCallback } from "react";
import { database, type Conversation, type Tag } from "../lib/api/database";
import { Search, Clock, Hash, MessageCircle, Sparkles } from "lucide-react";

interface SearchSuggestionsProps {
  query: string;
  onSuggestionSelect: (suggestion: SearchSuggestion) => void;
  className?: string;
}
interface SearchSuggestion {
  type: "recent" | "tag" | "conversation" | "template" | "command";
  text: string;
  description?: string;
  data?: any;
  icon?: React.ReactNode;
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  query,
  onSuggestionSelect,
  className = "",
}) => {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [recentConversations, setRecentConversations] = useState<
    Conversation[]
  >([]);
  const [loading, setLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);



  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Load recent searches from localStorage
      const stored = localStorage.getItem("recentSearches");
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }

      // Load tags and recent conversations
      const [tags, conversations] = await Promise.all([
        database.tags.getAll(),
        database.conversations.getAll(10), // Get 10 most recent
      ]);

      setAvailableTags(tags);
      setRecentConversations(conversations);
    } catch (err) {
      console.error("Failed to load search data:", err);
    } finally {
      setLoading(false);
    }
  };



  const addRecentSearchSuggestions = useCallback((suggestions: SearchSuggestion[]) => {
    recentSearches.slice(0, 3).forEach((search) => {
      suggestions.push({
        type: "recent",
        text: search,
        description: "Recent search",
        icon: <Clock className="h-4 w-4 text-gray-400" />,
      });
    });
  }, [recentSearches]);

  const addPopularTagSuggestions = useCallback((suggestions: SearchSuggestion[]) => {
    availableTags.slice(0, 3).forEach((tag) => {
      suggestions.push({
        type: "tag",
        text: `tag:${tag.name}`,
        description: "Search by tag",
        data: tag,
        icon: <Hash className="h-4 w-4 text-blue-500" />,
      });
    });
  }, [availableTags]);

  const addRecentConversationSuggestions = useCallback((
    suggestions: SearchSuggestion[],
  ) => {
    recentConversations.slice(0, 2).forEach((conv) => {
      suggestions.push({
        type: "conversation",
        text: conv.title,
        description: `${conv.provider} • ${new Date(conv.updated_at).toLocaleDateString()}`,
        data: conv,
        icon: <MessageCircle className="h-4 w-4 text-green-500" />,
      });
    });
  }, [recentConversations]);

  const addSearchTemplates = useCallback((suggestions: SearchSuggestion[]) => {
    const templates = [
      { text: "last week", description: "Conversations from last week" },
      { text: "today", description: "Today's conversations" },
      { text: "python code", description: "Messages about Python" },
    ];

    templates.forEach((template) => {
      suggestions.push({
        type: "template",
        text: template.text,
        description: template.description,
        icon: <Sparkles className="h-4 w-4 text-purple-500" />,
      });
    });
  }, []);

  const addMatchingConversations = useCallback((
    suggestions: SearchSuggestion[],
    q: string,
  ) => {
    const matching = recentConversations
      .filter((conv) => conv.title.toLowerCase().includes(q))
      .slice(0, 3);

    matching.forEach((conv) => {
      suggestions.push({
        type: "conversation",
        text: conv.title,
        description: `Open conversation • ${conv.provider}`,
        data: conv,
        icon: <MessageCircle className="h-4 w-4 text-green-500" />,
      });
    });
  }, [recentConversations]);

  const addMatchingTags = useCallback((suggestions: SearchSuggestion[], q: string) => {
    const matching = availableTags
      .filter((tag) => tag.name.toLowerCase().includes(q))
      .slice(0, 3);

    matching.forEach((tag) => {
      suggestions.push({
        type: "tag",
        text: `tag:${tag.name}`,
        description: "Filter by tag",
        data: tag,
        icon: <Hash className="h-4 w-4 text-blue-500" />,
      });
    });
  }, [availableTags]);

  const addSearchCommands = useCallback((
    suggestions: SearchSuggestion[],
    q: string,
  ) => {
    const commands = [
      {
        cmd: "from:",
        desc: "Search messages from user or assistant",
        example: "from:user",
      },
      { cmd: "model:", desc: "Filter by AI model", example: "model:gpt-4" },
      {
        cmd: "provider:",
        desc: "Filter by provider",
        example: "provider:openai",
      },
      {
        cmd: "after:",
        desc: "Messages after date",
        example: "after:2024-01-01",
      },
      {
        cmd: "before:",
        desc: "Messages before date",
        example: "before:2024-12-31",
      },
      { cmd: "has:", desc: "Has attachments or code", example: "has:code" },
    ];

    const matching = commands.filter(
      (cmd) => cmd.cmd.startsWith(q) || q.startsWith(cmd.cmd),
    );

    matching.forEach((cmd) => {
      suggestions.push({
        type: "command",
        text: cmd.example,
        description: cmd.desc,
        icon: <Search className="h-4 w-4 text-orange-500" />,
      });
    });
  }, []);

  const addFilterSuggestions = useCallback((
    suggestions: SearchSuggestion[],
    q: string,
  ) => {
    const filters = [
      { text: "error", desc: "Messages containing errors" },
      { text: "code", desc: "Messages with code blocks" },
      { text: "function", desc: "Messages about functions" },
      { text: "debug", desc: "Debugging conversations" },
      { text: "review", desc: "Code review discussions" },
    ];

    const matching = filters.filter(
      (filter) => filter.text.includes(q) && filter.text !== q,
    );

    matching.forEach((filter) => {
      suggestions.push({
        type: "template",
        text: filter.text,
        description: filter.desc,
        icon: <Sparkles className="h-4 w-4 text-purple-500" />,
      });
    });
  }, []);

  // Generate suggestions when query changes
  const generateSuggestions = useCallback(() => {
    const newSuggestions: SearchSuggestion[] = [];
    const queryLower = query.toLowerCase().trim();

    if (!queryLower) {
      // Show recent searches and popular items when no query
      addRecentSearchSuggestions(newSuggestions);
      addPopularTagSuggestions(newSuggestions);
      addRecentConversationSuggestions(newSuggestions);
      addSearchTemplates(newSuggestions);
    } else {
      // Filter and rank suggestions based on query
      addMatchingConversations(newSuggestions, queryLower);
      addMatchingTags(newSuggestions, queryLower);
      addSearchCommands(newSuggestions, queryLower);
      addFilterSuggestions(newSuggestions, queryLower);
    }

    setSuggestions(newSuggestions.slice(0, 8)); // Limit to 8 suggestions
  }, [
    query,
    addRecentSearchSuggestions,
    addPopularTagSuggestions,
    addRecentConversationSuggestions,
    addSearchTemplates,
    addMatchingConversations,
    addMatchingTags,
    addSearchCommands,
    addFilterSuggestions,
  ]);

  useEffect(() => {
    generateSuggestions();
  }, [generateSuggestions]);

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    // Store in recent searches if it's a search query
    if (
      suggestion.type !== "conversation" &&
      !suggestion.text.startsWith("tag:")
    ) {
      const updated = [
        suggestion.text,
        ...recentSearches.filter((s) => s !== suggestion.text),
      ].slice(0, 10);
      setRecentSearches(updated);
      localStorage.setItem("recentSearches", JSON.stringify(updated));
    }

    onSuggestionSelect(suggestion);
  };

  if (loading) {
    return (
      <div
        className={`absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-3 ${className}`}
      >
        <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span className="text-sm">Loading suggestions...</span>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className={`absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 mt-1 ${className}`}
    >
      <div className="max-h-64 overflow-y-auto">
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion.type}-${index}`}
            onClick={() => handleSuggestionClick(suggestion)}
            className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
          >
            <div className="flex-shrink-0">{suggestion.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {suggestion.text}
              </div>
              {suggestion.description && (
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {suggestion.description}
                </div>
              )}
            </div>
            <div className="flex-shrink-0">
              <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                {suggestion.type}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Footer with tip */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium">Tip:</span> Use commands like{" "}
          <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
            tag:name
          </code>{" "}
          or{" "}
          <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
            from:user
          </code>{" "}
          for advanced filtering
        </div>
      </div>
    </div>
  );
};
