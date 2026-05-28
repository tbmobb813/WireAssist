import { useState, useEffect } from "react";
import {
  Monitor,
  RotateCcw,
  X,
  Check,
  AlertCircle,
  Info,
  Move,
  Maximize2,
} from "lucide-react";
import { database } from "../lib/api/database";

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

interface WindowPositionSettingsProps {
  onClose?: () => void;
}

export default function WindowPositionSettings({
  onClose,
}: WindowPositionSettingsProps) {
  const [windowState, setWindowState] = useState<WindowState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");

  useEffect(() => {
    loadWindowState();
  }, []);

  const loadWindowState = async () => {
    try {
      setError(null);
      setIsLoading(true);
      const state = (await database.window.getState()) as WindowState;
      setWindowState(state);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load window state",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const saveCurrentState = async () => {
    try {
      setSaveStatus("saving");
      await database.window.saveState();
      await loadWindowState(); // Refresh the displayed state
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      setSaveStatus("error");
      setError(
        err instanceof Error ? err.message : "Failed to save window state",
      );
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const restoreState = async () => {
    try {
      setSaveStatus("saving");
      await database.window.restoreState();
      await loadWindowState(); // Refresh the displayed state
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      setSaveStatus("error");
      setError(
        err instanceof Error ? err.message : "Failed to restore window state",
      );
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const resetToDefault = async () => {
    try {
      setSaveStatus("saving");
      await database.window.resetState();
      await loadWindowState(); // Refresh the displayed state
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      setSaveStatus("error");
      setError(
        err instanceof Error ? err.message : "Failed to reset window state",
      );
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="w-[500px] bg-[#1a1b26] border border-[#414868] rounded-lg shadow-2xl p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#7aa2f7]"></div>
          <span className="ml-2 text-[#9aa5ce]">Loading window state...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[550px] bg-[#1a1b26] border border-[#414868] rounded-lg shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#414868]">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-[#7aa2f7]" />
          <h2 className="text-lg font-semibold text-[#c0caf5]">
            Window Position Memory
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToDefault}
            className="px-3 py-1 text-sm text-[#9aa5ce] hover:text-[#c0caf5] border border-[#414868] rounded hover:bg-[#24283b] transition-colors"
            disabled={saveStatus === "saving"}
          >
            Reset
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-[#9aa5ce] hover:text-[#c0caf5] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Save Status */}
        {saveStatus !== "idle" && (
          <div className="mb-4">
            {saveStatus === "saving" && (
              <div className="flex items-center gap-2 text-[#7aa2f7]">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                <span className="text-sm">Processing...</span>
              </div>
            )}
            {saveStatus === "success" && (
              <div className="flex items-center gap-2 text-[#9ece6a]">
                <Check className="w-4 h-4" />
                <span className="text-sm">
                  Window state updated successfully
                </span>
              </div>
            )}
            {saveStatus === "error" && (
              <div className="flex items-center gap-2 text-[#f7768e]">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">Failed to update window state</span>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-[#f7768e]/10 border border-[#f7768e]/30 rounded-lg">
            <div className="flex items-center gap-2 text-[#f7768e]">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mb-6 p-3 bg-[#7aa2f7]/10 border border-[#7aa2f7]/30 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-[#7aa2f7] mt-0.5" />
            <div className="text-sm text-[#c0caf5]">
              <strong>Automatic Memory:</strong> The app automatically remembers
              your window position and size when you move or resize it. Use the
              controls below to manually manage the saved state.
            </div>
          </div>
        </div>

        {/* Current Window State */}
        {windowState && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-[#c0caf5] mb-3">
              Current Window State
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Position */}
              <div className="bg-[#24283b]/50 rounded-lg p-3 border border-[#414868]">
                <div className="flex items-center gap-2 mb-2">
                  <Move className="w-4 h-4 text-[#9ece6a]" />
                  <span className="text-sm font-medium text-[#c0caf5]">
                    Position
                  </span>
                </div>
                <div className="text-sm text-[#9aa5ce]">
                  <div>X: {windowState.x}px</div>
                  <div>Y: {windowState.y}px</div>
                </div>
              </div>

              {/* Size */}
              <div className="bg-[#24283b]/50 rounded-lg p-3 border border-[#414868]">
                <div className="flex items-center gap-2 mb-2">
                  <Maximize2 className="w-4 h-4 text-[#bb9af7]" />
                  <span className="text-sm font-medium text-[#c0caf5]">
                    Size
                  </span>
                </div>
                <div className="text-sm text-[#9aa5ce]">
                  <div>Width: {windowState.width}px</div>
                  <div>Height: {windowState.height}px</div>
                </div>
              </div>
            </div>

            {/* Maximized State */}
            <div className="mt-3 bg-[#24283b]/50 rounded-lg p-3 border border-[#414868]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#c0caf5]">
                  Maximized State
                </span>
                <span
                  className={`text-sm font-mono px-2 py-1 rounded ${
                    windowState.maximized
                      ? "bg-[#9ece6a]/20 text-[#9ece6a]"
                      : "bg-[#414868] text-[#9aa5ce]"
                  }`}
                >
                  {windowState.maximized ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={saveCurrentState}
            disabled={saveStatus === "saving"}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 disabled:opacity-50 disabled:cursor-not-allowed text-[#1a1b26] rounded-lg text-sm font-medium transition-all duration-150"
          >
            <Check className="w-4 h-4" />
            Save Current Position & Size
          </button>

          <button
            onClick={restoreState}
            disabled={saveStatus === "saving"}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#9ece6a] hover:bg-[#9ece6a]/90 disabled:opacity-50 disabled:cursor-not-allowed text-[#1a1b26] rounded-lg text-sm font-medium transition-all duration-150"
          >
            <RotateCcw className="w-4 h-4" />
            Restore Saved Position & Size
          </button>

          <button
            onClick={resetToDefault}
            disabled={saveStatus === "saving"}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#414868] hover:bg-[#565f89] disabled:opacity-50 disabled:cursor-not-allowed text-[#c0caf5] rounded-lg text-sm font-medium transition-all duration-150"
          >
            <Monitor className="w-4 h-4" />
            Reset to Default (800x600, Top-Left)
          </button>
        </div>

        {/* Technical Details */}
        <div className="mt-6 pt-4 border-t border-[#414868]">
          <div className="text-xs text-[#9aa5ce]">
            <strong>How it works:</strong> The app automatically saves your
            window position and size whenever you move or resize the window. On
            next startup, it will restore the last saved state. You can manually
            save, restore, or reset the window position using the buttons above.
          </div>
        </div>
      </div>
    </div>
  );
}
