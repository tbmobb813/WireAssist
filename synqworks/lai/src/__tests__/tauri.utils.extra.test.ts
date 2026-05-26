import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => vi.resetModules());

describe("tauri utils (isTauriEnvironment / invokeSafe / notifySafe)", () => {
  it("invokeSafe returns null when not in Tauri", async () => {
    const { invokeSafe, isTauriEnvironment } = await import(
      "../lib/utils/tauri"
    );
    expect(isTauriEnvironment()).toBe(false);
    const res = await invokeSafe("some_cmd");
    expect(res).toBeNull();
  });

  it("notifySafe falls back to browser Notification when not in Tauri", async () => {
    // create a Notification constructor with static permission and requestPermission
    const spy = vi.fn();
    function NotificationConstructor(title: string, opts: any) {
      spy(title, opts);
    }
    // @ts-ignore
    NotificationConstructor.permission = "granted";
    // @ts-ignore
    NotificationConstructor.requestPermission = async () => "granted";
    // @ts-ignore
    global.window = global.window || {};
    // @ts-ignore
    global.window.Notification = NotificationConstructor as any;

    const { notifySafe } = await import("../lib/utils/tauri");
    await notifySafe("hi", "body");
    expect(spy).toHaveBeenCalledWith("hi", { body: "body" });
  });

  it("registerGlobalShortcutSafe returns false when not in Tauri", async () => {
    const { registerGlobalShortcutSafe } = await import("../lib/utils/tauri");
    const ok = await registerGlobalShortcutSafe("Ctrl+X", () => {});
    expect(ok).toBe(false);
  });
});
