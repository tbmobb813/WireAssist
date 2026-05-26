// vitest globals (describe/it/expect/vi) are available in the test env

// Import the module under test after we set up/tear down global Tauri flag as
// needed per test.

describe("tauri utils (non-tauri and tauri branches)", () => {
  beforeEach(() => {
    // Ensure no tauri runtime by default
    // @ts-ignore
    delete (globalThis as any).window?.__TAURI__;
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("isTauriEnvironment returns false when no __TAURI__", async () => {
    const mod = await import("../lib/utils/tauri");
    expect(mod.isTauriEnvironment()).toBe(false);
  });

  it("registerGlobalShortcutSafe returns false when not in tauri", async () => {
    const mod = await import("../lib/utils/tauri");
    const res = await mod.registerGlobalShortcutSafe("Ctrl+K", async () => {});
    expect(res).toBe(false);
  });

  it("invokeSafe returns null when not in tauri", async () => {
    const mod = await import("../lib/utils/tauri");
    const v = await mod.invokeSafe("foo");
    expect(v).toBeNull();
  });

  it("notifySafe uses browser Notification when available and permission granted", async () => {
    // Provide a fake Notification constructor
    const called: Array<{ title: string; options: any }> = [];
    // @ts-ignore
    globalThis.Notification = function (title: string, options?: any) {
      called.push({ title, options });
    } as any;
    // @ts-ignore
    Notification.permission = "granted";

    const mod = await import("../lib/utils/tauri");
    await mod.notifySafe("hi", "body");

    expect(called.length).toBe(1);
    expect(called[0].title).toBe("hi");
  });

  it("registerGlobalShortcutSafe calls tauri plugin when __TAURI__ present", async () => {
    // Simulate tauri environment
    // @ts-ignore
    globalThis.window = globalThis.window || ({} as any);
    // @ts-ignore
    globalThis.window.__TAURI__ = {};

    const registerMock = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@tauri-apps/plugin-global-shortcut", () => ({
      register: registerMock,
    }));

    const mod = await import("../lib/utils/tauri");
    const res = await mod.registerGlobalShortcutSafe(
      "CmdOrCtrl+X",
      async () => {},
    );

    expect(res).toBe(true);
    expect(registerMock).toHaveBeenCalledWith(
      "CmdOrCtrl+X",
      expect.any(Function),
    );
  });

  it("invokeSafe calls tauri invoke when __TAURI__ present", async () => {
    // Simulate tauri environment
    // @ts-ignore
    globalThis.window = globalThis.window || ({} as any);
    // @ts-ignore
    globalThis.window.__TAURI__ = {};

    const invokeMock = vi.fn().mockResolvedValue("ok");
    vi.doMock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

    const mod = await import("../lib/utils/tauri");
    const v = await mod.invokeSafe("my_cmd", { a: 1 });
    expect(v).toBe("ok");
    expect(invokeMock).toHaveBeenCalledWith("my_cmd", { a: 1 });
  });

  it("notifySafe uses tauri plugin notification flow when in tauri", async () => {
    // Simulate tauri environment
    // @ts-ignore
    globalThis.window = globalThis.window || ({} as any);
    // @ts-ignore
    globalThis.window.__TAURI__ = {};

    const sendNotification = vi.fn().mockResolvedValue(undefined);
    const isPermissionGranted = vi.fn().mockResolvedValue(false);
    const requestPermission = vi.fn().mockResolvedValue("granted");

    vi.doMock("@tauri-apps/plugin-notification", () => ({
      isPermissionGranted,
      requestPermission,
      sendNotification,
    }));

    const mod = await import("../lib/utils/tauri");
    await mod.notifySafe("Tauri title", "tauri body");

    expect(isPermissionGranted).toHaveBeenCalled();
    expect(requestPermission).toHaveBeenCalled();
    expect(sendNotification).toHaveBeenCalledWith({
      title: "Tauri title",
      body: "tauri body",
    });
  });
});
import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => vi.resetModules());

describe("tauri utils invokeSafe and isTauriEnvironment", () => {
  it("invokeSafe returns null when not in Tauri", async () => {
    const { invokeSafe } = await import("../lib/utils/tauri");
    // ensure no __TAURI__ flag
    // @ts-ignore
    if (typeof window !== "undefined") delete (window as any).__TAURI__;

    const res = await invokeSafe("cmd");
    expect(res).toBeNull();
  });

  it("invokeSafe calls tauri invoke when in Tauri", async () => {
    // set __TAURI__ flag
    // @ts-ignore
    (global as any).window = (global as any).window || {};
    // @ts-ignore
    (window as any).__TAURI__ = {};

    // mock dynamic import of @tauri-apps/api/core
    vi.doMock("@tauri-apps/api/core", () => ({
      invoke: async (cmd: string) => `ok:${cmd}`,
    }));

    const { invokeSafe } = await import("../lib/utils/tauri");
    const res = await invokeSafe("mycmd", { a: 1 });
    expect(res).toBe("ok:mycmd");
  });
});
