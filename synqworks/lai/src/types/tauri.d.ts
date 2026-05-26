declare module "@tauri-apps/api" {
  export function invoke<T = any>(
    cmd: string,
    args?: Record<string, any>,
  ): Promise<T>;
}

declare module "@tauri-apps/plugin-clipboard-manager" {
  export function readText(): Promise<string>;
  export function writeText(text: string): Promise<void>;
}
