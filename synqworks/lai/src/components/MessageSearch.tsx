import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import type { ApiMessage as Message } from "../lib/api/types";

interface MessageSearchProps {
  messages: Message[];
  onMessageSelect?: (messageId: string) => void;
  className?: string;
}

export default function MessageSearch({
  messages,
  onMessageSelect,
  className = "",
}: MessageSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Find matching messages
  const matchingMessages = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    return messages
      .filter(
        (msg) =>
          msg.content.toLowerCase().includes(query) ||
          msg.role.toLowerCase().includes(query),
      )
      .map((msg, index) => ({
        ...msg,
        matchIndex: index,
        preview: getMessagePreview(msg.content, query),
      }));
  }, [messages, searchQuery]);

  // Reset match index when search changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery]);

  // Generate message preview with highlighted search term
  function getMessagePreview(content: string, query: string): string {
    const index = content.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return content.slice(0, 100) + "...";

    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 50);
    const preview = content.slice(start, end);

    return start > 0 ? "..." + preview : preview;
  }

  const handlePrevious = useCallback(() => {
    const len = matchingMessages.length;
    if (len === 0) return;

    setCurrentMatchIndex((prev) => {
      const newIndex = prev === 0 ? len - 1 : prev - 1;
      const message = matchingMessages[newIndex];
      onMessageSelect?.(message.id);
      return newIndex;
    });
  }, [matchingMessages, onMessageSelect]);

  const handleNext = useCallback(() => {
    const len = matchingMessages.length;
    if (len === 0) return;

    setCurrentMatchIndex((prev) => {
      const newIndex = prev === len - 1 ? 0 : prev + 1;
      const message = matchingMessages[newIndex];
      onMessageSelect?.(message.id);
      return newIndex;
    });
  }, [matchingMessages, onMessageSelect]);

  // Keyboard shortcut: Cmd/Ctrl + F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+F or Ctrl+F to open search
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setIsExpanded(true);
      }

      // Escape to close search
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
        setSearchQuery("");
      }

      // n/N for next/previous match when search is open and has focus
      if (isExpanded && matchingMessages.length > 0) {
        if (e.key === "n" && !e.shiftKey) {
          e.preventDefault();
          handleNext();
        }
        if (e.key === "N" || (e.key === "n" && e.shiftKey)) {
          e.preventDefault();
          handlePrevious();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, matchingMessages.length, handleNext, handlePrevious]);

  const handleClear = () => {
    setSearchQuery("");
    setCurrentMatchIndex(0);
  };

  const handleMessageClick = (message: Message & { matchIndex: number }) => {
    setCurrentMatchIndex(message.matchIndex);
    onMessageSelect?.(message.id);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`flex items-center space-x-2 px-3 py-2 text-sm bg-[#24283b] hover:bg-[#414868] text-[#c0caf5] border border-[#414868] rounded-lg transition-all duration-150 gpu-accelerated ${className}`}
        title="Search in conversation (Cmd+F)"
      >
        <Search className="h-4 w-4" />
        <span>Search messages</span>
        <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-[#1a1b26] border border-[#414868] rounded">
          ⌘F
        </kbd>
      </button>
    );
  }

  return (
    <div
      className={`bg-[#1a1b26] border border-[#414868] rounded-lg p-4 shadow-lg ${className} animate-in fade-in duration-150`}
    >
      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-3 h-4 w-4 text-[#565f89]" />
        <input
          type="text"
          placeholder="Search in this conversation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-24 py-2.5 text-sm border border-[#414868] rounded-lg bg-[#24283b] text-[#c0caf5] placeholder-[#565f89] focus:outline-none focus:ring-2 focus:ring-[#7aa2f7] focus:border-transparent transition-all duration-150"
          autoFocus
        />

        {/* Navigation Controls */}
        {matchingMessages.length > 0 && (
          <div className="absolute right-3 top-2 flex items-center space-x-2">
            <span className="text-xs text-[#9aa5ce] font-mono">
              {currentMatchIndex + 1}/{matchingMessages.length}
            </span>
            <div className="flex items-center bg-[#1a1b26] border border-[#414868] rounded">
              <button
                onClick={handlePrevious}
                className="p-1.5 text-[#9aa5ce] hover:text-[#c0caf5] hover:bg-[#24283b] transition-colors rounded-l"
                title="Previous match (Shift+N)"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <div className="w-px h-4 bg-[#414868]" />
              <button
                onClick={handleNext}
                className="p-1.5 text-[#9aa5ce] hover:text-[#c0caf5] hover:bg-[#24283b] transition-colors rounded-r"
                title="Next match (N)"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-3 text-[#565f89] hover:text-[#c0caf5] transition-colors"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Keyboard Shortcuts Hint */}
      {!searchQuery && (
        <div className="text-xs text-[#565f89] mb-3 flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 bg-[#24283b] border border-[#414868] rounded">
            ⌘F
          </kbd>
          <span>to search</span>
          <span>•</span>
          <kbd className="px-1.5 py-0.5 bg-[#24283b] border border-[#414868] rounded">
            N
          </kbd>
          <span>next</span>
          <span>•</span>
          <kbd className="px-1.5 py-0.5 bg-[#24283b] border border-[#414868] rounded">
            Esc
          </kbd>
          <span>close</span>
        </div>
      )}

      {/* Search Results */}
      {searchQuery && (
        <div className="space-y-2">
          {matchingMessages.length === 0 ? (
            <div className="text-sm text-[#565f89] text-center py-4">
              No messages found
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto smooth-scroll space-y-2 pr-1">
              {matchingMessages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => handleMessageClick(message)}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-all duration-150 gpu-accelerated ${currentMatchIndex === message.matchIndex
                      ? "bg-[#7aa2f7]/20 border-2 border-[#7aa2f7] shadow-md"
                      : "bg-[#24283b] hover:bg-[#414868] border border-[#414868]"
                    }`}
                >
                  <div className="font-medium text-xs text-[#9aa5ce] mb-1.5 uppercase tracking-wide">
                    {message.role === "user" ? "👤 You" : "🤖 Assistant"}
                  </div>
                  <div className="text-[#c0caf5] leading-relaxed line-clamp-2">
                    {message.preview}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collapse Button */}
      <button
        onClick={() => {
          setIsExpanded(false);
          setSearchQuery("");
        }}
        className="mt-4 w-full text-center text-xs text-[#565f89] hover:text-[#9aa5ce] transition-colors py-2 border-t border-[#414868]/50"
      >
        Collapse search (Esc)
      </button>
    </div>
  );
}
