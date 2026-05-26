import { describe, it, expect, vi, beforeEach } from "vitest";

describe("database API - web preview and Tauri error handling", () => {
  beforeEach(() => {
    // Ensure module cache is clear so we can mock per-test
    vi.resetModules();
  });

  it("returns web-preview defaults when not in Tauri", async () => {
    // Import the real module (isTauriEnvironment will be false in test env)
    const { database } = await import("../lib/api/database");

    const all = await database.conversations.getAll();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBe(0);

    const created = await database.conversations.create({
      title: "Hello",
      model: "gpt-4",
      provider: "local",
      system_prompt: "",
    });
    expect(created).toHaveProperty("id");
    expect(String(created.id)).toMatch(/^preview-/);

    const msg = await database.messages.create({
      conversation_id: "conv-1",
      role: "user",
      content: "hi",
      tokens_used: 0,
    });
    expect(String(msg.id)).toMatch(/^preview-msg-/);

    // settings set/get
    await database.settings.set("k1", "v1");
    const v = await database.settings.get("k1");
    expect(v).toBe("v1");

    // json helpers
    await database.settings.setJSON("json-key", { a: 1 });
    const parsed = await database.settings.getJSON("json-key");
    expect(parsed).toEqual({ a: 1 });
  });

  it("calls handleDatabaseError and returns null for critical DB errors in Tauri", async () => {
    // Mock Tauri environment + getInvoke that throws a critical message
    vi.doMock("../lib/utils/tauri", () => ({
      isTauriEnvironment: () => true,
    }));

    const handleDb = vi.fn();
    vi.doMock("../lib/utils/errorHandler", () => ({
      handleDatabaseError: handleDb,
    }));

    vi.doMock("../lib/tauri-shim", () => ({
      getInvoke: async () => {
        return async () => {
          throw new Error("database is locked: busy");
        };
      },
    }));

    const { database } = await import("../lib/api/database");

    const res = await database.conversations.getAll();
    // callInvoke should catch the critical error, call handleDatabaseError, and return null
    expect(res).toBeNull();
    expect(handleDb).toHaveBeenCalled();
  });

  it("rethrows non-critical errors from Tauri invoke with Database operation prefix", async () => {
    vi.doMock("../lib/utils/tauri", () => ({
      isTauriEnvironment: () => true,
    }));

    vi.doMock("../lib/tauri-shim", () => ({
      getInvoke: async () => {
        return async () => {
          throw new Error("something went wrong");
        };
      },
    }));

    const { database } = await import("../lib/api/database");

    await expect(database.conversations.getAll()).rejects.toThrow(
      /Database operation failed: get_all_conversations/,
    );
  });
});
