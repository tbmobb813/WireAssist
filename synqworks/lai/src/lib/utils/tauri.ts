// src/lib/utils/tauri.ts
// Utilities for detecting and safely using Tauri APIs

/**
 * Check if we're running in a Tauri environment.
 * Returns false for web preview builds (Vite dev/preview).
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

/**
 * Lazily import and register a global shortcut only when in Tauri.
 * Returns true if registration succeeded, false otherwise.
 */
export async function registerGlobalShortcutSafe(
  shortcut: string,
  handler: () => void | Promise<void>,
): Promise<boolean> {
  if (!isTauriEnvironment()) {
    console.info(
      "Global shortcut registration skipped (not in Tauri environment)",
    );
    return false;
  }

  try {
    const { register } = await import("@tauri-apps/plugin-global-shortcut");
    await register(shortcut, handler);
    return true;
  } catch (e) {
    console.error("Failed to register global shortcut:", e);
    return false;
  }
}

/**
 * Lazily import and unregister all global shortcuts only when in Tauri.
 */
export async function unregisterAllShortcutsSafe(): Promise<void> {
  if (!isTauriEnvironment()) {
    return;
  }

  try {
    const { unregisterAll } = await import(
      "@tauri-apps/plugin-global-shortcut"
    );
    await unregisterAll();
  } catch {
    // ignore
  }
}

/**
 * Safely invoke a Tauri command with automatic environment detection.
 * Returns null if not in Tauri environment or on error.
 */
export async function invokeSafe<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T | null> {
  if (!isTauriEnvironment()) {
    return null;
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return (await invoke(cmd, args)) as T;
  } catch (e) {
    console.error(`invokeSafe(${cmd}) failed:`, e);
    return null;
  }
}

/**
 * Send a desktop notification in a safe, environment-aware way.
 * - In Tauri: uses @tauri-apps/plugin-notification (requests permission if needed)
 * - In web preview: uses the browser Notification API if available and permitted
 */
export async function notifySafe(title: string, body?: string): Promise<void> {
  try {
    if (isTauriEnvironment()) {
      const { isPermissionGranted, requestPermission, sendNotification } =
        await import("@tauri-apps/plugin-notification");

      let granted = await isPermissionGranted();
      if (!granted) {
        const perm = await requestPermission();
        granted = perm === "granted";
      }
      if (granted) {
        await sendNotification({ title, body });
      }
      return;
    }

    // Fallback for web preview
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      } else if (Notification.permission !== "denied") {
        const perm = await Notification.requestPermission();
        if (perm === "granted") new Notification(title, { body });
      }
    }
  } catch {
    // Non-fatal
    console.warn("notifySafe failed:");
  }
}
