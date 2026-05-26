// A small runtime shim that dynamically loads the '@tauri-apps/api' modules
// so bundlers (Vite/Rollup) don't attempt to resolve them at build time.
// Export typed helpers that callers can import statically.

export type InvokeFn = <T = any>(cmd: string, args?: any) => Promise<T>;
export type ListenFn = (
  event: string,
  cb: (e: any) => void,
) => Promise<() => void>;

/**
 * Try to resolve and return Tauri's `invoke` at runtime. If not available (web build),
 * returns undefined.
 */
export async function getInvoke(): Promise<InvokeFn | undefined> {
  try {
    // In Tauri v2, invoke is directly from @tauri-apps/api
    const mod = await import("@tauri-apps/api");
    return mod.invoke as InvokeFn;
  } catch {
    return undefined;
  }
}

/**
 * Try to resolve and return Tauri's `listen` at runtime. If not available (web build),
 * returns undefined.
 */
export async function getListen(): Promise<ListenFn | undefined> {
  try {
    // In Tauri v2, event functions are from @tauri-apps/api/event
    const mod = await import("@tauri-apps/api/event");
    return mod.listen as ListenFn;
  } catch {
    return undefined;
  }
}

/** Convenience wrappers for callers who want to call invoke/listen directly. */
export async function invoke<T = any>(cmd: string, args?: any): Promise<T> {
  const fn = await getInvoke();
  if (!fn) throw new Error("Tauri `invoke` is not available in this runtime");
  return fn<T>(cmd, args);
}

export async function listen(
  event: string,
  cb: (e: any) => void,
): Promise<() => void> {
  const fn = await getListen();
  if (!fn) throw new Error("Tauri `listen` is not available in this runtime");
  return fn(event, cb);
}

// Synchronous safe-check helpers (for code paths that prefer not to await)
export function hasTauri(): boolean {
  try {
    // look for the tauri global - may be present in tauri runtime
    // We don't import anything here to avoid bundler resolution.

    // @ts-ignore
    return (
      typeof window !== "undefined" &&
      typeof (window as any).__TAURI__ !== "undefined"
    );
  } catch {
    return false;
  }
}

export default {
  getInvoke,
  getListen,
  invoke,
  listen,
  hasTauri,
};
