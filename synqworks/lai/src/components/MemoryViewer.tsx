import React, { useState, useMemo } from "react";
import {
  Brain,
  X,
  Plus,
  Trash2,
  Search,
  Download,
  Tag,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useMemoryStore, MemoryEntry } from "../lib/stores/memoryStore";
import { AnimatedButton, FadeIn } from "./Animations";

export const MemoryViewer: React.FC = () => {
  const {
    memories,
    currentProject,
    isMemoryViewerOpen,
    searchQuery,
    toggleMemoryViewer,
    removeMemory,
    setSearchQuery,
    clearProjectMemories,
    exportMemories,
    recallMemories,
  } = useMemoryStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedMemory, setExpandedMemory] = useState<string | null>(null);


  const projectPath = currentProject || "default";
  const projectMemory = memories.get(projectPath);

  // Filter memories by search query
  const filteredMemories = useMemo(() => {
    if (!projectMemory) return [];

    if (!searchQuery.trim()) {
      return [...projectMemory.entries].sort(
        (a, b) => b.createdAt - a.createdAt,
      );
    }

    // Use recall for semantic search
    return recallMemories(searchQuery, 50);
  }, [projectMemory, searchQuery, recallMemories]);

  const handleExport = () => {
    const data = exportMemories(projectPath);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memory-${projectPath.replace(/[^a-z0-9]/gi, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tokenPercentage = projectMemory
    ? (projectMemory.totalTokens / projectMemory.maxTokens) * 100
    : 0;

  // Ensure hooks are always called in the same order. The UI should
  // short-circuit render only after hooks (like useMemo) have been
  // declared above. This preserves the React Hooks contract and avoids
  // the "called conditionally" ESLint error.
  if (!isMemoryViewerOpen) {
    return null;
  }

  return (
    <FadeIn>
      <div className="fixed inset-y-0 right-0 z-50 w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Session Memory
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {projectMemory?.entries.length || 0} memories
              </p>
            </div>
          </div>
          <button
            onClick={toggleMemoryViewer}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close memory viewer"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Token Usage Bar */}
        {projectMemory && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-gray-600 dark:text-gray-400">
                Token Usage
              </span>
              <span className="font-mono text-gray-900 dark:text-white">
                {projectMemory.totalTokens} / {projectMemory.maxTokens}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${tokenPercentage > 90
                    ? "bg-red-500"
                    : tokenPercentage > 70
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }`}
                style={{ width: `${Math.min(tokenPercentage, 100)}%` }}
              />
            </div>
            {tokenPercentage > 80 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                ⚠️ Memory is nearly full. Oldest entries will be auto-cleaned.
              </p>
            )}
          </div>
        )}

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories..."
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <AnimatedButton
            onClick={() => setShowAddModal(true)}
            variant="primary"
            size="sm"
            className="flex-1"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add
          </AnimatedButton>
          <AnimatedButton
            onClick={handleExport}
            variant="secondary"
            size="sm"
            className="flex-1"
          >
            <Download className="w-3 h-3 mr-1" />
            Export
          </AnimatedButton>
          <AnimatedButton
            onClick={() => {
              if (
                confirm(
                  `Clear all memories for ${projectPath}? This cannot be undone.`,
                )
              ) {
                clearProjectMemories(projectPath);
              }
            }}
            variant="danger"
            size="sm"
          >
            <Trash2 className="w-3 h-3" />
          </AnimatedButton>
        </div>

        {/* Memory List */}
        <div className="flex-1 overflow-y-auto">
          {filteredMemories.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 p-8">
              <div className="text-center">
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">
                  {searchQuery
                    ? "No matching memories found"
                    : "No memories yet"}
                </p>
                <p className="text-xs mt-1">
                  {searchQuery
                    ? "Try a different search"
                    : "Use /remember to save important information"}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {filteredMemories.map((memory) => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  isExpanded={expandedMemory === memory.id}
                  onToggleExpand={() =>
                    setExpandedMemory(
                      expandedMemory === memory.id ? null : memory.id,
                    )
                  }
                  onDelete={() => removeMemory(memory.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add Memory Modal */}
        {showAddModal && (
          <AddMemoryModal onClose={() => setShowAddModal(false)} />
        )}
      </div>
    </FadeIn>
  );
};

interface MemoryCardProps {
  memory: MemoryEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
}

const MemoryCard: React.FC<MemoryCardProps> = ({
  memory,
  isExpanded,
  onToggleExpand,
  onDelete,
}) => {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-purple-300 dark:hover:border-purple-600 transition-colors">
      {/* Header */}
      <div
        className="flex items-start gap-2 p-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        <button className="mt-1 flex-shrink-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
            {memory.content}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="w-3 h-3" />
            <span>{new Date(memory.createdAt).toLocaleDateString()}</span>
            {memory.tokenCount && (
              <>
                <span>•</span>
                <span>{memory.tokenCount} tokens</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Delete this memory?")) {
              onDelete();
            }
          }}
          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 flex-shrink-0"
          title="Delete memory"
        >
          <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
        </button>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
          {memory.context && (
            <div className="text-xs">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                Context:
              </span>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {memory.context}
              </p>
            </div>
          )}

          {memory.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Tag className="w-3 h-3 text-gray-500" />
              {memory.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {memory.conversationId && (
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <MessageSquare className="w-3 h-3" />
              <span>From conversation {memory.conversationId.slice(0, 8)}</span>
            </div>
          )}

          <div className="text-xs text-gray-500 dark:text-gray-400">
            Created: {new Date(memory.createdAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

interface AddMemoryModalProps {
  onClose: () => void;
}

const AddMemoryModal: React.FC<AddMemoryModalProps> = ({ onClose }) => {
  const { addMemory, currentProject } = useMemoryStore();
  const [content, setContent] = useState("");
  const [context, setContext] = useState("");
  const [tags, setTags] = useState("");

  const handleAdd = () => {
    if (!content.trim()) return;

    addMemory(content, {
      context: context.trim() || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <FadeIn>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Add Memory
              </h3>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Content *
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What should I remember?"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={4}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Context (optional)
                </label>
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Why is this important?"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tags (optional, comma-separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="api, database, config"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400">
                Project: {currentProject || "default"}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <AnimatedButton
                onClick={handleAdd}
                variant="primary"
                size="md"
                className="flex-1"
              >
                Add Memory
              </AnimatedButton>
              <AnimatedButton onClick={onClose} variant="secondary" size="md">
                Cancel
              </AnimatedButton>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  );
};

export default MemoryViewer;
