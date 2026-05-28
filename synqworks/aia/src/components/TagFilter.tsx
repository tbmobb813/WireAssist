import { useState, useEffect } from "react";
import { database } from "../lib/api/database";
import type { Tag } from "../lib/api/database";

interface TagFilterProps {
  selectedTags: string[];
  onTagsChange: (tagIds: string[]) => void;
  className?: string;
}

export default function TagFilter({
  selectedTags,
  onTagsChange,
  className = "",
}: TagFilterProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Load all tags
  useEffect(() => {
    const loadTags = async () => {
      setIsLoading(true);
      try {
        const tags = await database.tags.getAll();
        setAllTags(tags);
      } catch (error) {
        console.error("Failed to load tags:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTags();
  }, []);

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter((id) => id !== tagId));
    } else {
      onTagsChange([...selectedTags, tagId]);
    }
  };

  const clearAllTags = () => {
    onTagsChange([]);
  };

  const getTagColor = (color?: string) => {
    if (color) return color;
    // Generate a color based on tag name hash
    const hash = Array.from(color || "default").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
    const colors = [
      "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-800",
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
      "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-800",
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 border-purple-200 dark:border-purple-800",
      "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300 border-pink-200 dark:border-pink-800",
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  const getSelectedTagColor = (color?: string) => {
    if (color) return color;
    // Generate a color based on tag name hash for selected state
    const hash = Array.from(color || "default").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
    const colors = [
      "bg-blue-500 text-white border-blue-600",
      "bg-green-500 text-white border-green-600",
      "bg-yellow-500 text-white border-yellow-600",
      "bg-red-500 text-white border-red-600",
      "bg-purple-500 text-white border-purple-600",
      "bg-pink-500 text-white border-pink-600",
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
          <div className="flex gap-2">
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-6 w-18 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (allTags.length === 0) {
    return (
      <div className={`${className}`}>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No tags available. Create tags by adding them to conversations.
        </p>
      </div>
    );
  }

  const visibleTags = showAll ? allTags : allTags.slice(0, 10);
  const hasMoreTags = allTags.length > 10;

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Filter by Tags
        </h3>
        {selectedTags.length > 0 && (
          <button
            onClick={clearAllTags}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {visibleTags.map((tag) => {
          const isSelected = selectedTags.includes(tag.id);
          return (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
                isSelected
                  ? getSelectedTagColor(tag.color)
                  : `${getTagColor(tag.color)} hover:opacity-80`
              }`}
            >
              {tag.name}
              {isSelected && (
                <svg
                  className="ml-1 w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          );
        })}

        {hasMoreTags && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {showAll ? "Show less" : `+${allTags.length - 10} more`}
          </button>
        )}
      </div>

      {selectedTags.length > 0 && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {selectedTags.length} tag{selectedTags.length === 1 ? "" : "s"}{" "}
          selected
        </div>
      )}
    </div>
  );
}
