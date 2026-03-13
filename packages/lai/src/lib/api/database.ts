// src/lib/api/database.ts
// Frontend API wrapper for Tauri commands

import { isTauriEnvironment } from "../utils/tauri";
import { getInvoke as getTauriInvoke } from "../tauri-shim";
import type {
  NewConversation,
  NewMessage,
  ApiConversation,
  ApiMessage,
  Setting,
  ApiTag,
  NewTag,
  ApiWorkspaceTemplate,
  NewWorkspaceTemplate,
} from "./types";
import { handleDatabaseError } from "../utils/errorHandler";

// Enhanced invoke wrapper with better error handling and recovery
async function callInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const startTime = Date.now();
  // Simple in-memory settings store for web preview to support tests
  // and allow basic persistence during a session.
  // Note: module scope ensures a single instance per page.
   
  const wps: any =
    (globalThis as any).__WEB_PREVIEW_SETTINGS__ ||
    ((globalThis as any).__WEB_PREVIEW_SETTINGS__ = {
      map: new Map<string, { value: string; updated_at: number }>(),
    });
  // Provide safe fallbacks when running in web preview (non-Tauri) so
  // the app can render and E2E tests can run without native backend.
  if (!isTauriEnvironment()) {
    switch (cmd) {
      // Conversations
      case "get_all_conversations":
        return [] as unknown as T;
      case "get_conversation":
        return null as unknown as T;
      case "create_conversation":
        return {
          id: `preview-${Date.now()}`,
          title: (args as any)?.title ?? "New conversation",
          created_at: Date.now(),
          updated_at: Date.now(),
          model: (args as any)?.model ?? "gpt-4",
          provider: (args as any)?.provider ?? "local",
        } as unknown as T;
      case "delete_conversation":
      case "update_conversation_title":
      case "restore_conversation":
        return undefined as unknown as T;
      case "create_conversation_branch":
        return {
          id: `preview-branch-${Date.now()}`,
          title: (args as any)?.title ?? "Branch conversation",
          created_at: Date.now(),
          updated_at: Date.now(),
          model: "gpt-4",
          provider: "local",
          parent_conversation_id: (args as any)?.parent_conversation_id,
          branch_point_message_id: (args as any)?.branch_point_message_id,
        } as unknown as T;
      case "get_conversation_branches":
        return [] as unknown as T;

      // Tags
      case "create_tag":
        return {
          id: `preview-tag-${Date.now()}`,
          name: (args as any)?.name ?? "New tag",
          color: (args as any)?.color,
          created_at: Date.now(),
          updated_at: Date.now(),
        } as unknown as T;
      case "get_tag":
      case "get_tag_by_name":
        return null as unknown as T;
      case "get_all_tags":
      case "search_tags":
      case "get_conversation_tags":
        return [] as unknown as T;
      case "update_tag":
      case "delete_tag":
      case "add_tag_to_conversation":
      case "remove_tag_from_conversation":
      case "add_tags_to_conversation_bulk":
        return undefined as unknown as T;
      case "get_conversations_by_tag":
        return [] as unknown as T;
      case "create_or_get_tag":
        return {
          id: `preview-tag-${Date.now()}`,
          name: (args as any)?.name ?? "New tag",
          color: (args as any)?.color,
          created_at: Date.now(),
          updated_at: Date.now(),
        } as unknown as T;

      // Messages
      case "get_conversation_messages":
      case "get_last_messages":
      case "search_messages":
        return [] as unknown as T;
      case "create_message":
        return {
          id: `preview-msg-${Date.now()}`,
          conversation_id: (args as any)?.conversation_id,
          role: (args as any)?.role ?? "user",
          content: (args as any)?.content ?? "",
          timestamp: Date.now(),
        } as unknown as T;
      case "delete_message":
      case "get_conversation_token_count":
        return 0 as unknown as T;

      // Settings
      case "set_setting": {
        const key = (args as any)?.key as string;
        const value = String((args as any)?.value ?? "");
        const updated_at = Date.now();
        wps.map.set(key, { value, updated_at });
        return undefined as unknown as T;
      }
      case "get_setting": {
        const key = (args as any)?.key as string;
        const entry = wps.map.get(key);
        return (entry ? entry.value : null) as unknown as T;
      }
      case "get_all_settings": {
        const items: Array<{ key: string; value: string; updated_at: number }> =
          [];
        wps.map.forEach(
          (v: { value: string; updated_at: number }, key: string) => {
            items.push({ key, value: v.value, updated_at: v.updated_at });
          },
        );
        return items as unknown as T;
      }

      // Workspace Templates
      case "create_workspace_template":
        return {
          id: `preview-template-${Date.now()}`,
          name: (args as any)?.template?.name ?? "New template",
          description: (args as any)?.template?.description,
          category: (args as any)?.template?.category ?? "General",
          default_model: (args as any)?.template?.default_model ?? "gpt-4",
          default_provider:
            (args as any)?.template?.default_provider ?? "local",
          system_prompt: (args as any)?.template?.system_prompt,
          settings_json: (args as any)?.template?.settings_json,
          ignore_patterns: (args as any)?.template?.ignore_patterns,
          file_extensions: (args as any)?.template?.file_extensions,
          context_instructions: (args as any)?.template?.context_instructions,
          created_at: Date.now(),
          updated_at: Date.now(),
          is_builtin: false,
        } as unknown as T;
      case "get_workspace_template":
        return null as unknown as T;
      case "get_all_workspace_templates":
      case "get_workspace_templates_by_category":
      case "search_workspace_templates":
        return [] as unknown as T;
      case "get_workspace_template_categories":
        return ["General", "React", "Python", "Rust", "DevOps"] as unknown as T;
      case "update_workspace_template":
      case "delete_workspace_template":
        return undefined as unknown as T;

      // Window
      case "toggle_main_window":
        return undefined as unknown as T;

      // Shortcuts (web preview fallback with default config)
      case "get_shortcut_config":
        return {
          shortcuts: [
            {
              action: "ToggleWindow",
              shortcut: "CommandOrControl+Space",
              enabled: true,
            },
            {
              action: "NewConversation",
              shortcut: "CommandOrControl+N",
              enabled: false,
            },
            {
              action: "OpenSettings",
              shortcut: "CommandOrControl+Comma",
              enabled: false,
            },
            {
              action: "QuickCapture",
              shortcut: "CommandOrControl+Shift+Space",
              enabled: false,
            },
            {
              action: "FocusInput",
              shortcut: "CommandOrControl+Shift+I",
              enabled: false,
            },
            {
              action: "ClearConversation",
              shortcut: "CommandOrControl+Delete",
              enabled: false,
            },
            {
              action: "ExportCurrent",
              shortcut: "CommandOrControl+E",
              enabled: false,
            },
            {
              action: "ToggleProfileMenu",
              shortcut: "CommandOrControl+P",
              enabled: false,
            },
            {
              action: "SearchDocuments",
              shortcut: "CommandOrControl+Shift+F",
              enabled: false,
            },
            {
              action: "ShowPerformance",
              shortcut: "CommandOrControl+Shift+P",
              enabled: false,
            },
            {
              action: "ToggleRecording",
              shortcut: "CommandOrControl+R",
              enabled: false,
            },
            {
              action: "QuickExport",
              shortcut: "CommandOrControl+Shift+E",
              enabled: false,
            },
          ],
        } as unknown as T;
      case "update_shortcut_config":
        // In web preview, just return success (changes won't persist)
        return undefined as unknown as T;
      case "validate_shortcut":
        // Accept any shortcut as valid in web preview
        return true as unknown as T;
      case "get_available_actions":
        return [
          "ToggleWindow",
          "NewConversation",
          "OpenSettings",
          "QuickCapture",
          "FocusInput",
          "ClearConversation",
          "ExportCurrent",
          "ToggleProfileMenu",
          "SearchDocuments",
          "ShowPerformance",
          "ToggleRecording",
          "QuickExport",
        ] as unknown as T;

      // Performance monitoring (web preview fallback with mock data)
      case "get_performance_metrics":
      case "get_full_performance_snapshot":
        return {
          system: {
            cpu_usage: 25.5,
            memory_usage: {
              total_memory: 16777216000,
              used_memory: 8388608000,
              available_memory: 8388608000,
              memory_percent: 50.0,
              total_swap: 4294967296,
              used_swap: 1073741824,
            },
            process_info: {
              pid: 12345,
              cpu_usage: 5.2,
              memory_usage: 150000000,
              thread_count: 12,
            },
            uptime: 86400,
            timestamp: Date.now(),
          },
          database: {
            conversation_count: 10,
            message_count: 150,
            database_size: 5242880,
          },
        } as unknown as T;
      case "get_database_metrics":
        return {
          conversation_count: 10,
          message_count: 150,
          database_size: 5242880,
        } as unknown as T;

      default:
        throw new Error(`Command '${cmd}' not available in web preview`);
    }
  }

  try {
    const invokeFn = await getTauriInvoke();
    if (!invokeFn) {
      throw new Error("Tauri invoke not available at runtime");
    }
    return await invokeFn<T>(cmd as any, args as any);
  } catch (e: any) {
    const msg = e?.message || (typeof e === "string" ? e : JSON.stringify(e));
    const error = new Error(`Database operation failed: ${cmd} - ${msg}`);

    // Add context about the operation
    (error as any).operation = cmd;
    (error as any).args = args;
    (error as any).duration = Date.now() - startTime;

    // Handle critical database errors
    if (msg.includes("database is locked") || msg.includes("disk I/O error")) {
      handleDatabaseError(error, `Database.${cmd}`);
      return null as unknown as T; // Return early for critical errors
    }

    throw error;
  }
}

export type Conversation = ApiConversation;
export type Message = ApiMessage;
export type Tag = ApiTag;
export type WorkspaceTemplate = ApiWorkspaceTemplate;

export const database = {
  // Conversation operations
  conversations: {
    create: async (data: NewConversation): Promise<Conversation> => {
      return callInvoke<Conversation>("create_conversation", {
        title: data.title,
        model: data.model,
        provider: data.provider,
        system_prompt: data.system_prompt,
      });
    },

    get: async (id: string): Promise<Conversation | null> => {
      return callInvoke<Conversation | null>("get_conversation", { id });
    },

    getAll: async (limit: number = 50): Promise<Conversation[]> => {
      return callInvoke<Conversation[]>("get_all_conversations", { limit });
    },

    updateTitle: async (id: string, title: string): Promise<void> => {
      return callInvoke<void>("update_conversation_title", { id, title });
    },

    delete: async (id: string): Promise<void> => {
      return callInvoke<void>("delete_conversation", { id });
    },
    restore: async (id: string): Promise<void> => {
      return callInvoke<void>("restore_conversation", { id });
    },

    search: async (
      query: string,
      limit: number = 20,
    ): Promise<Conversation[]> => {
      return callInvoke<Conversation[]>("search_conversations", {
        query,
        limit,
      });
    },

    // Conversation branching operations
    createBranch: async (
      parentConversationId: string,
      branchPointMessageId: string,
      title: string,
    ): Promise<Conversation> => {
      return callInvoke<Conversation>("create_conversation_branch", {
        parent_conversation_id: parentConversationId,
        branch_point_message_id: branchPointMessageId,
        title,
      });
    },

    getBranches: async (conversationId: string): Promise<Conversation[]> => {
      return callInvoke<Conversation[]>("get_conversation_branches", {
        conversation_id: conversationId,
      });
    },
  },
  // Window / app-level commands
  window: {
    toggle: async (): Promise<void> => {
      return callInvoke<void>("toggle_main_window");
    },

    saveState: async (): Promise<void> => {
      return callInvoke<void>("save_window_state");
    },

    restoreState: async (): Promise<void> => {
      return callInvoke<void>("restore_window_state");
    },

    getState: async () => {
      return callInvoke("get_window_state");
    },

    resetState: async (): Promise<void> => {
      return callInvoke<void>("reset_window_state");
    },
  },

  // Message operations
  messages: {
    create: async (data: NewMessage): Promise<Message> => {
      return callInvoke<Message>("create_message", {
        conversation_id: data.conversation_id,
        role: data.role,
        content: data.content,
        tokens_used: data.tokens_used,
      });
    },

    getByConversation: async (conversationId: string): Promise<Message[]> => {
      return callInvoke<Message[]>("get_conversation_messages", {
        conversation_id: conversationId,
      });
    },

    getLastN: async (conversationId: string, n: number): Promise<Message[]> => {
      return callInvoke<Message[]>("get_last_messages", {
        conversation_id: conversationId,
        n,
      });
    },

    search: async (query: string, limit: number = 50): Promise<Message[]> => {
      return callInvoke<Message[]>("search_messages", { query, limit });
    },

    delete: async (id: string): Promise<void> => {
      return callInvoke<void>("delete_message", { id });
    },

    update: async (id: string, data: { content: string }): Promise<void> => {
      return callInvoke<void>("update_message", { id, content: data.content });
    },

    getConversationTokenCount: async (conversationId: string): Promise<number> => {
      return callInvoke<number>("get_conversation_token_count", {
        conversation_id: conversationId,
      });
    },
  },

  // Settings operations
  settings: {
    set: async (key: string, value: string): Promise<void> => {
      return callInvoke<void>("set_setting", { key, value });
    },

    get: async (key: string): Promise<string | null> => {
      return callInvoke<string | null>("get_setting", { key });
    },

    getAll: async (): Promise<Setting[]> => {
      return callInvoke<Setting[]>("get_all_settings");
    },

    delete: async (key: string): Promise<void> => {
      return callInvoke<void>("delete_setting", { key });
    },

    // Convenience methods for JSON storage
    setJSON: async <T>(key: string, value: T): Promise<void> => {
      return callInvoke<void>("set_setting", {
        key,
        value: JSON.stringify(value),
      });
    },

    getJSON: async <T>(key: string): Promise<T | null> => {
      const value = await callInvoke<string | null>("get_setting", { key });
      return value ? JSON.parse(value) : null;
    },
  },

  // Performance monitoring
  performance: {
    getSystemMetrics: async () => {
      return callInvoke("get_performance_metrics");
    },

    getDatabaseMetrics: async () => {
      return callInvoke("get_database_metrics");
    },

    getFullSnapshot: async () => {
      return callInvoke("get_full_performance_snapshot");
    },
  },

  // Tags management
  tags: {
    create: async (data: NewTag): Promise<Tag> => {
      return callInvoke<Tag>("create_tag", {
        name: data.name,
        color: data.color,
      });
    },

    get: async (id: string): Promise<Tag | null> => {
      return callInvoke<Tag | null>("get_tag", { id });
    },

    getByName: async (name: string): Promise<Tag | null> => {
      return callInvoke<Tag | null>("get_tag_by_name", { name });
    },

    getAll: async (): Promise<Tag[]> => {
      return callInvoke<Tag[]>("get_all_tags");
    },

    search: async (query: string): Promise<Tag[]> => {
      return callInvoke<Tag[]>("search_tags", { query });
    },

    update: async (id: string, name: string, color?: string): Promise<void> => {
      return callInvoke<void>("update_tag", { id, name, color });
    },

    delete: async (id: string): Promise<void> => {
      return callInvoke<void>("delete_tag", { id });
    },

    // Conversation-tag associations
    getForConversation: async (conversationId: string): Promise<Tag[]> => {
      return callInvoke<Tag[]>("get_conversation_tags", {
        conversation_id: conversationId,
      });
    },

    addToConversation: async (
      conversationId: string,
      tagId: string,
    ): Promise<void> => {
      return callInvoke<void>("add_tag_to_conversation", {
        conversation_id: conversationId,
        tag_id: tagId,
      });
    },

    removeFromConversation: async (
      conversationId: string,
      tagId: string,
    ): Promise<void> => {
      return callInvoke<void>("remove_tag_from_conversation", {
        conversation_id: conversationId,
        tag_id: tagId,
      });
    },

    getConversationsByTag: async (tagId: string): Promise<string[]> => {
      return callInvoke<string[]>("get_conversations_by_tag", {
        tag_id: tagId,
      });
    },

    createOrGet: async (name: string, color?: string): Promise<Tag> => {
      return callInvoke<Tag>("create_or_get_tag", { name, color });
    },

    addBulkToConversation: async (
      conversationId: string,
      tagNames: string[],
    ): Promise<Tag[]> => {
      return callInvoke<Tag[]>("add_tags_to_conversation_bulk", {
        conversation_id: conversationId,
        tag_names: tagNames,
      });
    },
  },

  // Workspace Templates management
  workspaceTemplates: {
    create: async (data: NewWorkspaceTemplate): Promise<WorkspaceTemplate> => {
      return callInvoke<WorkspaceTemplate>("create_workspace_template", {
        template: data,
      });
    },

    get: async (id: string): Promise<WorkspaceTemplate | null> => {
      return callInvoke<WorkspaceTemplate | null>("get_workspace_template", {
        id,
      });
    },

    getAll: async (): Promise<WorkspaceTemplate[]> => {
      return callInvoke<WorkspaceTemplate[]>("get_all_workspace_templates");
    },

    getByCategory: async (category: string): Promise<WorkspaceTemplate[]> => {
      return callInvoke<WorkspaceTemplate[]>(
        "get_workspace_templates_by_category",
        { category },
      );
    },

    getCategories: async (): Promise<string[]> => {
      return callInvoke<string[]>("get_workspace_template_categories");
    },

    update: async (id: string, data: NewWorkspaceTemplate): Promise<void> => {
      return callInvoke<void>("update_workspace_template", {
        id,
        template: data,
      });
    },

    delete: async (id: string): Promise<void> => {
      return callInvoke<void>("delete_workspace_template", { id });
    },

    search: async (query: string): Promise<WorkspaceTemplate[]> => {
      return callInvoke<WorkspaceTemplate[]>("search_workspace_templates", {
        query,
      });
    },
  },

  // Shortcuts management
  shortcuts: {
    getConfig: async () => {
      return callInvoke("get_shortcut_config");
    },

    updateConfig: async (config: any) => {
      return callInvoke("update_shortcut_config", { config });
    },

    validateShortcut: async (shortcut: string) => {
      return callInvoke("validate_shortcut", { shortcut });
    },

    getAvailableActions: async () => {
      return callInvoke("get_available_actions");
    },
  },
};

/**
 * Export both Tauri database and helper to switch to core database
 */
export async function enableCoreDatabase() {
  try {
    const { setUseCoreDatabase } = await import("./database-hybrid");
    setUseCoreDatabase(true);
    console.log("[Database] Switched to @lia-code/core-backed database");
    return true;
  } catch (error) {
    console.error("[Database] Failed to enable core database:", error);
    return false;
  }
}

export function getCoreDatabase() {
  return import("./database-hybrid").then((m) => m.database);
}
