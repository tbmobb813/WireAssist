import { useState, useEffect } from "react";
import {
  Keyboard,
  X,
  Check,
  AlertCircle,
  Power,
  PowerOff,
  Info,
} from "lucide-react";
import { database } from "../lib/api/database";

interface ShortcutAction {
  ToggleWindow: any;
  NewConversation: any;
  OpenSettings: any;
  QuickCapture: any;
  FocusInput: any;
  ClearConversation: any;
  ExportCurrent: any;
  ToggleProfileMenu: any;
  SearchDocuments: any;
  ShowPerformance: any;
  ToggleRecording: any;
  QuickExport: any;
}

interface GlobalShortcut {
  action: keyof ShortcutAction;
  shortcut: string;
  enabled: boolean;
}

interface ShortcutConfig {
  shortcuts: GlobalShortcut[];
}

interface ShortcutSettingsProps {
  onClose?: () => void;
}

const actionDisplayNames: Record<keyof ShortcutAction, string> = {
  ToggleWindow: "Toggle Window",
  NewConversation: "New Conversation",
  OpenSettings: "Open Settings",
  QuickCapture: "Quick Capture",
  FocusInput: "Focus Input",
  ClearConversation: "Clear Conversation",
  ExportCurrent: "Export Current",
  ToggleProfileMenu: "Toggle Profile Menu",
  SearchDocuments: "Search Documents",
  ShowPerformance: "Show Performance",
  ToggleRecording: "Toggle Recording",
  QuickExport: "Quick Export",
};

const actionDescriptions: Record<keyof ShortcutAction, string> = {
  ToggleWindow: "Show/hide the main application window",
  NewConversation: "Create a new conversation",
  OpenSettings: "Open the settings panel",
  QuickCapture: "Quick capture input without showing window",
  FocusInput: "Focus the chat input field",
  ClearConversation: "Clear the current conversation",
  ExportCurrent: "Export current conversation to file",
  ToggleProfileMenu: "Open/close the profile selection menu",
  SearchDocuments: "Open document search interface",
  ShowPerformance: "Display performance metrics",
  ToggleRecording: "Start/stop voice recording",
  QuickExport: "Quick export in default format",
};

const defaultShortcuts: Record<keyof ShortcutAction, string> = {
  ToggleWindow: "CommandOrControl+Space",
  NewConversation: "CommandOrControl+N",
  OpenSettings: "CommandOrControl+Comma",
  QuickCapture: "CommandOrControl+Shift+Space",
  FocusInput: "CommandOrControl+Shift+I",
  ClearConversation: "CommandOrControl+Delete",
  ExportCurrent: "CommandOrControl+E",
  ToggleProfileMenu: "CommandOrControl+P",
  SearchDocuments: "CommandOrControl+Shift+F",
  ShowPerformance: "CommandOrControl+Shift+P",
  ToggleRecording: "CommandOrControl+R",
  QuickExport: "CommandOrControl+Shift+E",
};

const actionCategories: Record<keyof ShortcutAction, string> = {
  ToggleWindow: "Window & Focus",
  FocusInput: "Window & Focus",
  QuickCapture: "Window & Focus",
  NewConversation: "Conversation",
  ClearConversation: "Conversation",
  ExportCurrent: "Export",
  QuickExport: "Export",
  ToggleProfileMenu: "Profiles",
  SearchDocuments: "Search",
  OpenSettings: "System",
  ShowPerformance: "System",
  ToggleRecording: "Recording",
};

export default function ShortcutSettings({ onClose }: ShortcutSettingsProps) {
  const [config, setConfig] = useState<ShortcutConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const [tempShortcut, setTempShortcut] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setError(null);
      setIsLoading(true);
      const data = (await database.shortcuts.getConfig()) as ShortcutConfig;
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shortcuts");
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async (newConfig: ShortcutConfig) => {
    try {
      setSaveStatus("saving");
      await database.shortcuts.updateConfig(newConfig);
      setConfig(newConfig);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      setSaveStatus("error");
      setError(err instanceof Error ? err.message : "Failed to save shortcuts");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const toggleShortcut = async (action: keyof ShortcutAction) => {
    if (!config) return;

    const newConfig = {
      ...config,
      shortcuts: config.shortcuts.map((shortcut) =>
        shortcut.action === action
          ? { ...shortcut, enabled: !shortcut.enabled }
          : shortcut,
      ),
    };

    await saveConfig(newConfig);
  };

  const updateShortcut = async (
    action: keyof ShortcutAction,
    newShortcut: string,
  ) => {
    if (!config) return;

    try {
      // Validate shortcut first
      await database.shortcuts.validateShortcut(newShortcut);

      const newConfig = {
        ...config,
        shortcuts: config.shortcuts.map((shortcut) =>
          shortcut.action === action
            ? { ...shortcut, shortcut: newShortcut }
            : shortcut,
        ),
      };

      await saveConfig(newConfig);
      setEditingShortcut(null);
      setTempShortcut("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid shortcut");
    }
  };

  const resetToDefault = async (action: keyof ShortcutAction) => {
    const defaultShortcut = defaultShortcuts[action];
    await updateShortcut(action, defaultShortcut);
  };

  const resetAllToDefaults = async () => {
    if (!config) return;

    const newConfig = {
      ...config,
      shortcuts: config.shortcuts.map((shortcut) => ({
        ...shortcut,
        shortcut: defaultShortcuts[shortcut.action],
        enabled: shortcut.action === "ToggleWindow", // Only enable toggle window by default
      })),
    };

    await saveConfig(newConfig);
  };

  const startEditing = (
    action: keyof ShortcutAction,
    currentShortcut: string,
  ) => {
    setEditingShortcut(action);
    setTempShortcut(currentShortcut);
    setError(null);
  };

  const cancelEditing = () => {
    setEditingShortcut(null);
    setTempShortcut("");
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingShortcut) {
      e.preventDefault();

      const modifiers = [];
      if (e.ctrlKey || e.metaKey) modifiers.push("CommandOrControl");
      if (e.altKey) modifiers.push("Alt");
      if (e.shiftKey) modifiers.push("Shift");

      let key = e.key;
      if (key === " ") key = "Space";
      if (
        key === "Control" ||
        key === "Meta" ||
        key === "Alt" ||
        key === "Shift"
      )
        return;

      const shortcut =
        modifiers.length > 0 ? `${modifiers.join("+")}+${key}` : key;
      setTempShortcut(shortcut);
    }
  };

  if (isLoading) {
    return (
      <div className="w-[600px] bg-[#1a1b26] border border-[#414868] rounded-lg shadow-2xl p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#7aa2f7]"></div>
          <span className="ml-2 text-[#9aa5ce]">Loading shortcuts...</span>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="w-[600px] bg-[#1a1b26] border border-[#414868] rounded-lg shadow-2xl p-6">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-[#f7768e] mx-auto mb-2" />
          <div className="text-[#f7768e] mb-2">Failed to load shortcuts</div>
          {error && <div className="text-sm text-[#9aa5ce] mb-4">{error}</div>}
          <button
            onClick={loadConfig}
            className="px-4 py-2 bg-[#7aa2f7] hover:bg-[#7aa2f7]/90 text-[#1a1b26] rounded-md text-sm font-medium transition-all duration-150"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-[800px] max-h-[80vh] overflow-y-auto bg-[#1a1b26] border border-[#414868] rounded-lg shadow-2xl"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#414868]">
        <div className="flex items-center gap-2">
          <Keyboard className="w-5 h-5 text-[#7aa2f7]" />
          <h2 className="text-lg font-semibold text-[#c0caf5]">
            Global Shortcuts
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetAllToDefaults}
            className="px-3 py-1 text-sm text-[#9aa5ce] hover:text-[#c0caf5] border border-[#414868] rounded hover:bg-[#24283b] transition-all duration-150"
          >
            Reset All
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
                <span className="text-sm">Saving shortcuts...</span>
              </div>
            )}
            {saveStatus === "success" && (
              <div className="flex items-center gap-2 text-[#9ece6a]">
                <Check className="w-4 h-4" />
                <span className="text-sm">Shortcuts saved successfully</span>
              </div>
            )}
            {saveStatus === "error" && (
              <div className="flex items-center gap-2 text-[#f7768e]">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">Failed to save shortcuts</span>
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
              <strong>Tip:</strong> Click on a shortcut to edit it. Use standard
              keyboard notation like "CommandOrControl+Space" or "Alt+Shift+N".
            </div>
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="space-y-6">
          {Object.entries(
            config.shortcuts.reduce(
              (acc, shortcut) => {
                const category = actionCategories[shortcut.action];
                if (!acc[category]) {
                  acc[category] = [];
                }
                acc[category].push(shortcut);
                return acc;
              },
              {} as Record<string, GlobalShortcut[]>,
            ),
          ).map(([category, shortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-[#c0caf5] mb-3 flex items-center gap-2">
                <div className="h-px bg-[#414868] flex-1"></div>
                <span className="px-2">{category}</span>
                <div className="h-px bg-[#414868] flex-1"></div>
              </h3>
              <div className="space-y-2">
                {shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.action}
                    className="flex items-center justify-between p-4 bg-[#24283b]/50 rounded-lg border border-[#414868]"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleShortcut(shortcut.action)}
                          className={`p-1 rounded transition-colors ${
                            shortcut.enabled
                              ? "text-[#9ece6a]"
                              : "text-[#565f89]"
                          }`}
                          title={
                            shortcut.enabled
                              ? "Disable shortcut"
                              : "Enable shortcut"
                          }
                        >
                          {shortcut.enabled ? (
                            <Power className="w-4 h-4" />
                          ) : (
                            <PowerOff className="w-4 h-4" />
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="font-medium text-[#c0caf5]">
                            {actionDisplayNames[shortcut.action]}
                          </div>
                          <div className="text-sm text-[#9aa5ce]">
                            {actionDescriptions[shortcut.action]}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {editingShortcut === shortcut.action ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={tempShortcut}
                            onChange={(e) => setTempShortcut(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="px-3 py-1 text-sm border border-[#414868] rounded bg-[#24283b] text-[#c0caf5] focus:ring-2 focus:ring-[#7aa2f7]/50 focus:border-transparent placeholder-[#565f89] transition-all duration-150"
                            placeholder="Press keys..."
                            autoFocus
                          />
                          <button
                            onClick={() =>
                              updateShortcut(shortcut.action, tempShortcut)
                            }
                            className="p-1 text-[#9ece6a] hover:text-[#9ece6a]/80 transition-colors"
                            title="Save shortcut"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 text-[#9aa5ce] hover:text-[#c0caf5] transition-colors"
                            title="Cancel editing"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              startEditing(shortcut.action, shortcut.shortcut)
                            }
                            className="px-3 py-1 text-sm font-mono bg-[#414868] border border-[#414868] rounded text-[#c0caf5] hover:bg-[#565f89] transition-all duration-150"
                          >
                            {shortcut.shortcut}
                          </button>
                          <button
                            onClick={() => resetToDefault(shortcut.action)}
                            className="px-2 py-1 text-xs text-[#9aa5ce] hover:text-[#c0caf5] border border-[#414868] rounded hover:bg-[#24283b] transition-all duration-150"
                            title="Reset to default"
                          >
                            Reset
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Keyboard Capture Instructions */}
        {editingShortcut && (
          <div className="mt-4 p-3 bg-[#e0af68]/10 border border-[#e0af68]/30 rounded-lg">
            <div className="text-sm text-[#c0caf5]">
              <strong>Editing mode:</strong> Press the key combination you want
              to use, or type it manually (e.g.,
              "CommandOrControl+Shift+Space").
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
