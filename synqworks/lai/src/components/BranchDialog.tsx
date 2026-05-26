import { useState } from "react";
import { useChatStore } from "../lib/stores/chatStore";
import { useUiStore } from "../lib/stores/uiStore";

interface BranchDialogProps {
  messageId: string;
  onClose: () => void;
  onBranchCreated?: (branchId: string) => void;
}

export default function BranchDialog({
  messageId,
  onClose,
  onBranchCreated,
}: BranchDialogProps) {
  const [title, setTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const createBranch = useChatStore((s) => s.createBranch);
  const addToast = useUiStore((s) => s.addToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isCreating) return;

    try {
      setIsCreating(true);
      const branch = await createBranch(messageId, title.trim());
      addToast({
        message: "Branch created successfully!",
        type: "success",
        ttl: 3000,
      });
      onBranchCreated?.(branch.id);
      onClose();
    } catch {
      addToast({
        message: "Failed to create branch",
        type: "error",
        ttl: 3000,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#1a1b26] border border-[#414868] rounded-lg shadow-2xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold mb-4 text-[#c0caf5]">
          Create Branch
        </h2>
        <p className="text-sm text-[#9aa5ce] mb-4">
          Create a new conversation branch from this message point. This allows
          you to explore alternative conversation paths.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="branch-title"
              className="block text-sm font-medium text-[#9aa5ce] mb-2"
            >
              Branch Title
            </label>
            <input
              id="branch-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter branch title..."
              className="w-full px-3 py-2 border border-[#414868] rounded-md bg-[#24283b] text-[#c0caf5] placeholder-[#565f89] focus:outline-none focus:ring-2 focus:ring-[#7aa2f7]/50 transition-all duration-150"
              autoFocus
              disabled={isCreating}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="px-4 py-2 text-sm font-medium text-[#c0caf5] bg-[#414868] hover:bg-[#565f89] rounded-md disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isCreating}
              className="px-4 py-2 text-sm font-medium text-[#1a1b26] bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating ? "Creating..." : "Create Branch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
