import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

describe("getProvider non-tauri and provider branches", () => {
  it("falls back to mockProvider when not running in Tauri", async () => {
    // mock tauri-shim: hasTauri false
    vi.doMock("../lib/tauri-shim", () => ({
      getInvoke: async () => undefined,
      getListen: async () => undefined,
      hasTauri: () => false,
    }));

    // mock mockProvider.generateResponse
    const mockGen = vi.fn().mockResolvedValue("mocked-response");
    vi.doMock("../lib/providers/mockProvider", () => ({
      mockProvider: { generateResponse: mockGen },
    }));

    // settings store
    vi.doMock("../lib/stores/settingsStore", () => ({
      useSettingsStore: {
        getState: () => ({ defaultProvider: "openai", defaultModel: null }),
      },
    }));

    const { getProvider } = await import("../lib/providers/provider");
    const prov = getProvider();
    const out = await prov.generateResponse("c1", [
      { role: "user", content: "hi" },
    ]);

    expect(out).toBe("mocked-response");
    expect(mockGen).toHaveBeenCalled();
  });

  it("anthropic provider streams tokens via onChunk", async () => {
    vi.doMock("../lib/tauri-shim", () => ({
      getInvoke: async () => async () => "hello world",
      getListen: async () => undefined,
      hasTauri: () => true,
    }));

    vi.doMock("../lib/stores/settingsStore", () => ({
      useSettingsStore: {
        getState: () => ({ defaultProvider: "anthropic", defaultModel: null }),
      },
    }));

    const { getProvider } = await import("../lib/providers/provider");
    const prov = getProvider();

    const chunks: string[] = [];
    const resPromise = prov.generateResponse(
      "c2",
      [{ role: "user", content: "hi" }],
      (c) => chunks.push(c),
    );

    // advance timers so internal delays resolve
    await new Promise((r) => setTimeout(r, 50));

    const res = await resPromise;
    expect(res).toBe("hello world");
    // onChunk should have been called with tokenized pieces (including spaces)
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("openai provider uses invoke generate when no streaming available", async () => {
    const invoked: any[] = [];
    vi.doMock("../lib/tauri-shim", () => ({
      getInvoke: async () => async (cmd: string) => {
        invoked.push(cmd);
        return "openai-result";
      },
      getListen: async () => undefined,
      hasTauri: () => true,
    }));

    vi.doMock("../lib/stores/settingsStore", () => ({
      useSettingsStore: {
        getState: () => ({ defaultProvider: "openai", defaultModel: null }),
      },
    }));

    const { getProvider } = await import("../lib/providers/provider");
    const prov = getProvider();
    const out = await prov.generateResponse("c3", [
      { role: "user", content: "hi" },
    ]);

    expect(out).toBe("openai-result");
    expect(invoked).toContain("provider_openai_generate");
  });
});
