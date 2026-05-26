import { useUiStore } from "../lib/stores/uiStore";

export default function RunOutputModal() {
  const { runModal, closeRunResult } = useUiStore();
  if (!runModal.open) return null;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-11/12 max-w-3xl bg-[#1a1b26] border border-[#414868] rounded-lg shadow-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[#c0caf5]">
            Execution Result
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => copy(runModal.stdout)}
              className="text-xs px-2 py-1 rounded bg-[#414868] hover:bg-[#565f89] text-[#c0caf5] transition-colors"
            >
              Copy Stdout
            </button>
            <button
              onClick={() => copy(runModal.stderr)}
              className="text-xs px-2 py-1 rounded bg-[#414868] hover:bg-[#565f89] text-[#c0caf5] transition-colors"
            >
              Copy Stderr
            </button>
            <button
              onClick={closeRunResult}
              className="text-xs px-2 py-1 rounded bg-[#f7768e] text-[#1a1b26] hover:bg-[#f7768e]/90 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-xs text-[#9aa5ce] mb-1">Stdout</div>
            <pre className="max-h-48 overflow-auto p-2 bg-[#24283b] border border-[#414868] rounded text-sm text-[#c0caf5]">
              {runModal.stdout || "(no output)"}
            </pre>
          </div>
          <div>
            <div className="text-xs text-[#9aa5ce] mb-1">Stderr</div>
            <pre className="max-h-48 overflow-auto p-2 bg-[#24283b] border border-[#414868] rounded text-sm text-[#f7768e]">
              {runModal.stderr || "(no error)"}
            </pre>
          </div>
          <div className="text-sm text-[#9aa5ce]">
            Exit code:{" "}
            <span className="text-[#c0caf5] font-medium">
              {String(runModal.exit_code ?? "—")}
            </span>
            {runModal.timed_out ? (
              <span className="text-[#f7768e]"> (timed out)</span>
            ) : (
              ""
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
