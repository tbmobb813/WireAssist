// src/lib/stores/settingsStore.ts
// Zustand store for app settings

import { create } from "zustand";
import { database as db } from "../api/database";
import { useUiStore } from "./uiStore";
import {
  registerGlobalShortcutSafe,
  unregisterAllShortcutsSafe,
} from "../utils/tauri";
import { applyTheme } from "../utils/theme";

interface SettingsState {
  theme: "light" | "dark" | "system";
  defaultProvider: string;
  defaultModel: string;
  apiKeys: Record<string, string>;
  globalShortcut: string; // e.g., "CommandOrControl+Space"
  allowCodeExecution: boolean;
  projectRoot?: string | null;
  fileWatcherIgnorePatterns: string[]; // gitignore-style patterns
  budgetMonthly: number; // USD monthly budget for AI usage

  // Actions
  loadSettings: () => Promise<void>;
  setTheme: (theme: "light" | "dark" | "system") => Promise<void>;
  setDefaultProvider: (provider: string) => Promise<void>;
  setDefaultModel: (model: string) => Promise<void>;
  setApiKey: (provider: string, key: string) => Promise<void>;
  setGlobalShortcut: (shortcut: string) => Promise<void>;
  setAllowCodeExecution: (allow: boolean) => Promise<void>;
  registerGlobalShortcut: (shortcut?: string) => Promise<void>;
  setProjectRoot: (path: string) => Promise<void>;
  stopProjectWatch: () => Promise<void>;
  setFileWatcherIgnorePatterns: (patterns: string[]) => Promise<void>;
  setBudgetMonthly: (amount: number) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: "system",
  defaultProvider: "openai",
  defaultModel: "gpt-4",
  apiKeys: {},
  globalShortcut: "CommandOrControl+Space",
  allowCodeExecution: false,
  projectRoot: null,
  fileWatcherIgnorePatterns: [
    "node_modules/**",
    ".git/**",
    "target/**",
    "dist/**",
    "build/**",
    "*.log",
    ".DS_Store",
    "Thumbs.db",
  ],
  budgetMonthly: 20,

  loadSettings: async () => {
    try {
      const theme = await db.settings.get("theme");
      const defaultProvider = await db.settings.get("defaultProvider");
      const defaultModel = await db.settings.get("defaultModel");
      const apiKeys =
        await db.settings.getJSON<Record<string, string>>("apiKeys");
      const globalShortcut =
        (await db.settings.get("globalShortcut")) || "CommandOrControl+Space";
      const allowRaw = await db.settings.get("allowCodeExecution");
      const allowCodeExecution = allowRaw === "true";
      const projectRoot = (await db.settings.get("projectRoot")) || null;
      const ignorePatterns = await db.settings.getJSON<string[]>(
        "fileWatcherIgnorePatterns",
      );
      const budgetRaw = await db.settings.get("budgetMonthly");
      const budgetMonthly = budgetRaw ? parseFloat(budgetRaw) : 20;

      set({
        theme: (theme as any) || "system",
        defaultProvider: defaultProvider || "openai",
        defaultModel: defaultModel || "gpt-4",
        apiKeys: apiKeys || {},
        globalShortcut,
        allowCodeExecution,
        projectRoot,
        fileWatcherIgnorePatterns: ignorePatterns || [
          "node_modules/**",
          ".git/**",
          "target/**",
          "dist/**",
          "build/**",
          "*.log",
          ".DS_Store",
          "Thumbs.db",
        ],
        budgetMonthly,
      });
      try {
        applyTheme(((theme as any) || "system") as any);
      } catch { }
      // If a project root is set, attempt to start the watcher on launch (best-effort)
      if (projectRoot) {
        try {
          const { invokeSafe } = await import("../utils/tauri");
          const patterns = ignorePatterns || [
            "node_modules/**",
            ".git/**",
            "target/**",
            "dist/**",
            "build/**",
            "*.log",
            ".DS_Store",
            "Thumbs.db",
          ];
          await invokeSafe("set_project_root", {
            path: projectRoot,
            patterns,
          });
        } catch {
          // non-fatal
        }
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  },

  setTheme: async (theme) => {
    await db.settings.set("theme", theme);
    set({ theme });
    try {
      applyTheme(theme);
    } catch { }
  },

  setDefaultProvider: async (provider) => {
    await db.settings.set("defaultProvider", provider);
    set({ defaultProvider: provider });
  },

  setDefaultModel: async (model) => {
    await db.settings.set("defaultModel", model);
    set({ defaultModel: model });
  },

  setApiKey: async (provider, key) => {
    set((state) => {
      const newApiKeys = { ...state.apiKeys, [provider]: key };
      db.settings.setJSON("apiKeys", newApiKeys);
      return { apiKeys: newApiKeys };
    });
  },

  setGlobalShortcut: async (shortcut) => {
    // Persist
    await db.settings.set("globalShortcut", shortcut);
    set({ globalShortcut: shortcut });
    // Attempt to re-register immediately
    await useSettingsStore.getState().registerGlobalShortcut(shortcut);
  },

  setAllowCodeExecution: async (allow) => {
    try {
      await db.settings.set("allowCodeExecution", String(allow));
    } catch (e) {
      console.error("Failed to persist allowCodeExecution", e);
    }
    set({ allowCodeExecution: allow });
  },

  registerGlobalShortcut: async (shortcutOptional) => {
    const shortcut =
      shortcutOptional || useSettingsStore.getState().globalShortcut;
    // Unregister all first to avoid duplicate binds
    try {
      await unregisterAllShortcutsSafe();
    } catch {
      // ignore
    }
    try {
      const success = await registerGlobalShortcutSafe(shortcut, async () => {
        try {
          await db.window.toggle();
        } catch (err) {
          console.error("Failed to toggle window from shortcut:", err);
        }
      });
      if (success) {
        useUiStore.getState().addToast({
          message: `Global shortcut set to ${shortcut}`,
          type: "success",
          ttl: 2500,
        });
      }
    } catch (e) {
      console.error("Failed to register global shortcut:", e);
      useUiStore.getState().addToast({
        message: `Failed to register shortcut: ${shortcut}`,
        type: "error",
        ttl: 3500,
      });
    }
  },

  setProjectRoot: async (path: string) => {
    try {
      await db.settings.set("projectRoot", path);
      set({ projectRoot: path });
      const { invokeSafe } = await import("../utils/tauri");
      const { fileWatcherIgnorePatterns } = useSettingsStore.getState();
      await invokeSafe("set_project_root", {
        path,
        patterns: fileWatcherIgnorePatterns,
      });
      useUiStore.getState().addToast({
        message: "Watching project root",
        type: "success",
        ttl: 1400,
      });
    } catch {
      useUiStore.getState().addToast({
        message: "Failed to watch project root",
        type: "error",
        ttl: 1600,
      });
    }
  },

  stopProjectWatch: async () => {
    try {
      const { invokeSafe } = await import("../utils/tauri");
      await invokeSafe("stop_project_watch");
      set({ projectRoot: null });
      await db.settings.delete("projectRoot");
      useUiStore.getState().addToast({
        message: "Stopped watching project",
        type: "info",
        ttl: 1200,
      });
    } catch {
      useUiStore.getState().addToast({
        message: "Failed to stop watcher",
        type: "error",
        ttl: 1600,
      });
    }
  },

  setFileWatcherIgnorePatterns: async (patterns: string[]) => {
    try {
      await db.settings.setJSON("fileWatcherIgnorePatterns", patterns);
      set({ fileWatcherIgnorePatterns: patterns });

      // Update the watcher with new patterns if project is being watched
      const { projectRoot } = useSettingsStore.getState();
      if (projectRoot) {
        const { invokeSafe } = await import("../utils/tauri");
        await invokeSafe("update_ignore_patterns", { patterns });
      }

      useUiStore.getState().addToast({
        message: "Updated ignore patterns",
        type: "success",
        ttl: 1400,
      });
    } catch {
      useUiStore.getState().addToast({
        message: "Failed to update ignore patterns",
        type: "error",
        ttl: 1600,
      });
    }
  },

  setBudgetMonthly: async (amount: number) => {
    try {
      await db.settings.set("budgetMonthly", String(amount));
      set({ budgetMonthly: amount });
      useUiStore.getState().addToast({
        message: "Monthly budget updated",
        type: "success",
        ttl: 1500,
      });
    } catch {
      useUiStore.getState().addToast({
        message: "Failed to update budget",
        type: "error",
        ttl: 1600,
      });
    }
  },
}));
