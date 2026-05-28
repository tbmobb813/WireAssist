import { useState, useEffect, useRef } from "react";
import { database } from "../lib/api/database";
import type { Tag } from "../lib/api/database";

interface TagInputProps {
  conversationId: string;
  initialTags?: Tag[];
  onTagsChange?: (tags: Tag[]) => void;
  placeholder?: string;
  className?: string;
}

export default function TagInput({
  conversationId,
  initialTags = [],
  onTagsChange,
  placeholder = "Add tags...",
  className = "",
}: TagInputProps) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load existing tags for the conversation
  useEffect(() => {
    const loadTags = async () => {
      try {
        const conversationTags =
          await database.tags.getForConversation(conversationId);
        setTags(conversationTags);
        onTagsChange?.(conversationTags);
      } catch (error) {
        console.error("Failed to load conversation tags:", error);
      }
    };

    if (conversationId) {
      loadTags();
    }
  }, [conversationId, onTagsChange]);

  // Search for tag suggestions
  useEffect(() => {
    const searchTags = async () => {
      if (inputValue.trim().length < 1) {
        setSuggestions([]);
        return;
      }

      try {
        const allTags = await database.tags.search(inputValue);
        // Filter out already selected tags
        const filteredTags = allTags.filter(
          (tag) => !tags.some((existingTag) => existingTag.id === tag.id),
        );
        setSuggestions(filteredTags);
      } catch (error) {
        console.error("Failed to search tags:", error);
        setSuggestions([]);
      }
    };

    const debounceTimer = setTimeout(searchTags, 200);
    return () => clearTimeout(debounceTimer);
  }, [inputValue, tags]);

  const addTag = async (tagName: string) => {
    if (!tagName.trim() || isLoading) return;

    setIsLoading(true);
    try {
      // Create or get the tag
      const tag = await database.tags.createOrGet(tagName.trim());

      // Add to conversation if not already added
      if (!tags.some((t) => t.id === tag.id)) {
        await database.tags.addToConversation(conversationId, tag.id);
        const newTags = [...tags, tag];
        setTags(newTags);
        onTagsChange?.(newTags);
      }

      setInputValue("");
      setShowSuggestions(false);
    } catch (error) {
      console.error("Failed to add tag:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const removeTag = async (tagId: string) => {
    try {
      await database.tags.removeFromConversation(conversationId, tagId);
      const newTags = tags.filter((tag) => tag.id !== tagId);
      setTags(newTags);
      onTagsChange?.(newTags);
    } catch (error) {
      console.error("Failed to remove tag:", error);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0) {
        addTag(suggestions[0].name);
      } else if (inputValue.trim()) {
        addTag(inputValue.trim());
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      // Remove last tag if input is empty and backspace is pressed
      const lastTag = tags[tags.length - 1];
      removeTag(lastTag.id);
    }
  };

  const getTagColor = (color?: string) => {
    if (color) return color;
    // Generate a color based on tag name hash
    const hash = Array.from(color || "default").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
    const colors = [
      "bg-[#7aa2f7]/20 text-[#7aa2f7] border border-[#7aa2f7]/30",
      "bg-[#9ece6a]/20 text-[#9ece6a] border border-[#9ece6a]/30",
      "bg-[#e0af68]/20 text-[#e0af68] border border-[#e0af68]/30",
      "bg-[#f7768e]/20 text-[#f7768e] border border-[#f7768e]/30",
      "bg-[#bb9af7]/20 text-[#bb9af7] border border-[#bb9af7]/30",
      "bg-[#ff9e64]/20 text-[#ff9e64] border border-[#ff9e64]/30",
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex flex-wrap items-center gap-1 p-2 border border-[#414868] rounded-md bg-[#24283b] min-h-10">
        {/* Existing tags */}
        {tags.map((tag) => (
          <span
            key={tag.id}
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTagColor(tag.color)}`}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => removeTag(tag.id)}
              className="ml-1 text-current hover:text-[#f7768e] focus:outline-none transition-colors"
              aria-label={`Remove tag ${tag.name}`}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </span>
        ))}

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
          }}
          onKeyDown={handleInputKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            // Delay hiding to allow clicking on suggestions
            setTimeout(() => setShowSuggestions(false), 150);
          }}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-20 bg-transparent border-none outline-none text-[#c0caf5] placeholder-[#565f89]"
          disabled={isLoading}
        />

        {isLoading && (
          <div className="animate-spin h-4 w-4 border-2 border-[#414868] border-t-[#7aa2f7] rounded-full"></div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (inputValue.trim() || suggestions.length > 0) && (
        <div
          ref={suggestionsRef}
          className="absolute z-10 w-full mt-1 bg-[#1a1b26] border border-[#414868] rounded-md shadow-lg max-h-40 overflow-auto"
        >
          {/* Create new tag option */}
          {inputValue.trim() &&
            !suggestions.some(
              (tag) => tag.name.toLowerCase() === inputValue.toLowerCase(),
            ) && (
              <button
                type="button"
                onClick={() => addTag(inputValue.trim())}
                className="w-full px-3 py-2 text-left hover:bg-[#24283b] border-b border-[#414868] transition-colors"
              >
                <span className="text-[#9aa5ce]">Create: </span>
                <span className="font-medium text-[#c0caf5]">
                  "{inputValue.trim()}"
                </span>
              </button>
            )}

          {/* Existing tag suggestions */}
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => addTag(tag.name)}
              className="w-full px-3 py-2 text-left hover:bg-[#24283b] text-[#c0caf5] transition-colors"
            >
              {tag.name}
            </button>
          ))}

          {suggestions.length === 0 && inputValue.trim() && (
            <div className="px-3 py-2 text-[#565f89] text-sm">
              No existing tags found. Press Enter to create "{inputValue.trim()}
              "
            </div>
          )}
        </div>
      )}
    </div>
  );
}
