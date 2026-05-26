import { useState, useMemo } from "react";
import { useSettingsStore } from "../lib/stores/settingsStore";
import { useUiStore } from "../lib/stores/uiStore";
import { useOnboardingStore } from "../lib/stores/onboardingStore";
import { withErrorHandling } from "../lib/utils/errorHandler";
import {
  Settings as SettingsIcon,
  Sparkles,
  Palette,
  Code,
  Search,
  X,
  Keyboard,
  Monitor,
  FileText,
  User,
  Activity,
  BarChart3,
  Rocket,
} from "lucide-react";
import { lazy, Suspense } from "react";

// Lazy load heavy components
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

type TabId = "general" | "models" | "appearance" | "advanced";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  { id: "general", label: "General", icon: <SettingsIcon size={16} /> },
  { id: "models", label: "Models", icon: <Sparkles size={16} /> },
  { id: "appearance", label: "Appearance", icon: <Palette size={16} /> },
  { id: "advanced", label: "Advanced", icon: <Code size={16} /> },
];

export default function SettingsTabs({ onClose }: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFileWatcherSettings, setShowFileWatcherSettings] = useState(false);
  const [showPerformanceDashboard, setShowPerformanceDashboard] =
    useState(false);
  const [showShortcutSettings, setShowShortcutSettings] = useState(false);
  const [showWindowPositionSettings, setShowWindowPositionSettings] =
    useState(false);
  const [showDocumentSearch, setShowDocumentSearch] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showUsageAnalytics, setShowUsageAnalytics] = useState(false);

  // Filter tabs and settings based on search query
  const filteredContent = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase();
    const matches: { tab: TabId; setting: string }[] = [];

    // Search keywords for each setting
    const searchMap: Record<TabId, string[]> = {
      general: [
        "shortcut",
        "global",
        "keyboard",
        "hotkey",
        "execution",
        "code",
      ],
      models: [
        "provider",
        "api",
        "key",
        "openai",
        "anthropic",
        "model",
        "gpt",
        "claude",
      ],
      appearance: ["theme", "dark", "light", "mode", "color", "ui"],
      advanced: [
        "profile",
        "shortcuts",
        "window",
        "position",
        "file",
        "watcher",
        "search",
        "performance",
        "analytics",
      ],
    };

    Object.entries(searchMap).forEach(([tab, keywords]) => {
      keywords.forEach((keyword) => {
        if (keyword.includes(query)) {
          matches.push({ tab: tab as TabId, setting: keyword });
        }
      });
    });

    return matches;
  }, [searchQuery]);

  return (
    <div className="w-[800px] h-[600px] bg-[#1a1b26] border border-[#414868] rounded-xl shadow-2xl shadow-black/40 text-[#c0caf5] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#24283b] to-[#1a1b26] px-6 py-4 border-b border-[#414868]/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#7aa2f7] rounded-lg flex items-center justify-center">
              <SettingsIcon className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#c0caf5]">Settings</h2>
              <p className="text-xs text-[#9aa5ce]">
                Configure your preferences
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[#9aa5ce] hover:text-[#c0caf5] hover:bg-[#24283b] transition-colors-smooth gpu-accelerated"
              aria-label="Close settings"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="mt-4 relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#565f89]"
            size={16}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings..."
            className="
              w-full pl-10 pr-4 py-2
              bg-[#24283b] border border-[#414868]
              rounded-lg text-sm text-[#c0caf5] placeholder-[#565f89]
              focus:outline-none focus:ring-2 focus:ring-[#7aa2f7] focus:border-transparent
              transition-all duration-150
            "
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#565f89] hover:text-[#c0caf5] transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Search Results Summary */}
        {filteredContent && filteredContent.length > 0 && (
          <div className="mt-2 text-xs text-[#9aa5ce]">
            Found {filteredContent.length} result
            {filteredContent.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Tabs + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tab Navigation */}
        {!searchQuery && (
          <div className="w-48 bg-[#1a1b26] border-r border-[#414868]/50 flex-shrink-0 overflow-y-auto">
            <div className="p-3 space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg
                    transition-all duration-150 gpu-accelerated
                    ${
                      activeTab === tab.id
                        ? "bg-[#7aa2f7] text-white shadow-md"
                        : "text-[#9aa5ce] hover:text-[#c0caf5] hover:bg-[#24283b]"
                    }
                  `}
                >
                  {tab.icon}
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto smooth-scroll">
          {searchQuery && filteredContent ? (
            <SearchResults
              results={filteredContent}
              onTabSelect={setActiveTab}
            />
          ) : (
            <div className="p-6">
              {activeTab === "general" && <GeneralTab />}
              {activeTab === "models" && <ModelsTab />}
              {activeTab === "appearance" && <AppearanceTab />}
              {activeTab === "advanced" && (
                <AdvancedTab
                  onShowProfileSettings={() => setShowProfileSettings(true)}
                  onShowShortcutSettings={() => setShowShortcutSettings(true)}
                  onShowWindowSettings={() =>
                    setShowWindowPositionSettings(true)
                  }
                  onShowFileWatcher={() => setShowFileWatcherSettings(true)}
                  onShowDocumentSearch={() => setShowDocumentSearch(true)}
                  onShowPerformance={() => setShowPerformanceDashboard(true)}
                  onShowUsageAnalytics={() => setShowUsageAnalytics(true)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showShortcutSettings && (
        <ModalWrapper onClose={() => setShowShortcutSettings(false)}>
          <ShortcutSettings onClose={() => setShowShortcutSettings(false)} />
        </ModalWrapper>
      )}
      {showWindowPositionSettings && (
        <ModalWrapper onClose={() => setShowWindowPositionSettings(false)}>
          <WindowPositionSettings
            onClose={() => setShowWindowPositionSettings(false)}
          />
        </ModalWrapper>
      )}
      {showFileWatcherSettings && (
        <ModalWrapper onClose={() => setShowFileWatcherSettings(false)}>
          <FileWatcherSettings
            onClose={() => setShowFileWatcherSettings(false)}
          />
        </ModalWrapper>
      )}
      {showDocumentSearch && (
        <ModalWrapper onClose={() => setShowDocumentSearch(false)}>
          <DocumentSearchModal onClose={() => setShowDocumentSearch(false)} />
        </ModalWrapper>
      )}
      {showProfileSettings && (
        <ModalWrapper onClose={() => setShowProfileSettings(false)}>
          <ProfileSettings onClose={() => setShowProfileSettings(false)} />
        </ModalWrapper>
      )}
      {showPerformanceDashboard && (
        <ModalWrapper onClose={() => setShowPerformanceDashboard(false)}>
          <PerformanceDashboard
            onClose={() => setShowPerformanceDashboard(false)}
          />
        </ModalWrapper>
      )}
      {showUsageAnalytics && (
        <ModalWrapper onClose={() => setShowUsageAnalytics(false)}>
          <UsageAnalyticsDashboard
            onClose={() => setShowUsageAnalytics(false)}
          />
        </ModalWrapper>
      )}
    </div>
  );
}

// Modal Wrapper with Suspense
function ModalWrapper({
  children,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <Suspense
        fallback={
          <div className="w-96 bg-[#1a1b26] border border-[#414868] rounded-xl shadow-2xl p-6">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#7aa2f7] border-t-transparent"></div>
              <span className="text-[#9aa5ce]">Loading...</span>
            </div>
          </div>
        }
      >
        {children}
      </Suspense>
    </div>
  );
}

// Search Results Component
function SearchResults({
  results,
  onTabSelect,
}: {
  results: { tab: TabId; setting: string }[];
  onTabSelect: (tab: TabId) => void;
}) {
  return (
    <div className="p-6 space-y-4">
      <h3 className="text-sm font-semibold text-[#c0caf5] mb-4">
        Search Results
      </h3>
      {results.map((result, idx) => (
        <button
          key={idx}
          onClick={() => onTabSelect(result.tab)}
          className="
            w-full p-4 text-left
            bg-[#24283b] border border-[#414868]
            rounded-lg hover:border-[#7aa2f7]
            transition-all duration-150 gpu-accelerated
          "
        >
          <div className="font-medium text-[#c0caf5] capitalize">
            {result.setting}
          </div>
          <div className="text-xs text-[#9aa5ce] mt-1">
            Found in: <span className="capitalize">{result.tab}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// General Tab
function GeneralTab() {
  const {
    globalShortcut,
    setGlobalShortcut,
    allowCodeExecution,
    setAllowCodeExecution,
    budgetMonthly,
    setBudgetMonthly,
  } = useSettingsStore();
  const addToast = useUiStore((s) => s.addToast);
  const [shortcutValue, setShortcutValue] = useState(globalShortcut);
  const [budgetValue, setBudgetValue] = useState(String(budgetMonthly));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validate = (s: string): string | null => {
    if (!s.trim()) return "Shortcut can't be empty";
    const hasModifier =
      /(Command|Control|Ctrl|Cmd|Alt|Option|Shift|Super|Meta)/i.test(s);
    const hasKey = /\+\s*[^+\s]+$/i.test(s);
    if (!hasModifier || !hasKey)
      return "Use format like CommandOrControl+Space or Ctrl+Shift+K";
    return null;
  };

  const onSave = async () => {
    const v = shortcutValue.trim();
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
      },
      "GeneralTab.onSave",
      "Failed to save shortcut",
    );

    if (result !== null) {
      addToast({ message: "Shortcut saved", type: "success", ttl: 2000 });
    } else {
      setError("Failed to save shortcut");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[#c0caf5] mb-4">
          General Settings
        </h3>

        {/* Global Shortcut */}
        <div className="bg-[#24283b] border border-[#414868] rounded-lg p-4 space-y-3">
          <label className="block text-sm font-medium text-[#c0caf5]">
            Global Shortcut
          </label>
          <div className="flex gap-2">
            <input
              value={shortcutValue}
              onChange={(e) => setShortcutValue(e.target.value)}
              placeholder="CommandOrControl+Space"
              className="
                flex-1 px-3 py-2
                bg-[#1a1b26] border border-[#414868]
                rounded-lg text-sm text-[#c0caf5] placeholder-[#565f89]
                focus:outline-none focus:ring-2 focus:ring-[#7aa2f7] focus:border-transparent
                transition-all duration-150
              "
            />
            <button
              onClick={onSave}
              disabled={saving}
              className="
                px-4 py-2 bg-[#7aa2f7] hover:bg-[#7aa2f7]/90
                disabled:opacity-50 disabled:cursor-not-allowed
                text-white rounded-lg text-sm font-medium
                transition-all duration-150 gpu-accelerated
              "
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
          <p className="text-xs text-[#9aa5ce]">
            Examples: CommandOrControl+Space, Ctrl+Shift+K
          </p>
          {error && (
            <p className="text-xs text-[#f7768e] bg-[#f7768e]/10 px-2 py-1 rounded">
              {error}
            </p>
          )}
        </div>

        {/* Code Execution */}
        <div className="mt-4 bg-[#24283b] border border-[#414868] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-[#c0caf5]">
                Allow Code Execution
              </label>
              <p className="text-xs text-[#9aa5ce] mt-1">
                Enable AI to run code snippets in your environment
              </p>
            </div>
            <button
              onClick={() => setAllowCodeExecution(!allowCodeExecution)}
              className={`
                relative w-12 h-6 rounded-full transition-colors duration-200
                ${allowCodeExecution ? "bg-[#7aa2f7]" : "bg-[#414868]"}
              `}
            >
              <div
                className={`
                  absolute top-1 left-1 w-4 h-4 bg-white rounded-full
                  transition-transform duration-200
                  ${allowCodeExecution ? "translate-x-6" : "translate-x-0"}
                `}
              />
            </button>
          </div>
        </div>

        {/* Monthly Budget */}
        <div className="mt-4 bg-[#24283b] border border-[#414868] rounded-lg p-4 space-y-3">
          <label className="block text-sm font-medium text-[#c0caf5]">
            Monthly Budget (USD)
          </label>
          <p className="text-xs text-[#9aa5ce]">
            Set a monthly spending limit for AI usage. You'll get alerts when
            approaching or exceeding this amount.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="1"
              value={budgetValue}
              onChange={(e) => setBudgetValue(e.target.value)}
              placeholder="20"
              className="
                flex-1 px-3 py-2
                bg-[#1a1b26] border border-[#414868]
                rounded-lg text-sm text-[#c0caf5] placeholder-[#565f89]
                focus:outline-none focus:ring-2 focus:ring-[#7aa2f7] focus:border-transparent
                transition-all duration-150
              "
            />
            <button
              onClick={async () => {
                const amount = parseFloat(budgetValue);
                if (isNaN(amount) || amount < 0) {
                  addToast({
                    message: "Please enter a valid amount",
                    type: "error",
                    ttl: 2000,
                  });
                  return;
                }
                await setBudgetMonthly(amount);
              }}
              className="
                px-4 py-2 bg-[#7aa2f7] hover:bg-[#7aa2f7]/90
                text-white rounded-lg text-sm font-medium
                transition-all duration-150 gpu-accelerated
              "
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Models Tab
function ModelsTab() {
  const {
    defaultProvider,
    setDefaultProvider,
    defaultModel,
    setDefaultModel,
    apiKeys,
    setApiKey,
  } = useSettingsStore();
  const addToast = useUiStore((s) => s.addToast);
  const [selectedProvider, setSelectedProvider] = useState(defaultProvider);
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [apiKeyValue, setApiKeyValue] = useState("");

  const providers = ["openai", "anthropic", "google", "local"];
  const models: Record<string, string[]> = {
    openai: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
    anthropic: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
    google: ["gemini-pro", "gemini-pro-vision"],
    local: ["local-model"],
  };

  const saveSettings = async () => {
    await setDefaultProvider(selectedProvider);
    await setDefaultModel(selectedModel);
    if (apiKeyValue) {
      await setApiKey(selectedProvider, apiKeyValue);
    }
    addToast({ message: "Model settings saved", type: "success", ttl: 2000 });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-[#c0caf5]">
        Model Configuration
      </h3>

      {/* Provider Selection */}
      <div className="bg-[#24283b] border border-[#414868] rounded-lg p-4 space-y-3">
        <label className="block text-sm font-medium text-[#c0caf5]">
          Default Provider
        </label>
        <select
          value={selectedProvider}
          onChange={(e) => {
            setSelectedProvider(e.target.value);
            setSelectedModel(models[e.target.value][0]);
          }}
          className="
            w-full px-3 py-2
            bg-[#1a1b26] border border-[#414868]
            rounded-lg text-sm text-[#c0caf5]
            focus:outline-none focus:ring-2 focus:ring-[#7aa2f7] focus:border-transparent
            transition-all duration-150
          "
        >
          {providers.map((provider) => (
            <option key={provider} value={provider} className="capitalize">
              {provider}
            </option>
          ))}
        </select>
      </div>

      {/* Model Selection */}
      <div className="bg-[#24283b] border border-[#414868] rounded-lg p-4 space-y-3">
        <label className="block text-sm font-medium text-[#c0caf5]">
          Default Model
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="
            w-full px-3 py-2
            bg-[#1a1b26] border border-[#414868]
            rounded-lg text-sm text-[#c0caf5]
            focus:outline-none focus:ring-2 focus:ring-[#7aa2f7] focus:border-transparent
            transition-all duration-150
          "
        >
          {models[selectedProvider]?.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      {/* API Key */}
      <div className="bg-[#24283b] border border-[#414868] rounded-lg p-4 space-y-3">
        <label className="block text-sm font-medium text-[#c0caf5]">
          API Key for {selectedProvider}
        </label>
        <input
          type="password"
          value={apiKeyValue || apiKeys[selectedProvider] || ""}
          onChange={(e) => setApiKeyValue(e.target.value)}
          placeholder="sk-..."
          className="
            w-full px-3 py-2
            bg-[#1a1b26] border border-[#414868]
            rounded-lg text-sm text-[#c0caf5] placeholder-[#565f89]
            focus:outline-none focus:ring-2 focus:ring-[#7aa2f7] focus:border-transparent
            transition-all duration-150
          "
        />
        <p className="text-xs text-[#9aa5ce]">
          Your API key is stored locally and never sent to our servers
        </p>
      </div>

      <button
        onClick={saveSettings}
        className="
          w-full px-4 py-2 bg-[#7aa2f7] hover:bg-[#7aa2f7]/90
          text-white rounded-lg text-sm font-medium
          transition-all duration-150 gpu-accelerated
        "
      >
        Save Model Settings
      </button>
    </div>
  );
}

// Appearance Tab
function AppearanceTab() {
  const { theme, setTheme } = useSettingsStore();
  const addToast = useUiStore((s) => s.addToast);

  const handleThemeChange = async (newTheme: "light" | "dark" | "system") => {
    await setTheme(newTheme);
    addToast({ message: "Theme updated", type: "success", ttl: 2000 });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-[#c0caf5]">
        Appearance Settings
      </h3>

      {/* Theme Selection */}
      <div className="bg-[#24283b] border border-[#414868] rounded-lg p-4 space-y-3">
        <label className="block text-sm font-medium text-[#c0caf5]">
          Theme
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: "light", label: "Light", icon: "☀️" },
            { value: "dark", label: "Dark", icon: "🌙" },
            { value: "system", label: "System", icon: "🖥️" },
          ].map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => handleThemeChange(value as any)}
              className={`
                p-4 rounded-lg border-2 transition-all duration-150 gpu-accelerated
                ${
                  theme === value
                    ? "border-[#7aa2f7] bg-[#7aa2f7]/10"
                    : "border-[#414868] hover:border-[#565f89]"
                }
              `}
            >
              <div className="text-2xl mb-2">{icon}</div>
              <div className="text-sm font-medium text-[#c0caf5]">{label}</div>
            </button>
          ))}
        </div>
        <p className="text-xs text-[#9aa5ce]">
          System mode follows your OS dark mode preference
        </p>
      </div>
    </div>
  );
}

// Advanced Tab
function AdvancedTab({
  onShowProfileSettings,
  onShowShortcutSettings,
  onShowWindowSettings,
  onShowFileWatcher,
  onShowDocumentSearch,
  onShowPerformance,
  onShowUsageAnalytics,
}: {
  onShowProfileSettings: () => void;
  onShowShortcutSettings: () => void;
  onShowWindowSettings: () => void;
  onShowFileWatcher: () => void;
  onShowDocumentSearch: () => void;
  onShowPerformance: () => void;
  onShowUsageAnalytics: () => void;
}) {
  const advancedOptions = [
    {
      icon: <User size={16} />,
      label: "Profile Settings",
      color: "blue",
      onClick: onShowProfileSettings,
    },
    {
      icon: <Keyboard size={16} />,
      label: "Shortcuts",
      color: "green",
      onClick: onShowShortcutSettings,
    },
    {
      icon: <Monitor size={16} />,
      label: "Window Position",
      color: "orange",
      onClick: onShowWindowSettings,
    },
    {
      icon: <FileText size={16} />,
      label: "File Watcher",
      color: "purple",
      onClick: onShowFileWatcher,
    },
    {
      icon: <Search size={16} />,
      label: "Document Search",
      color: "indigo",
      onClick: onShowDocumentSearch,
    },
    {
      icon: <Activity size={16} />,
      label: "Performance",
      color: "red",
      onClick: onShowPerformance,
    },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-[#c0caf5]">Advanced Options</h3>

      <div className="grid grid-cols-2 gap-3">
        {advancedOptions.map((option, idx) => (
          <button
            key={idx}
            onClick={option.onClick}
            className="
              group flex items-center p-4
              bg-[#24283b] border border-[#414868]
              rounded-lg hover:border-[#7aa2f7]
              transition-all duration-150 gpu-accelerated
            "
          >
            <div className="text-[#7aa2f7] mr-3">{option.icon}</div>
            <span className="text-sm font-medium text-[#c0caf5]">
              {option.label}
            </span>
          </button>
        ))}
      </div>

      {/* Usage Analytics - Special Highlight */}
      <button
        onClick={onShowUsageAnalytics}
        className="
          w-full flex items-center justify-center p-4
          bg-gradient-to-r from-[#7aa2f7]/20 to-[#bb9af7]/20
          border border-[#7aa2f7]
          rounded-lg hover:from-[#7aa2f7]/30 hover:to-[#bb9af7]/30
          transition-all duration-150 gpu-accelerated
        "
      >
        <BarChart3 className="text-[#7aa2f7] mr-3" size={16} />
        <span className="text-sm font-medium text-[#c0caf5]">
          Usage Analytics Dashboard
        </span>
      </button>

      {/* Replay Onboarding Tour */}
      <button
        onClick={() => {
          useOnboardingStore.getState().resetTour();
          useUiStore.getState().addToast({
            message: "Onboarding tour restarted!",
            type: "success",
            ttl: 2000,
          });
        }}
        className="
          w-full flex items-center justify-center p-4
          bg-gradient-to-r from-[#9ece6a]/20 to-[#73daca]/20
          border border-[#9ece6a]
          rounded-lg hover:from-[#9ece6a]/30 hover:to-[#73daca]/30
          transition-all duration-150 gpu-accelerated
        "
      >
        <Rocket className="text-[#9ece6a] mr-3" size={16} />
        <span className="text-sm font-medium text-[#c0caf5]">
          Replay Onboarding Tour
        </span>
      </button>
    </div>
  );
}
