import { useState } from "react";
import {
  X,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  Info,
} from "lucide-react";

interface FileWatcherSettingsProps {
  onClose?: () => void;
}

interface WatchPattern {
  id: string;
  pattern: string;
  enabled: boolean;
}

export default function FileWatcherSettings({
  onClose,
}: FileWatcherSettingsProps) {
  const [patterns, setPatterns] = useState<WatchPattern[]>([
    { id: "1", pattern: "**/*.{js,ts,tsx,jsx}", enabled: true },
    { id: "2", pattern: "**/*.md", enabled: true },
    { id: "3", pattern: "**/*.json", enabled: false },
  ]);
  const [newPattern, setNewPattern] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const addPattern = () => {
    if (!newPattern.trim()) {
      setError("Pattern cannot be empty");
      return;
    }

    const pattern: WatchPattern = {
      id: Date.now().toString(),
      pattern: newPattern.trim(),
      enabled: true,
    };

    setPatterns([...patterns, pattern]);
    setNewPattern("");
    setError(null);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const removePattern = (id: string) => {
    setPatterns(patterns.filter((p) => p.id !== id));
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const togglePattern = (id: string) => {
    setPatterns(
      patterns.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
    );
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  return (
    <div className="w-[700px] max-h-[80vh] overflow-y-auto bg-[#1a1b26] border border-[#414868] rounded-lg shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#414868]">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-[#7aa2f7]" />
          <h2 className="text-lg font-semibold text-[#c0caf5]">
            File Watcher Settings
          </h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-[#9aa5ce] hover:text-[#c0caf5] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4">
        {/* Save Status */}
        {saveStatus !== "idle" && (
          <div className="mb-4">
            {saveStatus === "saved" && (
              <div className="flex items-center gap-2 text-[#9ece6a]">
                <Check className="w-4 h-4" />
                <span className="text-sm">Settings saved</span>
              </div>
            )}
            {saveStatus === "error" && (
              <div className="flex items-center gap-2 text-[#f7768e]">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">Failed to save settings</span>
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
              <strong>File Watcher:</strong> Monitor specific files in your
              project for changes. Use glob patterns like **/*.js or
              src/**/*.tsx to watch multiple files.
            </div>
          </div>
        </div>

        {/* Add Pattern */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#c0caf5] mb-2">
            Add Watch Pattern
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addPattern()}
              placeholder="e.g., **/*.ts or src/**/*.{js,jsx}"
              className="flex-1 px-3 py-2 border border-[#414868] rounded-lg bg-[#24283b] text-[#c0caf5] placeholder-[#565f89] focus:ring-2 focus:ring-[#7aa2f7]/50 transition-all duration-150"
            />
            <button
              onClick={addPattern}
              className="px-4 py-2 bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 text-[#1a1b26] rounded-lg flex items-center gap-2 font-medium transition-all duration-150"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {/* Patterns List */}
        <div>
          <h3 className="text-sm font-medium text-[#c0caf5] mb-3">
            Watch Patterns ({patterns.length})
          </h3>
          <div className="space-y-2">
            {patterns.length === 0 ? (
              <div className="text-center py-8 text-[#9aa5ce]">
                <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No watch patterns configured</p>
                <p className="text-sm mt-1">
                  Add a pattern above to start watching files
                </p>
              </div>
            ) : (
              patterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className="flex items-center justify-between p-3 bg-[#24283b]/50 rounded-lg border border-[#414868]"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      onClick={() => togglePattern(pattern.id)}
                      className={`p-1 rounded transition-colors ${
                        pattern.enabled ? "text-[#9ece6a]" : "text-[#565f89]"
                      }`}
                      title={
                        pattern.enabled ? "Disable pattern" : "Enable pattern"
                      }
                    >
                      {pattern.enabled ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                    <code className="text-sm font-mono text-[#c0caf5]">
                      {pattern.pattern}
                    </code>
                  </div>
                  <button
                    onClick={() => removePattern(pattern.id)}
                    className="p-1 text-[#f7768e] hover:text-[#f7768e]/80 transition-colors"
                    title="Remove pattern"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 pt-4 border-t border-[#414868]">
          <div className="text-xs text-[#9aa5ce]">
            <strong>Pattern Examples:</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>
                <code>**/*.ts</code> - All TypeScript files
              </li>
              <li>
                <code>{"src/**/*.{js,jsx}"}</code> - JS/JSX files in src
                directory
              </li>
              <li>
                <code>*.json</code> - JSON files in root directory
              </li>
              <li>
                <code>docs/**/*.md</code> - Markdown files in docs directory
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
