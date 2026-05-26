import { useState } from "react";
import { useUiStore } from "../lib/stores/uiStore";
import { invokeSafe } from "../lib/utils/tauri";
import { useSettingsStore } from "../lib/stores/settingsStore";

export default function ExecutionAuditModal() {
  const { auditModal, closeAudit, showAudit } = useUiStore();
  const { allowCodeExecution } = useSettingsStore();
  const [rotating, setRotating] = useState(false);

  if (!auditModal.open) return null;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const onRotate = async () => {
    if (!allowCodeExecution) {
      // don't allow rotation if execution isn't enabled? still allow.
    }
    setRotating(true);
    try {
      await invokeSafe("rotate_audit");
      // re-read
      const content =
        (await invokeSafe<string>("read_audit", { lines: 200 })) || "";
      showAudit(content);
    } catch (e) {
      console.error("rotate audit failed", e);
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-11/12 max-w-3xl bg-[#1a1b26] border border-[#414868] rounded-lg shadow-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[#c0caf5]">
            Execution Audit
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => copy(auditModal.content)}
              className="text-xs px-2 py-1 rounded bg-[#414868] hover:bg-[#565f89] text-[#c0caf5] transition-colors"
            >
              Copy
            </button>
            <button
              onClick={onRotate}
              disabled={rotating}
              className="text-xs px-2 py-1 rounded bg-[#e0af68] text-[#1a1b26] hover:bg-[#e0af68]/90 disabled:opacity-60 transition-colors font-medium"
            >
              {rotating ? "Rotating…" : "Rotate Log"}
            </button>
            <button
              onClick={closeAudit}
              className="text-xs px-2 py-1 rounded bg-[#f7768e] text-[#1a1b26] hover:bg-[#f7768e]/90 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <pre className="max-h-96 overflow-auto p-2 bg-[#24283b] border border-[#414868] rounded text-sm text-[#c0caf5] whitespace-pre-wrap">
            {auditModal.content || "(no audit entries)"}
          </pre>
        </div>
      </div>
    </div>
  );
}
