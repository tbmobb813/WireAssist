// Mock for @tauri-apps/plugin-clipboard-manager
// Used in test environment where Tauri plugins are not available

export async function readText(): Promise<string> {
  // In test environment, use navigator.clipboard if available
  try {
    return await navigator.clipboard.readText();
  } catch {
    return "";
  }
}

export async function writeText(text: string): Promise<void> {
  // In test environment, use navigator.clipboard if available
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Silently fail in test environment
  }
}
