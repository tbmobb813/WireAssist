import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => vi.resetModules());

describe("provider streaming via listen", () => {
  it("openai streaming path collects chunks and returns buffer", async () => {
    // mock tauri-shim where listen immediately emits chunks for the session
    vi.doMock("../lib/tauri-shim", () => ({
      getInvoke: async () => async (cmd: string) => {
        if (cmd === "provider_openai_stream") return "sess-123";
        return "";
      },
      getListen: async () => async (event: string, cb: Function) => {
        // simulate immediate streaming upon registration
        if (event === "provider-stream-chunk") {
          // call asynchronously so provider has time to set up unlisten variables
          setTimeout(
            () => cb({ payload: { session_id: "sess-123", chunk: "hello" } }),
            0,
          );
          setTimeout(
            () => cb({ payload: { session_id: "sess-123", chunk: " world" } }),
            0,
          );
        }
        if (event === "provider-stream-end") {
          setTimeout(() => cb({ payload: { session_id: "sess-123" } }), 0);
        }
        return () => {};
      },
      hasTauri: () => true,
    }));

    vi.doMock("../lib/stores/settingsStore", () => ({
      useSettingsStore: {
        getState: () => ({ defaultProvider: "openai", defaultModel: null }),
      },
    }));

    const { getProvider } = await import("../lib/providers/provider");
    const prov = getProvider();

    const chunks: string[] = [];
    const p = prov.generateResponse(
      "c-stream",
      [{ role: "user", content: "x" }],
      (c) => chunks.push(c),
    );

    // wait for provider to finish (it waits 200ms internally)
    await new Promise((r) => setTimeout(r, 250));

    const res = await p;
    expect(res).toBe("hello world");
    expect(chunks.join("")).toBe("hello world");
  });

  it("ollama streaming path collects chunks and returns buffer", async () => {
    vi.doMock("../lib/tauri-shim", () => ({
      getInvoke: async () => async (cmd: string) => {
        if (cmd === "provider_ollama_stream") return "sess-ollama";
        return "";
      },
      getListen: async () => async (event: string, cb: Function) => {
        // immediately emit the stream chunks for the ollama session
        if (event === "provider-stream-chunk") {
          setTimeout(
            () => cb({ payload: { session_id: "sess-ollama", chunk: "A" } }),
            0,
          );
          setTimeout(
            () => cb({ payload: { session_id: "sess-ollama", chunk: "B" } }),
            0,
          );
        }
        if (event === "provider-stream-end") {
          setTimeout(() => cb({ payload: { session_id: "sess-ollama" } }), 0);
        }
        return () => {};
      },
      hasTauri: () => true,
    }));

    vi.doMock("../lib/stores/settingsStore", () => ({
      useSettingsStore: {
        getState: () => ({ defaultProvider: "ollama", defaultModel: null }),
      },
    }));

    const { getProvider } = await import("../lib/providers/provider");
    const prov = getProvider();

    const chunks: string[] = [];
    const p = prov.generateResponse(
      "c-olla",
      [{ role: "user", content: "x" }],
      (c) => chunks.push(c),
    );

    await new Promise((r) => setTimeout(r, 250));
    const res = await p;
    expect(res).toBe("AB");
    expect(chunks.join("")).toBe("AB");
  });
});
