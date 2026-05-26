import {
  lazy,
  useEffect,
  useState,
  Suspense,
  startTransition,
  useCallback,
} from "react";
import ConversationList from "./components/ConversationList";
import ChatInterface from "./components/ChatInterface";
import ContextPanel from "./components/ContextPanel";
import CommandPalette from "./components/CommandPalette";
import KeyboardDebugger from "./components/KeyboardDebugger";
import ErrorMonitor from "./components/ErrorMonitor";
import { FadeIn, AnimatedButton } from "./components/Animations";
import { useKeyboardShortcuts, useCommandPalette } from "./lib/hooks";
import { database } from "./lib/api/database";
import Toaster from "./components/Toaster";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

// Lazy load heavy components to improve startup performance
const RunOutputModal = lazy(() => import("./components/RunOutputModal"));
const ExecutionAuditModal = lazy(
  () => import("./components/ExecutionAuditModal"),
);
const CommandSuggestionsModal = lazy(
  () => import("./components/CommandSuggestionsModal"),
);
const Settings = lazy(() => import("./components/SettingsTabs"));
const UpdateManager = lazy(() => import("./components/UpdateManager"));
const ProjectContextPanel = lazy(
  () => import("./components/ProjectContextPanel"),
);
const OnboardingTour = lazy(() => import("./components/OnboardingTour"));

import { useSettingsStore } from "./lib/stores/settingsStore";
import { useChatStore } from "./lib/stores/chatStore";
import { useProjectStore } from "./lib/stores/projectStore";
import { applyTheme, watchSystemTheme } from "./lib/utils/theme";
import { useUiStore } from "./lib/stores/uiStore";
import { useReviewStore } from "./lib/stores/reviewStore";
import { useLogStore } from "./lib/stores/logStore";
import { useMemoryStore } from "./lib/stores/memoryStore";
import { useBranchStore } from "./lib/stores/branchStore";
import { withErrorHandling } from "./lib/utils/errorHandler";
const CodeReviewPanel = lazy(() => import("./components/CodeReviewPanel"));
const LogViewerPanel = lazy(() => import("./components/LogViewerPanel"));
const MemoryViewer = lazy(() => import("./components/MemoryViewer"));
const BranchViewer = lazy(() => import("./components/BranchViewer"));

export default function App(): JSX.Element {
  const { loadSettings, registerGlobalShortcut, globalShortcut, theme } =
    useSettingsStore();
  const { events } = useProjectStore();
  const { createConversation } = useChatStore();
  const { toggleFocusMode } = useUiStore();

  // Command palette integration
  const { isOpen, open, close } = useCommandPalette();

  // Memoize callbacks to prevent recreating listeners on every render
  const handleCommandPalette = useCallback(() => {
    console.log("🎯 Opening Command Palette from App.tsx");
    open();
  }, [open]);

  const handleNewConversation = useCallback(() => {
    console.log("🎯 Creating new conversation from App.tsx");
    createConversation("New conversation", "gpt-4", "local");
  }, [createConversation]);

  const handleSettings = useCallback(() => {
    console.log("🎯 Opening settings from App.tsx");
    startTransition(() => setShowSettings(true));
  }, []);

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    onCommandPalette: handleCommandPalette,
    onNewConversation: handleNewConversation,
    onSettings: handleSettings,
  });

  // F11 for focus mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        toggleFocusMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFocusMode]);

  // Ctrl+Shift+B for branch viewer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "B") {
        e.preventDefault();
        useBranchStore.getState().toggleBranchViewer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    // Load settings on startup and register the global shortcut with error handling
    (async () => {
      await withErrorHandling(
        async () => {
          await loadSettings();
          await registerGlobalShortcut();
        },
        "App.initialization",
        "Failed to initialize application settings",
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Re-register when shortcut changes
    (async () => {
      try {
        await registerGlobalShortcut(globalShortcut);
      } catch (e) {
        console.error("rebind shortcut failed", e);
      }
    })();
  }, [globalShortcut, registerGlobalShortcut]);
  const [showSettings, setShowSettings] = useState(false);
  const [showProjectContext, setShowProjectContext] = useState(false);
  // Wire tray menu events: open settings and new conversation
  useEffect(() => {
    let unlistenSettings: (() => void) | undefined;
    let unlistenNew: (() => void) | undefined;
    let unlistenCliNotify: (() => void) | undefined;
    let unlistenCliAsk: (() => void) | undefined;
    let unlistenProject: (() => void) | undefined;
    (async () => {
      try {
        const mod = await import("@tauri-apps/api/event");
        // open settings
        unlistenSettings = await mod.listen("tray://open-settings", () => {
          setShowSettings(true);
        });
        // CLI notify
        unlistenCliNotify = await mod.listen<string>("cli://notify", (e) => {
          try {
            useUiStore.getState().addToast({
              message: e.payload || "",
              type: "info",
              ttl: 2000,
            });
          } catch { }
        });
        // CLI ask -> create/select conversation and send message
        unlistenCliAsk = await mod.listen<any>("cli://ask", async (e) => {
          try {
            let prompt = "";
            let targetModel: string | undefined;
            let targetProvider: string | undefined;
            let forceNew = false;

            if (typeof e.payload === "string") {
              prompt = (e.payload || "").trim();
            } else if (e.payload && typeof e.payload === "object") {
              const obj = e.payload as any;
              prompt = String(obj.prompt || obj.message || "").trim();
              targetModel = obj.model || undefined;
              // Bring window to front so the user sees the conversation
              try {
                const winMod = await import("@tauri-apps/api/webviewWindow");
                const w = winMod.getCurrentWebviewWindow();
                await w.show();
                await w.setFocus();
              } catch { }
              targetProvider = obj.provider || undefined;
              forceNew = !!obj.new;
            }
            if (!prompt) return;
            const chat = useChatStore.getState();
            let convo = chat.currentConversation;
            const settings = (
              await import("./lib/stores/settingsStore")
            ).useSettingsStore.getState();
            const model = targetModel || settings.defaultModel || "gpt-4";
            const provider =
              targetProvider || settings.defaultProvider || "local";
            if (!convo || forceNew) {
              const title = prompt.slice(0, 40) || "CLI Ask";
              try {
                await chat.createConversation(title, model, provider);
              } catch (err) {
                console.error(
                  "failed to create conversation from CLI ask",
                  err,
                );
                useUiStore.getState().addToast({
                  message: "Failed to start a conversation",
                  type: "error",
                  ttl: 1500,
                });
                return;
              }
            }
            try {
              await chat.sendMessage(prompt);
              useUiStore.getState().addToast({
                message: "Sent CLI prompt to chat",
                type: "success",
                ttl: 1200,
              });
            } catch (err) {
              console.error("failed to send CLI ask message", err);
              useUiStore.getState().addToast({
                message: "Failed to send CLI prompt",
                type: "error",
                ttl: 1500,
              });
            }
          } catch { }
        });
        // new conversation
        const createConversation = useChatStore.getState().createConversation;
        unlistenNew = await mod.listen("tray://new-conversation", async () => {
          try {
            await createConversation("New conversation", "gpt-4", "local");
          } catch (e) {
            console.error("failed to create conversation from tray", e);
          }
        });
        // project file events
        unlistenProject = await mod.listen<string[]>(
          "project://file-event",
          (e) => {
            const paths = e.payload || [];
            if (paths.length > 0) {
              // record paths to project store for context
              import("./lib/stores/projectStore").then((m) => {
                try {
                  m.useProjectStore.getState().addEvents(paths);
                } catch { }
              });
              useUiStore.getState().addToast({
                message: `Changed: ${paths[0]}`,
                type: "info",
                ttl: 1500,
              });
            }
          },
        );
      } catch {
        // running in web preview or tests where tauri event API isn't available
      }
    })();
    return () => {
      try {
        unlistenSettings && unlistenSettings();
        unlistenNew && unlistenNew();
        unlistenCliNotify && unlistenCliNotify();
        unlistenCliAsk && unlistenCliAsk();
        unlistenProject && unlistenProject();
      } catch { }
    };
  }, []);
  // Watch system theme if preference is 'system'
  useEffect(() => {
    if (theme !== "system") return;
    const addToast = useUiStore.getState().addToast;
    let mounted = false;
    // Ensure we apply immediately in case system changed while app was closed
    try {
      applyTheme("system");
    } catch { }
    const unwatch = watchSystemTheme(() => {
      applyTheme("system");
      // Avoid toasting on initial mount
      if (mounted) {
        addToast({
          message: "Theme updated from system",
          type: "info",
          ttl: 1500,
        });
      }
    });
    // Mark mounted after initial microtask
    Promise.resolve().then(() => {
      mounted = true;
    });
    return () => {
      try {
        unwatch && unwatch();
      } catch { }
    };
  }, [theme]);

  // Listen for DOM custom event from Command Palette to open Settings
  useEffect(() => {
    const handler = () => startTransition(() => setShowSettings(true));
    document.addEventListener("open-settings", handler as EventListener);
    return () =>
      document.removeEventListener("open-settings", handler as EventListener);
  }, []);

  // Keyboard shortcut: Ctrl+, toggles Settings panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setShowSettings((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <AppErrorBoundary>
      <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-white">
        {/* Conditionally render sidebar based on focus mode */}
        {!useUiStore((s) => s.focusMode) && <ConversationList />}
        <main className="flex-1 flex flex-col min-w-0 relative">
          {/* Modern Header Bar with Animations */}
          <FadeIn>
            <header
              className="
                bg-gradient-to-r from-blue-50/90 to-purple-50/90 dark:from-gray-900/90 dark:to-gray-800/90 backdrop-blur-xl
                border-b-2 border-blue-200/50 dark:border-purple-700/50
                px-6 py-4
                flex items-center justify-between
                relative z-30
                shadow-lg shadow-blue-500/10
              "
            >
              {/* Left side - App branding */}
              <div className="flex items-center space-x-4">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white hidden sm:block">
                  Linux AI Assistant
                </h1>
                <div className="text-xs text-gray-500 dark:text-gray-400 hidden md:block">
                  {useChatStore((state) => state.currentConversation?.title) ||
                    "No conversation"}
                </div>
                {/* Debug indicator: BRIGHT green pill that clearly shows palette state */}
                <div
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-xs font-bold shadow-lg transition-all duration-200 ${isOpen
                      ? "bg-green-500 text-white ring-2 ring-green-300"
                      : "bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    }`}
                  aria-live="polite"
                  aria-label={`Command palette is ${isOpen ? "open" : "closed"}`}
                >
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full animate-pulse ${isOpen ? "bg-white" : "bg-gray-500 dark:bg-gray-500"
                      }`}
                  />
                  <span className="tracking-wide">
                    CMD+K: {isOpen ? "OPEN" : "CLOSED"}
                  </span>
                </div>
              </div>

              {/* Center - Command Palette Trigger */}
              <div className="hidden md:flex">
                <AnimatedButton
                  onClick={open}
                  variant="primary"
                  size="sm"
                  className="!bg-gradient-to-r !from-blue-500 !to-purple-600 !text-white font-bold"
                >
                  🔍 Search (Alt+K or Ctrl+K)
                </AnimatedButton>
              </div>

              {/* Right side - Action buttons */}
              <div className="flex items-center space-x-2">
                {/* Code Review Mode Button */}
                <AnimatedButton
                  onClick={() => useReviewStore.getState().toggleReviewMode()}
                  variant={
                    useReviewStore((s) => s.isReviewMode)
                      ? "primary"
                      : "secondary"
                  }
                  size="sm"
                >
                  <span className="text-base">🔍</span>
                  <span className="hidden sm:inline ml-1">Review</span>
                </AnimatedButton>

                {/* Log Viewer Button */}
                <AnimatedButton
                  onClick={() => useLogStore.getState().toggleLogViewer()}
                  variant={
                    useLogStore((s) => s.isLogViewerOpen)
                      ? "primary"
                      : "secondary"
                  }
                  size="sm"
                >
                  <span className="text-base">📋</span>
                  <span className="hidden sm:inline ml-1">Logs</span>
                </AnimatedButton>

                {/* Memory Viewer Button */}
                <AnimatedButton
                  onClick={() => useMemoryStore.getState().toggleMemoryViewer()}
                  variant={
                    useMemoryStore((s) => s.isMemoryViewerOpen)
                      ? "primary"
                      : "secondary"
                  }
                  size="sm"
                >
                  <span className="text-base">🧠</span>
                  <span className="hidden sm:inline ml-1">Memory</span>
                </AnimatedButton>

                {/* Project Context Button */}
                <AnimatedButton
                  onClick={() => setShowProjectContext((s) => !s)}
                  variant={showProjectContext ? "primary" : "secondary"}
                  size="sm"
                >
                  <span className="text-base">📁</span>
                  <span className="hidden sm:inline ml-1">Context</span>
                  {events.filter(
                    (event) => Date.now() - event.ts < 5 * 60 * 1000,
                  ).length > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    )}
                </AnimatedButton>

                {/* Settings Button */}
                <AnimatedButton
                  onClick={() => setShowSettings((s) => !s)}
                  variant={showSettings ? "primary" : "secondary"}
                  size="sm"
                >
                  <span className="text-base">⚙️</span>
                  <span className="hidden sm:inline ml-1">Settings</span>
                </AnimatedButton>

                {/* Focus Mode Toggle Button */}
                <div title="Toggle Focus Mode (F11)">
                  <AnimatedButton
                    onClick={toggleFocusMode}
                    variant={
                      useUiStore((s) => s.focusMode) ? "primary" : "secondary"
                    }
                    size="sm"
                  >
                    <span className="text-base">
                      {useUiStore((s) => s.focusMode) ? "🎯" : "👁️"}
                    </span>
                    <span className="hidden sm:inline ml-1">Focus</span>
                  </AnimatedButton>
                </div>

                {/* Window Toggle Button */}
                <AnimatedButton
                  onClick={async () => {
                    try {
                      await database.window.toggle();
                    } catch (e) {
                      console.error("failed to toggle window", e);
                    }
                  }}
                  variant="secondary"
                  size="sm"
                >
                  <span className="text-base">🪟</span>
                  <span className="hidden lg:inline ml-1">Toggle</span>
                </AnimatedButton>
              </div>
            </header>
          </FadeIn>

          {/* Settings Panel */}
          {showSettings && (
            <Suspense fallback={null}>
              {/* Dim background overlay to avoid visual bleed-through */}
              <div
                className="fixed inset-0 z-40 bg-black/40"
                onClick={() => setShowSettings(false)}
              />
              <div className="absolute right-6 top-20 z-50 shadow-xl">
                <Settings onClose={() => setShowSettings(false)} />
              </div>
            </Suspense>
          )}

          {/* Project Context Panel */}
          {showProjectContext && (
            <Suspense fallback={null}>
              <div className="absolute right-6 top-20 z-50">
                <ProjectContextPanel
                  onClose={() => setShowProjectContext(false)}
                />
              </div>
            </Suspense>
          )}

          <div className="flex-1 flex overflow-hidden">
            <ChatInterface />
            <div className="w-80 flex-shrink-0">
              <ContextPanel />
            </div>
          </div>
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette isOpen={isOpen} onClose={close} />

      <Toaster />
      <ErrorMonitor />
      {/* Keyboard Debugger - Press F12 to toggle */}
      <KeyboardDebugger />
      <Suspense fallback={null}>
        <RunOutputModal />
        <ExecutionAuditModal />
        <CommandSuggestionsModal />
        <UpdateManager />
        <OnboardingTour />
        <CodeReviewPanel />
        <LogViewerPanel />
        <MemoryViewer />
        <BranchViewer />
      </Suspense>
    </AppErrorBoundary>
  );
}
