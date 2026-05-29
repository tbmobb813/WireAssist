import { useState, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../lib/stores/settingsStore";
import { useUiStore } from "../lib/stores/uiStore";
import { withErrorHandling } from "../lib/utils/errorHandler";
import {
  FileText,
  Activity,
  Keyboard,
  Monitor,
  Search,
  User,
  BarChart3,
} from "lucide-react";

// Lazy load heavy components to improve initial load time
const FileWatcherSettings = lazy(() => import("./FileWatcherSettings"));
const PerformanceDashboard = lazy(() => import("./PerformanceDashboard"));
const ShortcutSettings = lazy(() => import("./ShortcutSettings"));
const WindowPositionSettings = lazy(() => import("./WindowPositionSettings"));
const DocumentSearchModal = lazy(() => import("./DocumentSearchModal"));
const ProfileSettings = lazy(() => import("./ProfileSettings"));
const UsageAnalyticsDashboard = lazy(() => import("./UsageAnalyticsDashboard"));

type Props = {
  onClose?: () => void;
};

// Minimal settings panel focused on the global shortcut
export default function Settings({ onClose }: Props): JSX.Element {
  const { globalShortcut, setGlobalShortcut, theme, setTheme } =
    useSettingsStore();
  const addToast = useUiStore((s) => s.addToast);
  const [value, setValue] = useState<string>(globalShortcut);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showFileWatcherSettings, setShowFileWatcherSettings] = useState(false);
  const [showPerformanceDashboard, setShowPerformanceDashboard] =
    useState(false);
  const [showShortcutSettings, setShowShortcutSettings] = useState(false);
  const [showWindowPositionSettings, setShowWindowPositionSettings] =
    useState(false);
  const [showDocumentSearch, setShowDocumentSearch] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showUsageAnalytics, setShowUsageAnalytics] = useState(false);
  const [showLicensePanel, setShowLicensePanel] = useState(false);

  const validate = (s: string): string | null => {
    if (!s.trim()) return "Shortcut can't be empty";
    // very light validation: must contain a modifier and a key
    const hasModifier =
      /(Command|Control|Ctrl|Cmd|Alt|Option|Shift|Super|Meta)/i.test(s);
    const hasKey = /\+\s*[^+\s]+$/i.test(s);
    if (!hasModifier || !hasKey)
      return "Use format like CommandOrControl+Space or Ctrl+Shift+K";
    return null;
  };

  const onSave = async () => {
    const v = value.trim();
    const err = validate(v);
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);

    const result = await withErrorHandling(
      async () => {
        await setGlobalShortcut(v);
        setError(null);
        onClose?.();
      },
      "Settings.onSave",
      "Failed to save settings. Please try again.",
    );

    if (result === null) {
      // Error occurred - handled by withErrorHandling
      setError("Failed to save shortcut");
    } else {
      // Success - settings were saved
      addToast({
        message: "Settings saved successfully",
        type: "success",
        ttl: 2000,
      });
    }

    setSaving(false);
  };

  return (
    <div className="w-96 bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-700/60 rounded-xl shadow-2xl shadow-gray-500/10 dark:shadow-black/20 text-gray-900 dark:text-white overflow-hidden">
      {/* Modern Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800/50 dark:to-gray-700/50 px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">⚙️</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Settings
              </h2>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Configure your preferences
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-all duration-200"
              aria-label="Close settings"
              title="Close"
            >
              <span className="text-lg">✕</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Settings Content */}
      <div className="p-6 space-y-6">
        {/* Quick Settings Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center space-x-2">
            <span className="w-4 h-4 bg-blue-100 dark:bg-blue-900/50 rounded flex items-center justify-center">
              <span className="text-xs">⚡</span>
            </span>
            <span>Quick Settings</span>
          </h3>

          {/* Global Shortcut Setting */}
          <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
            <div className="space-y-3">
              <label
                htmlFor="global-shortcut-input"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Global Shortcut
              </label>
              <input
                id="global-shortcut-input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="CommandOrControl+Space"
                className="
                  w-full px-3 py-2
                  border border-gray-300 dark:border-gray-600
                  rounded-lg bg-white dark:bg-gray-800
                  text-sm text-gray-900 dark:text-white
                  placeholder-gray-500 dark:placeholder-gray-400
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  transition-all duration-200
                "
              />
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Examples: CommandOrControl+Space, Ctrl+Shift+K
              </p>
              {error && (
                <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                  {error}
                </p>
              )}
            </div>
          </div>

          {/* Theme Setting */}
          <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
            <div className="space-y-3">
              <label
                htmlFor="theme-select"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Appearance Theme
              </label>
              <select
                id="theme-select"
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="
                  w-full px-3 py-2
                  border border-gray-300 dark:border-gray-600
                  rounded-lg bg-white dark:bg-gray-800
                  text-sm text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  transition-all duration-200
                "
              >
                <option value="system">🖥️ System (Auto)</option>
                <option value="light">☀️ Light Mode</option>
                <option value="dark">🌙 Dark Mode</option>
              </select>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                System mode follows your OS dark mode preference
              </p>
            </div>
          </div>
        </div>

        {/* Advanced Settings Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center space-x-2">
            <span className="w-4 h-4 bg-purple-100 dark:bg-purple-900/50 rounded flex items-center justify-center">
              <span className="text-xs">🔧</span>
            </span>
            <span>Advanced Options</span>
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowProfileSettings(true)}
              className="
                group flex flex-col items-center p-4
                bg-white dark:bg-gray-800/50
                border border-gray-200 dark:border-gray-700
                rounded-lg shadow-sm
                hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600
                transition-all duration-200
                text-gray-700 dark:text-gray-300
              "
            >
              <User className="w-5 h-5 mb-2 text-blue-500 group-hover:text-blue-600" />
              <span className="text-xs font-medium text-center">
                Profile Settings
              </span>
            </button>

            <button
              onClick={() => setShowShortcutSettings(true)}
              className="
                group flex flex-col items-center p-4
                bg-white dark:bg-gray-800/50
                border border-gray-200 dark:border-gray-700
                rounded-lg shadow-sm
                hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600
                transition-all duration-200
                text-gray-700 dark:text-gray-300
              "
            >
              <Keyboard className="w-5 h-5 mb-2 text-green-500 group-hover:text-green-600" />
              <span className="text-xs font-medium text-center">Shortcuts</span>
            </button>

            <button
              onClick={() => setShowWindowPositionSettings(true)}
              className="
                group flex flex-col items-center p-4
                bg-white dark:bg-gray-800/50
                border border-gray-200 dark:border-gray-700
                rounded-lg shadow-sm
                hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600
                transition-all duration-200
                text-gray-700 dark:text-gray-300
              "
            >
              <Monitor className="w-5 h-5 mb-2 text-orange-500 group-hover:text-orange-600" />
              <span className="text-xs font-medium text-center">Window</span>
            </button>

            <button
              onClick={() => setShowFileWatcherSettings(true)}
              className="
                group flex flex-col items-center p-4
                bg-white dark:bg-gray-800/50
                border border-gray-200 dark:border-gray-700
                rounded-lg shadow-sm
                hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600
                transition-all duration-200
                text-gray-700 dark:text-gray-300
              "
            >
              <FileText className="w-5 h-5 mb-2 text-purple-500 group-hover:text-purple-600" />
              <span className="text-xs font-medium text-center">
                File Watcher
              </span>
            </button>

            <button
              onClick={() => setShowDocumentSearch(true)}
              className="
                group flex flex-col items-center p-4
                bg-white dark:bg-gray-800/50
                border border-gray-200 dark:border-gray-700
                rounded-lg shadow-sm
                hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600
                transition-all duration-200
                text-gray-700 dark:text-gray-300
              "
            >
              <Search className="w-5 h-5 mb-2 text-indigo-500 group-hover:text-indigo-600" />
              <span className="text-xs font-medium text-center">Search</span>
            </button>

            <button
              onClick={() => setShowPerformanceDashboard(true)}
              className="
                group flex flex-col items-center p-4
                bg-white dark:bg-gray-800/50
                border border-gray-200 dark:border-gray-700
                rounded-lg shadow-sm
                hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600
                transition-all duration-200
                text-gray-700 dark:text-gray-300
              "
            >
              <Activity className="w-5 h-5 mb-2 text-red-500 group-hover:text-red-600" />
              <span className="text-xs font-medium text-center">
                Performance
              </span>
            </button>
          </div>

          {/* License & API Keys - Special Highlight */}
          <button
            onClick={() => setShowLicensePanel(true)}
            className="
              w-full group flex items-center justify-center p-4
              bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20
              border border-amber-200 dark:border-amber-700
              rounded-lg shadow-sm
              hover:shadow-md hover:from-amber-100 hover:to-yellow-100 dark:hover:from-amber-900/30 dark:hover:to-yellow-900/30
              transition-all duration-200
              text-amber-700 dark:text-amber-300
            "
          >
            <span className="mr-3 text-lg">🔑</span>
            <span className="font-medium">License &amp; API Keys</span>
          </button>

          {/* Usage Analytics - Special Highlight */}
          <button
            onClick={() => setShowUsageAnalytics(true)}
            className="
              w-full group flex items-center justify-center p-4
              bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20
              border border-blue-200 dark:border-blue-700
              rounded-lg shadow-sm
              hover:shadow-md hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30
              transition-all duration-200
              text-blue-700 dark:text-blue-300
            "
          >
            <BarChart3 className="w-5 h-5 mr-3" />
            <span className="font-medium">Usage Analytics Dashboard</span>
          </button>
        </div>
      </div>

      {/* Action Footer */}
      <div className="bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-200/50 dark:border-gray-700/50 px-6 py-4">
        <div className="flex justify-end space-x-3">
          {onClose && (
            <button
              onClick={onClose}
              className="
                px-4 py-2 text-sm font-medium
                text-gray-700 dark:text-gray-300
                bg-white dark:bg-gray-800
                border border-gray-300 dark:border-gray-600
                rounded-lg
                hover:bg-gray-50 dark:hover:bg-gray-700
                transition-all duration-200
              "
            >
              Cancel
            </button>
          )}
          <button
            onClick={onSave}
            disabled={saving}
            className="
              px-4 py-2 text-sm font-medium
              bg-blue-600 hover:bg-blue-700
              disabled:opacity-50 disabled:cursor-not-allowed
              text-white rounded-lg
              transition-all duration-200
              flex items-center space-x-2
            "
            aria-label="Save"
          >
            {saving && (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
            )}
            <span>{saving ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </div>

      {/* Shortcut Settings Modal */}
      {showShortcutSettings && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowShortcutSettings(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Suspense
              fallback={
                <div className="w-96 bg-[#1a1b26] border border-[#414868] rounded-xl shadow-2xl p-6">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7aa2f7]"></div>
                    <span className="ml-2 text-[#9aa5ce]">
                      Loading shortcuts...
                    </span>
                  </div>
                </div>
              }
            >
              <ShortcutSettings
                onClose={() => setShowShortcutSettings(false)}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* Window Position Settings Modal */}
      {showWindowPositionSettings && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowWindowPositionSettings(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Suspense
              fallback={
                <div className="w-96 bg-[#1a1b26] border border-[#414868] rounded-xl shadow-2xl p-6">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7aa2f7]"></div>
                    <span className="ml-2 text-[#9aa5ce]">
                      Loading window settings...
                    </span>
                  </div>
                </div>
              }
            >
              <WindowPositionSettings
                onClose={() => setShowWindowPositionSettings(false)}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* File Watcher Settings Modal */}
      {showFileWatcherSettings && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowFileWatcherSettings(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Suspense
              fallback={
                <div className="w-96 bg-[#1a1b26] border border-[#414868] rounded-xl shadow-2xl p-6">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7aa2f7]"></div>
                    <span className="ml-2 text-[#9aa5ce]">
                      Loading file watcher...
                    </span>
                  </div>
                </div>
              }
            >
              <FileWatcherSettings
                onClose={() => setShowFileWatcherSettings(false)}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* Performance Dashboard Modal */}
      {showPerformanceDashboard && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowPerformanceDashboard(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Suspense
              fallback={
                <div className="w-96 bg-[#1a1b26] border border-[#414868] rounded-xl shadow-2xl p-6">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7aa2f7]"></div>
                    <span className="ml-2 text-[#9aa5ce]">
                      Loading performance dashboard...
                    </span>
                  </div>
                </div>
              }
            >
              <PerformanceDashboard
                onClose={() => setShowPerformanceDashboard(false)}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* Document Search Modal */}
      {showDocumentSearch && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowDocumentSearch(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Suspense
              fallback={
                <div className="w-96 bg-[#1a1b26] border border-[#414868] rounded-xl shadow-2xl p-6">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7aa2f7]"></div>
                    <span className="ml-2 text-[#9aa5ce]">
                      Loading document search...
                    </span>
                  </div>
                </div>
              }
            >
              <DocumentSearchModal
                onClose={() => setShowDocumentSearch(false)}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      {showProfileSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <Suspense
            fallback={
              <div className="w-96 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-2xl p-6">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    Loading profile settings...
                  </span>
                </div>
              </div>
            }
          >
            <ProfileSettings onClose={() => setShowProfileSettings(false)} />
          </Suspense>
        </div>
      )}

      {/* Usage Analytics Dashboard */}
      {showUsageAnalytics && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <Suspense
            fallback={
              <div className="w-96 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-2xl p-6">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    Loading usage analytics...
                  </span>
                </div>
              </div>
            }
          >
            <UsageAnalyticsDashboard
              onClose={() => setShowUsageAnalytics(false)}
            />
          </Suspense>
        </div>
      )}

      {/* License & API Keys Panel */}
      {showLicensePanel && (
        <LicensePanel onClose={() => setShowLicensePanel(false)} />
      )}
    </div>
  );
}

type LicensePanelProps = { onClose: () => void };

type LicenseStatus = {
  tier: string;
  status: string;
  customer_email?: string;
  activations_remaining?: number;
  verified_at?: string;
  expires_grace_at?: string;
};

function LicensePanel({ onClose }: LicensePanelProps) {
  const addToast = useUiStore((s) => s.addToast);

  const [anthropicKey, setAnthropicKey] = useState("");
  const [braveKey, setBraveKey] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [activating, setActivating] = useState(false);
  const [savingAnthropicKey, setSavingAnthropicKey] = useState(false);
  const [savingBraveKey, setSavingBraveKey] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  // Load status on mount
  useState(() => {
    invoke<LicenseStatus>("get_license_status")
      .then(setLicenseStatus)
      .catch(() => {});
  });

  const saveAnthropicKey = async () => {
    if (!anthropicKey.trim()) return;
    setSavingAnthropicKey(true);
    try {
      await invoke("set_api_key", { service: "anthropic", key: anthropicKey.trim() });
      addToast({ message: "Anthropic API key saved", type: "success", ttl: 2000 });
      setAnthropicKey("");
    } catch (e) {
      addToast({ message: `Failed to save key: ${e}`, type: "error", ttl: 3000 });
    } finally {
      setSavingAnthropicKey(false);
    }
  };

  const saveBraveKey = async () => {
    if (!braveKey.trim()) return;
    setSavingBraveKey(true);
    try {
      await invoke("set_api_key", { service: "brave", key: braveKey.trim() });
      addToast({ message: "Brave Search API key saved", type: "success", ttl: 2000 });
      setBraveKey("");
    } catch (e) {
      addToast({ message: `Failed to save key: ${e}`, type: "error", ttl: 3000 });
    } finally {
      setSavingBraveKey(false);
    }
  };

  const activateLicense = async () => {
    if (!licenseKey.trim()) return;
    setActivating(true);
    setActivateError(null);
    try {
      await invoke("verify_license", { key: licenseKey.trim() });
      addToast({ message: "License activated successfully", type: "success", ttl: 3000 });
      setLicenseKey("");
      const status = await invoke<LicenseStatus>("get_license_status");
      setLicenseStatus(status);
    } catch (e) {
      setActivateError(String(e));
    } finally {
      setActivating(false);
    }
  };

  const tierColor: Record<string, string> = {
    trial: "text-gray-500 dark:text-gray-400",
    solo: "text-blue-600 dark:text-blue-400",
    operator: "text-purple-600 dark:text-purple-400",
    workforce: "text-amber-600 dark:text-amber-400",
  };

  const tierLabel: Record<string, string> = {
    trial: "Trial",
    solo: "Solo",
    operator: "Operator",
    workforce: "Workforce",
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="w-[420px] bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-700/60 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-gray-800/50 dark:to-gray-700/50 px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">🔑</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">License &amp; API Keys</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400">Manage your keys and subscription</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-all duration-200"
          >
            <span className="text-lg">✕</span>
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Tier status */}
          <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-4 border border-gray-200/50 dark:border-gray-700/50">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Current Plan</p>
            {licenseStatus ? (
              <div className="flex items-center justify-between">
                <span className={`text-lg font-bold ${tierColor[licenseStatus.tier] ?? tierColor.trial}`}>
                  {tierLabel[licenseStatus.tier] ?? licenseStatus.tier}
                </span>
                {licenseStatus.expires_grace_at && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Valid until {new Date(licenseStatus.expires_grace_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
            )}
          </div>

          {/* Anthropic API Key */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Anthropic API Key
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Stored securely in your OS keyring. Leave blank to keep the existing key.
            </p>
            <div className="flex space-x-2">
              <input
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
              <button
                onClick={saveAnthropicKey}
                disabled={savingAnthropicKey || !anthropicKey.trim()}
                className="px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200"
              >
                {savingAnthropicKey ? "..." : "Save"}
              </button>
            </div>
          </div>

          {/* Brave Search API Key */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Brave Search API Key
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Required for the Research Agent. Stored securely in your OS keyring.
            </p>
            <div className="flex space-x-2">
              <input
                type="password"
                value={braveKey}
                onChange={(e) => setBraveKey(e.target.value)}
                placeholder="BSA..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
              <button
                onClick={saveBraveKey}
                disabled={savingBraveKey || !braveKey.trim()}
                className="px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200"
              >
                {savingBraveKey ? "..." : "Save"}
              </button>
            </div>
          </div>

          {/* License Key */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              License Key
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Enter your SynqWorks license key to unlock Solo, Operator, or Workforce features.
            </p>
            <div className="flex space-x-2">
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 font-mono"
              />
              <button
                onClick={activateLicense}
                disabled={activating || !licenseKey.trim()}
                className="px-3 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200"
              >
                {activating ? "..." : "Activate"}
              </button>
            </div>
            {activateError && (
              <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                {activateError}
              </p>
            )}
          </div>
        </div>

        <div className="bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-200/50 dark:border-gray-700/50 px-6 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
