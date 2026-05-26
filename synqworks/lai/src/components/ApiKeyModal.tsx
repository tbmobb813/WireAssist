import { useState, useEffect } from "react";
import { useUiStore } from "../lib/stores/uiStore";

export default function ApiKeyModal() {
  const { apiKeyModal, closeApiKeyModal } = useUiStore();
  const [keyValue, setKeyValue] = useState("");

  // Reset keyValue when modal is closed by any means
  useEffect(() => {
    if (!apiKeyModal.open) {
      setKeyValue("");
    }
  }, [apiKeyModal.open]);

  if (!apiKeyModal.open) return null;

  const resetAndClose = () => {
    setKeyValue("");
    closeApiKeyModal();
  };

  const handleSubmit = () => {
    if (keyValue.trim()) {
      apiKeyModal.onSubmit?.(keyValue.trim());
      resetAndClose();
    }
  };

  const handleCancel = () => {
    resetAndClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-96 bg-[#1a1b26] border border-[#414868] rounded-lg shadow-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#c0caf5]">
            {apiKeyModal.title}
          </h3>
          <button
            onClick={handleCancel}
            className="text-[#9aa5ce] hover:text-[#c0caf5] text-xs transition-colors"
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="api-key-input"
              className="text-xs text-[#9aa5ce] block mb-1"
            >
              API Key
            </label>
            <input
              id="api-key-input"
              type="password"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit();
                } else if (e.key === "Escape") {
                  handleCancel();
                }
              }}
              placeholder="Enter your API key"
              className="w-full px-2 py-1 rounded bg-[#24283b] border border-[#414868] text-sm text-[#c0caf5] placeholder-[#565f89] outline-none focus:ring-2 focus:ring-[#7aa2f7]/50 transition-all duration-150"
              autoFocus
            />
            <p className="text-[11px] text-[#565f89] mt-1">
              Your API key will be securely stored in the system keyring.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-xs rounded bg-[#414868] border border-[#414868] hover:bg-[#565f89] text-[#c0caf5] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!keyValue.trim()}
              className="px-3 py-1 text-xs rounded bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 disabled:opacity-60 disabled:cursor-not-allowed text-[#1a1b26] font-medium transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
