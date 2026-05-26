import React, { useState } from "react";
import { X, Search, File, FolderOpen } from "lucide-react";
import { invokeSafe, isTauriEnvironment } from "../lib/utils/tauri";
import { useUiStore } from "../lib/stores/uiStore";
import type { SearchResult, FileMatch } from "../lib/api/types";

interface DocumentSearchModalProps {
  onClose: () => void;
}

export default function DocumentSearchModal({
  onClose,
}: DocumentSearchModalProps) {
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const addToast = useUiStore((s) => s.addToast);

  const handleSearch = async () => {
    if (!query.trim()) {
      addToast({
        message: "Please enter a search query",
        type: "error",
        ttl: 3000,
      });
      return;
    }

    setIsSearching(true);
    try {
      if (isTauriEnvironment()) {
        const result = await invokeSafe<SearchResult>("search_project_files", {
          query: query.trim(),
          case_sensitive: caseSensitive,
          max_results: 50,
        });

        if (result) {
          setSearchResult(result);
          addToast({
            message: `Found ${result.matches.length} results in ${result.search_time_ms}ms`,
            type: "success",
            ttl: 3000,
          });
        } else {
          addToast({
            message: "Search failed - please check project is set",
            type: "error",
            ttl: 3000,
          });
        }
      } else {
        addToast({
          message: "Document search requires desktop app",
          type: "error",
          ttl: 3000,
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      addToast({
        message: "Search failed",
        type: "error",
        ttl: 3000,
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSearching) {
      handleSearch();
    }
  };

  const renderFileMatch = (match: FileMatch, index: number) => {
    const fileName = match.path.split("/").pop() || match.path;
    const isContentMatch = match.line_number && match.line_content;

    return (
      <div
        key={`${match.path}-${match.line_number || index}`}
        className="p-3 border border-[#414868] rounded-lg hover:bg-[#24283b] transition-all duration-150"
      >
        <div className="flex items-start gap-2">
          <div className="mt-1">
            {isContentMatch ? (
              <File className="w-4 h-4 text-[#7aa2f7]" />
            ) : (
              <FolderOpen className="w-4 h-4 text-[#9ece6a]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-[#c0caf5] truncate">
                {fileName}
              </span>
              {isContentMatch && (
                <span className="text-xs text-[#9aa5ce]">
                  line {match.line_number}
                </span>
              )}
              <span className="text-xs px-2 py-1 bg-[#414868] rounded text-[#c0caf5]">
                {match.file_type}
              </span>
            </div>
            <div className="text-xs text-[#565f89] mb-2 font-mono truncate">
              {match.path}
            </div>
            {isContentMatch && (
              <div className="bg-[#1a1b26] rounded p-2 text-sm font-mono">
                <code className="text-[#c0caf5]">{match.line_content}</code>
              </div>
            )}
          </div>
          <div className="text-xs text-[#565f89] mt-1">
            {Math.round(match.score * 100)}%
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1b26] rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-[#414868]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#414868]">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-[#7aa2f7]" />
            <h2 className="text-lg font-semibold text-[#c0caf5]">
              Document Search
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#9aa5ce] hover:text-[#c0caf5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-6 border-b border-[#414868]">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Search for files and content..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 px-4 py-2 border border-[#414868] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7aa2f7]/50 bg-[#24283b] text-[#c0caf5] placeholder-[#565f89] transition-all duration-150"
              disabled={isSearching}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              className="px-6 py-2 bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 disabled:opacity-50 disabled:cursor-not-allowed text-[#1a1b26] rounded-lg flex items-center gap-2 font-medium transition-all duration-150"
            >
              <Search className="w-4 h-4" />
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <label className="flex items-center gap-2 text-sm text-[#9aa5ce]">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="rounded"
              />
              Case sensitive
            </label>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {searchResult ? (
            <div className="p-6">
              <div className="mb-4 text-sm text-[#9aa5ce]">
                Found {searchResult.matches.length} matches in{" "}
                {searchResult.total_files_searched} files (
                {searchResult.search_time_ms}ms)
              </div>
              {searchResult.matches.length > 0 ? (
                <div className="space-y-3">
                  {searchResult.matches.map((match, index) =>
                    renderFileMatch(match, index),
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-[#9aa5ce]">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No matches found for "{searchResult.query}"</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-[#9aa5ce]">
              <div className="text-center">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Enter a search query to find files and content</p>
                <p className="text-sm mt-2">
                  Supports searching filenames and file contents
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
