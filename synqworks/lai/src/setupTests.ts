import { vi } from "vitest";
import "@testing-library/jest-dom";

// jsdom in the test environment doesn't implement scrollTo on elements by
// default; polyfill it so components that call `element.scrollTo(...)` won't
// throw during tests.
if (typeof window !== "undefined") {
  // window.scrollTo
  if (!window.scrollTo) {
    // @ts-ignore
    window.scrollTo = (_x?: number, _y?: number) => {
      /* noop for tests */
    };
  }
  // window.scrollBy
  if (!window.scrollBy) {
    // @ts-ignore
    window.scrollBy = (_optionsOrX?: any, _y?: number) => {
      /* noop for tests */
    };
  }
  // HTMLElement.prototype.scrollTo

  // @ts-ignore
  if (typeof (HTMLElement.prototype as any).scrollTo !== "function") {
    // @ts-ignore
    HTMLElement.prototype.scrollTo = function () {
      /* noop for tests */
    };
  }
  // HTMLElement.prototype.scrollBy

  // @ts-ignore
  if (typeof (HTMLElement.prototype as any).scrollBy !== "function") {
    // @ts-ignore
    HTMLElement.prototype.scrollBy = function () {
      /* noop for tests */
    };
  }
}

// Provide a basic navigator.clipboard mock so tests that call clipboard APIs
// don't fail in jsdom. Make `navigator` configurable so individual tests can
// override it if needed.
if (typeof globalThis.navigator === "undefined") {
  Object.defineProperty(globalThis, "navigator", {
    value: {},
    configurable: true,
    writable: true,
  });
}

if (!((globalThis as any).navigator as any).clipboard) {
  ((globalThis as any).navigator as any).clipboard = {
    writeText: vi.fn(async (_text: string) => Promise.resolve()),
    readText: vi.fn(async () => Promise.resolve("")),
  };
}

// Mock the Tauri core invoke API used in the frontend database wrapper so tests run in Node/jsdom
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, args?: any) => {
    // Basic noop mock that returns reasonable defaults for commands used by tests
    if (cmd === "get_all_conversations") return [];
    if (cmd === "get_conversation") return null;
    if (cmd === "create_conversation")
      return {
        id: "mock-c",
        title: args?.title || "mock",
        model: args?.model || "gpt",
        provider: args?.provider || "local",
        created_at: Date.now(),
        updated_at: Date.now(),
      };
    if (cmd === "get_conversation_messages") return [];
    // Settings
    if (cmd === "get_setting") return null;
    if (cmd === "set_setting") return null;
    if (cmd === "get_all_settings") return [];
    // Window
    if (cmd === "toggle_main_window") return null;
    return null;
  }),
}));

// Also mock the old path for backwards compatibility
vi.mock("@tauri-apps/api/tauri", () => ({
  invoke: vi.fn(async (cmd: string, args?: any) => {
    // Basic noop mock that returns reasonable defaults for commands used by tests
    if (cmd === "get_all_conversations") return [];
    if (cmd === "get_conversation") return null;
    if (cmd === "create_conversation")
      return {
        id: "mock-c",
        title: args?.title || "mock",
        model: args?.model || "gpt",
        provider: args?.provider || "local",
        created_at: Date.now(),
        updated_at: Date.now(),
      };
    if (cmd === "get_conversation_messages") return [];
    // Settings
    if (cmd === "get_setting") return null;
    if (cmd === "set_setting") return null;
    if (cmd === "get_all_settings") return [];
    // Window
    if (cmd === "toggle_main_window") return null;
    return null;
  }),
}));

// Mock the Tauri event API for listen functionality
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (_event: string, _cb: (e: any) => void) => {
    // Return an unlisten function
    return () => { };
  }),
}));

// Mock the global shortcut plugin to avoid errors during tests
vi.mock("@tauri-apps/plugin-global-shortcut", () => ({
  register: vi.fn(async (_shortcut: string, _cb: () => void) => {
    // no-op in tests
  }),
  unregisterAll: vi.fn(async () => {
    // no-op in tests
  }),
}));

// Provide a basic matchMedia mock for theme tests and components that rely on it
if (typeof window !== "undefined" && !window.matchMedia) {
  // @ts-ignore
  window.matchMedia = (query: string) => {
    const mql: MediaQueryList = {
      media: query,
      matches: false,
      onchange: null,
      addEventListener: function (
        _type: string,
        _listener: (this: MediaQueryList, ev: MediaQueryListEvent) => any,
      ) {
        // no-op
      },
      removeEventListener: function (
        _type: string,
        _listener: (this: MediaQueryList, ev: MediaQueryListEvent) => any,
      ) {
        // no-op
      },
      dispatchEvent: () => false,
      // legacy
      addListener: function (
        _listener: (this: MediaQueryList, ev: MediaQueryListEvent) => any,
      ) {
        // no-op
      },
      removeListener: function (
        _listener: (this: MediaQueryList, ev: MediaQueryListEvent) => any,
      ) {
        // no-op
      },
    } as unknown as MediaQueryList;
    return mql;
  };
}
