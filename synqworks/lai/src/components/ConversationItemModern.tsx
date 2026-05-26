import { useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import type { ApiConversation } from "../lib/api/types";
import { useChatStore } from "../lib/stores/chatStore";
import { useBranchStore } from "../lib/stores/branchStore";
import { GitBranch } from "lucide-react";
import { useUiStore } from "../lib/stores/uiStore";
import { invokeSafe } from "../lib/utils/tauri";
import TagInput from "./TagInput";

interface Props {
  conversation: ApiConversation;
  selected: boolean;
  onSelect: (id: string) => void;
}

export default function ConversationItem({
  conversation,
  selected,
  onSelect,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conversation.title || "Untitled");
  const [exporting, setExporting] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const updateTitle = useChatStore((s) => s.updateConversationTitle);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const addToast = useUiStore((s) => s.addToast);
  const getBranchTree = useBranchStore((s) => s.getBranchTree);
  const getActiveBranch = useBranchStore((s) => s.getActiveBranch);

  // Branch metadata for this conversation
  const branches = getBranchTree(conversation.id);
  const extraBranchCount = Math.max(0, branches.length - 1); // exclude root
  const activeBranch = getActiveBranch(conversation.id);

  const handleRename = async (e?: FormEvent) => {
    e?.preventDefault();
    try {
      await updateTitle(conversation.id, title);
      setEditing(false);
      addToast({ message: "Conversation renamed", type: "success", ttl: 3000 });
    } catch (err: any) {
      addToast({
        message: `Rename failed: ${String(err)}`,
        type: "error",
        ttl: 5000,
      });
    }
  };

  const handleDelete = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(conversation.id);
      addToast({
        message: "Conversation deleted",
        type: "success",
        ttl: 3000,
      });
    } catch (err: any) {
      addToast({ message: err.message, type: "error", ttl: 3000 });
    }
  };

  const handleExport = async (
    e: MouseEvent,
    format: "json" | "markdown" | "html" | "pdf",
  ) => {
    e.stopPropagation();
    setExporting(true);
    try {
      const result = await invokeSafe("save_single_conversation_export", {
        conversation_id: conversation.id,
        format: format,
        title: conversation.title || "Untitled",
      });
      addToast({
        message: `Conversation exported as ${format.toUpperCase()}: ${result}`,
        type: "success",
        ttl: 3000,
      });
    } catch (err: any) {
      addToast({
        message: `Export failed: ${err.message || err}`,
        type: "error",
        ttl: 3000,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className={`
        group relative
        rounded-xl border transition-all duration-150
        cursor-pointer overflow-hidden
        ${
          selected
            ? "border-[#7aa2f7] bg-[#7aa2f7]/10 shadow-lg shadow-[#7aa2f7]/10"
            : "border-[#414868]/50 bg-[#24283b]/50 hover:border-[#414868] hover:shadow-md hover:bg-[#24283b]/70"
        }
      `}
      onClick={() => onSelect(conversation.id)}
    >
      {/* Main Content */}
      <div className="p-4">
        {!editing && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-semibold text-[#c0caf5] truncate flex-1 pr-2">
                {conversation.title || "Untitled Conversation"}
              </h3>
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  className="p-1 rounded-md bg-[#414868] hover:bg-[#565f89] text-[#c0caf5] transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTags(!showTags);
                  }}
                  title="Manage tags"
                >
                  <span className="text-xs">🏷️</span>
                </button>
                <button
                  className="p-1 rounded-md bg-[#414868] hover:bg-[#565f89] text-[#c0caf5] transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                  }}
                  title="Rename conversation"
                >
                  <span className="text-xs">✏️</span>
                </button>
              </div>
            </div>

            {/* Model & Provider Info + Branch Indicators */}
            <div className="flex items-center flex-wrap gap-2 mb-3">
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#414868] text-xs font-medium text-[#c0caf5]">
                🤖 {conversation.model}
              </span>
              <span className="text-xs text-[#9aa5ce]">
                {new Date(conversation.updated_at).toLocaleDateString()}
              </span>
              {extraBranchCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#7aa2f7]/15 border border-[#7aa2f7]/30 text-[#7aa2f7] text-xs"
                  title={`${extraBranchCount} branched path${extraBranchCount > 1 ? "s" : ""}`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  {extraBranchCount}
                </span>
              )}
              {activeBranch && activeBranch.parentBranchId && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#bb9af7]/15 border border-[#bb9af7]/30 text-[#bb9af7] text-[10px] max-w-[10rem] truncate"
                  title={`Active branch: ${activeBranch.name}`}
                >
                  {activeBranch.name}
                </span>
              )}
            </div>

            {/* Action Buttons - Show on Hover */}
            <div className="flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <div className="flex items-center space-x-1">
                {/* Export Buttons */}
                <button
                  className="flex items-center space-x-1 px-2 py-1 text-xs bg-[#9ece6a]/20 text-[#9ece6a] border border-[#9ece6a]/30 rounded-md hover:bg-[#9ece6a]/30 transition-colors disabled:opacity-50"
                  onClick={(e) => handleExport(e, "json")}
                  disabled={exporting}
                  title="Export as JSON"
                >
                  <span>📄</span>
                  <span className="hidden lg:inline">JSON</span>
                </button>
                <button
                  className="flex items-center space-x-1 px-2 py-1 text-xs bg-[#7aa2f7]/20 text-[#7aa2f7] border border-[#7aa2f7]/30 rounded-md hover:bg-[#7aa2f7]/30 transition-colors disabled:opacity-50"
                  onClick={(e) => handleExport(e, "markdown")}
                  disabled={exporting}
                  title="Export as Markdown"
                >
                  <span>📝</span>
                  <span className="hidden lg:inline">MD</span>
                </button>
                <button
                  className="flex items-center space-x-1 px-2 py-1 text-xs bg-[#bb9af7]/20 text-[#bb9af7] border border-[#bb9af7]/30 rounded-md hover:bg-[#bb9af7]/30 transition-colors disabled:opacity-50"
                  onClick={(e) => handleExport(e, "pdf")}
                  disabled={exporting}
                  title="Export as PDF"
                >
                  <span>📄</span>
                  <span className="hidden lg:inline">PDF</span>
                </button>
              </div>
              <button
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-[#f7768e]/20 text-[#f7768e] border border-[#f7768e]/30 rounded-md hover:bg-[#f7768e]/30 transition-colors"
                onClick={handleDelete}
                title="Delete conversation"
              >
                <span>🗑️</span>
                <span className="hidden lg:inline">Delete</span>
              </button>
            </div>
          </>
        )}

        {editing && (
          <form onSubmit={handleRename} className="space-y-3">
            <input
              className="
                w-full px-3 py-2 text-sm
                border border-[#414868]
                rounded-lg bg-[#24283b]
                text-[#c0caf5] placeholder-[#565f89]
                focus:ring-2 focus:ring-[#7aa2f7]/50 focus:border-transparent
                transition-all duration-150
              "
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="Enter conversation title..."
            />
            <div className="flex items-center space-x-2">
              <button
                type="submit"
                className="flex-1 px-3 py-2 text-xs font-medium bg-[#9ece6a] hover:bg-[#9ece6a]/90 text-[#1a1b26] rounded-md transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                className="flex-1 px-3 py-2 text-xs font-medium bg-[#414868] hover:bg-[#565f89] text-[#c0caf5] rounded-md transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(false);
                  setTitle(conversation.title || "Untitled");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Tag Management Area */}
      {showTags && (
        <div className="border-t border-[#414868] p-4 bg-[#24283b]/50">
          <TagInput
            conversationId={conversation.id}
            placeholder="Add tags to organize this conversation..."
            className="text-sm"
          />
        </div>
      )}

      {/* Loading Overlay */}
      {exporting && (
        <div className="absolute inset-0 bg-[#1a1b26]/90 backdrop-blur-sm flex items-center justify-center rounded-xl">
          <div className="flex items-center space-x-2 text-sm text-[#9aa5ce]">
            <div className="animate-spin w-4 h-4 border-2 border-[#7aa2f7] border-t-transparent rounded-full"></div>
            <span>Exporting...</span>
          </div>
        </div>
      )}
    </div>
  );
}
