import { useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import type { ApiConversation } from "../lib/api/types";
import { useChatStore } from "../lib/stores/chatStore";
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
      className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-gray-800 ${
        selected ? "bg-gray-800" : ""
      }`}
      onClick={() => onSelect(conversation.id)}
    >
      <div className="flex-1">
        {!editing && (
          <>
            <div className="text-sm font-medium truncate">
              {conversation.title || "Untitled"}
            </div>
            <div className="text-xs text-gray-400 truncate">
              {conversation.model}
            </div>
          </>
        )}

        {editing && (
          <form onSubmit={handleRename} className="flex gap-2">
            <input
              className="flex-1 text-sm px-2 py-1 rounded bg-gray-700"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="text-xs px-2 py-1 bg-green-600 rounded"
            >
              Save
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1 bg-gray-600 rounded"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(false);
                setTitle(conversation.title || "Untitled");
              }}
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!editing && (
          <>
            <button
              className="text-xs px-2 py-1 bg-indigo-600 rounded hover:bg-indigo-700"
              onClick={(e) => {
                e.stopPropagation();
                setShowTags(!showTags);
              }}
              title="Manage tags"
            >
              🏷️
            </button>
            <button
              className="text-xs px-2 py-1 bg-yellow-600 rounded hover:bg-yellow-700"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
            >
              Rename
            </button>
            <button
              className="text-xs px-1 py-1 bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
              onClick={(e) => handleExport(e, "json")}
              disabled={exporting}
              title="Export as JSON"
            >
              📄
            </button>
            <button
              className="text-xs px-1 py-1 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              onClick={(e) => handleExport(e, "markdown")}
              disabled={exporting}
              title="Export as Markdown"
            >
              📝
            </button>
            <button
              className="text-xs px-1 py-1 bg-orange-600 rounded hover:bg-orange-700 disabled:opacity-50"
              onClick={(e) => handleExport(e, "html")}
              disabled={exporting}
              title="Export as HTML"
            >
              🌐
            </button>
            <button
              className="text-xs px-1 py-1 bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50"
              onClick={(e) => handleExport(e, "pdf")}
              disabled={exporting}
              title="Export as PDF"
            >
              📄
            </button>
            <button
              className="text-xs px-2 py-1 bg-red-600 rounded hover:bg-red-700"
              onClick={handleDelete}
            >
              Delete
            </button>
          </>
        )}
      </div>

      {/* Tag Management Area */}
      {showTags && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <TagInput
            conversationId={conversation.id}
            placeholder="Add tags to organize this conversation..."
            className="text-sm"
          />
        </div>
      )}
    </div>
  );
}
