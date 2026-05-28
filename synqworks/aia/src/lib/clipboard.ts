// Environment-safe clipboard helpers for web preview and Tauri builds
import { isTauriEnvironment } from "./utils/tauri";

export async function readClipboardText(): Promise<string> {
  try {
    if (isTauriEnvironment()) {
      const mod = await import("@tauri-apps/plugin-clipboard-manager");
      return await mod.readText();
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
      return await navigator.clipboard.readText();
    }
  } catch {
    // ignore and fall through
  }
  return "";
}

export async function writeClipboardText(text: string): Promise<void> {
  try {
    if (isTauriEnvironment()) {
      const mod = await import("@tauri-apps/plugin-clipboard-manager");
      await mod.writeText(text);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // ignore; no-op if clipboard unavailable
  }
}
