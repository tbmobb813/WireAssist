import { useUiStore } from "../lib/stores/uiStore";
import { invokeSafe } from "../lib/utils/tauri";

export default function CommandSuggestionsModal() {
  const suggestionsModal = useUiStore((s) => s.suggestionsModal);
  const closeSuggestions = useUiStore((s) => s.closeSuggestions);
  const addToast = useUiStore((s) => s.addToast);
  const showRunResult = useUiStore((s) => s.showRunResult);
  if (!suggestionsModal.open) return null;
  const items: string[] = suggestionsModal.items || [];

  const onCopy = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      addToast({ message: "Copied", type: "success", ttl: 1000 });
    } catch {
      addToast({ message: "Copy failed", type: "error", ttl: 1200 });
    }
  };

  const onRun = async (cmd: string) => {
    try {
      const res = await invokeSafe<any>("run_code", {
        language: "sh",
        code: cmd,
        timeoutMs: 10000,
        cwd: null,
      });
      if (res) showRunResult(res);
    } catch {
      addToast({ message: "Run failed", type: "error", ttl: 1500 });
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm">
      <div className="w-[600px] max-w-[95vw] bg-[#1a1b26] text-[#c0caf5] border border-[#414868] rounded-lg shadow-2xl p-6 animate-in fade-in duration-150">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#c0caf5]">
            Command suggestions
          </h3>
          <button
            className="text-[#565f89] hover:text-[#c0caf5] transition-colors duration-150"
            onClick={closeSuggestions}
            aria-label="Close suggestions"
          >
            ✕
          </button>
        </div>
        {items.length === 0 ? (
          <div className="text-sm text-[#565f89] text-center py-4">
            No suggestions
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((cmd, idx) => (
              <li
                key={idx}
                className="p-3 rounded-lg border border-[#414868] bg-[#24283b] hover:bg-[#414868]/30 transition-all duration-150"
              >
                <div className="text-sm font-mono break-all whitespace-pre-wrap text-[#c0caf5]">
                  {cmd}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#414868] hover:bg-[#565f89] text-[#c0caf5] transition-all duration-150 font-medium"
                    onClick={() => onCopy(cmd)}
                  >
                    Copy
                  </button>
                  <button
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#7aa2f7] hover:bg-[#7aa2f7]/80 text-[#1a1b26] transition-all duration-150 font-medium"
                    onClick={() => onRun(cmd)}
                  >
                    Run
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
