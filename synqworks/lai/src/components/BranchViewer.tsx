import React, { useState } from "react";
import {
  GitBranch,
  GitFork,
  X,
  Trash2,
  Edit2,
  Check,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useBranchStore, ConversationBranch } from "../lib/stores/branchStore";
import { AnimatedButton, FadeIn } from "./Animations";

export const BranchViewer: React.FC = () => {
  const {
    branchMetadata,
    showBranchViewer,
    selectedConversation,
    toggleBranchViewer,
    switchBranch,
    deleteBranch,
    renameBranch,
    getBranchTree,
  } = useBranchStore();

  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(
    new Set(),
  );

  if (!showBranchViewer || !selectedConversation) {
    return null;
  }

  const metadata = branchMetadata.get(selectedConversation);
  if (!metadata) {
    return null;
  }

  const branches = getBranchTree(selectedConversation);
  const activeBranch = branches.find((b) => b.id === metadata.activeBranchId);

  const handleRename = (branchId: string) => {
    if (editingName.trim()) {
      renameBranch(branchId, editingName);
    }
    setEditingBranchId(null);
    setEditingName("");
  };

  const toggleExpanded = (branchId: string) => {
    const newExpanded = new Set(expandedBranches);
    if (newExpanded.has(branchId)) {
      newExpanded.delete(branchId);
    } else {
      newExpanded.add(branchId);
    }
    setExpandedBranches(newExpanded);
  };

  // Build tree structure
  const buildTree = () => {
    const rootBranch = branches.find((b) => b.id === metadata.rootBranchId);
    if (!rootBranch) return null;

    const renderBranch = (branch: ConversationBranch, level: number = 0) => {
      const children = branches.filter((b) => b.parentBranchId === branch.id);
      const hasChildren = children.length > 0;
      const isExpanded = expandedBranches.has(branch.id);
      const isActive = branch.id === metadata.activeBranchId;
      const isEditing = editingBranchId === branch.id;

      return (
        <div key={branch.id} style={{ marginLeft: `${level * 24}px` }}>
          <div
            className={`flex items-center gap-2 p-3 rounded-lg mb-2 transition-all ${
              isActive
                ? "bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500"
                : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {/* Expand/collapse */}
            {hasChildren && (
              <button
                onClick={() => toggleExpanded(branch.id)}
                className="p-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-6" />}

            {/* Branch icon */}
            <GitBranch
              className={`w-4 h-4 ${
                isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-600"
              }`}
            />

            {/* Branch name */}
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleRename(branch.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(branch.id);
                    if (e.key === "Escape") {
                      setEditingBranchId(null);
                      setEditingName("");
                    }
                  }}
                  className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              ) : (
                <div>
                  <div className="font-semibold text-sm text-gray-900 dark:text-white">
                    {branch.name}
                  </div>
                  {branch.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {branch.description}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {branch.messageIds.length} messages •{" "}
                    {new Date(branch.createdAt).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {!isActive && (
                <AnimatedButton
                  onClick={() => switchBranch(selectedConversation, branch.id)}
                  variant="secondary"
                  size="sm"
                  className="!text-xs !px-2 !py-1"
                >
                  Switch
                </AnimatedButton>
              )}
              {isActive && (
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 px-2">
                  Active
                </span>
              )}
              <button
                onClick={() => {
                  setEditingBranchId(branch.id);
                  setEditingName(branch.name);
                }}
                className="p-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
                title="Rename branch"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              {branch.id !== metadata.rootBranchId && !isActive && (
                <button
                  onClick={() => deleteBranch(selectedConversation, branch.id)}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400"
                  title="Delete branch"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Children */}
          {hasChildren && isExpanded && (
            <div className="ml-4 border-l-2 border-gray-300 dark:border-gray-600 pl-2">
              {children.map((child) => renderBranch(child, level + 1))}
            </div>
          )}
        </div>
      );
    };

    return renderBranch(rootBranch);
  };

  return (
    <FadeIn>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <GitFork className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Conversation Branches
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Explore alternative conversation paths
                </p>
              </div>
            </div>
            <button
              onClick={toggleBranchViewer}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Active branch info */}
          {activeBranch && (
            <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                  Currently on: {activeBranch.name}
                </span>
              </div>
              {activeBranch.description && (
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1 ml-6">
                  {activeBranch.description}
                </p>
              )}
            </div>
          )}

          {/* Branch tree */}
          <div className="flex-1 overflow-y-auto p-6">
            {branches.length === 0 ? (
              <div className="text-center py-12">
                <GitBranch className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No branches yet
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Fork the conversation to create a new branch
                </p>
              </div>
            ) : (
              buildTree()
            )}
          </div>

          {/* Stats */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-4">
              <span>{branches.length} branches</span>
              <span>•</span>
              <span>
                {branches.reduce((sum, b) => sum + b.messageIds.length, 0)}{" "}
                total messages
              </span>
            </div>
            <div className="text-xs">
              Press{" "}
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                Ctrl
              </kbd>
              +
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                Shift
              </kbd>
              +
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                B
              </kbd>{" "}
              to toggle
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  );
};

export default BranchViewer;
