import * as clipboardMock from "../mocks/clipboard";

describe("mocks/clipboard", () => {
  // Save/restore any existing navigator.clipboard to avoid polluting other tests
  const originalClipboard = (globalThis as any).navigator?.clipboard;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // @ts-ignore
    if (originalClipboard) globalThis.navigator.clipboard = originalClipboard;
    else delete (globalThis as any).navigator?.clipboard;
  });

  it("readText returns text when navigator.clipboard.readText resolves", async () => {
    // @ts-ignore
    globalThis.navigator = globalThis.navigator || {};
    // @ts-ignore
    globalThis.navigator.clipboard = {
      readText: vi.fn().mockResolvedValue("hello"),
    };

    const text = await clipboardMock.readText();
    // @ts-ignore
    expect(globalThis.navigator.clipboard.readText).toHaveBeenCalled();
    expect(text).toBe("hello");
  });

  it("readText returns empty string when navigator.clipboard.readText throws", async () => {
    // @ts-ignore
    globalThis.navigator = globalThis.navigator || {};
    // @ts-ignore
    globalThis.navigator.clipboard = {
      readText: vi.fn().mockRejectedValue(new Error("denied")),
    };

    const text = await clipboardMock.readText();
    // @ts-ignore
    expect(globalThis.navigator.clipboard.readText).toHaveBeenCalled();
    expect(text).toBe("");
  });

  it("writeText calls navigator.clipboard.writeText when available", async () => {
    // @ts-ignore
    globalThis.navigator = globalThis.navigator || {};
    // @ts-ignore
    globalThis.navigator.clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };

    await expect(clipboardMock.writeText("x")).resolves.toBeUndefined();
    // @ts-ignore
    expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith("x");
  });

  it("writeText does not throw when navigator.clipboard.writeText rejects", async () => {
    // @ts-ignore
    globalThis.navigator = globalThis.navigator || {};
    // @ts-ignore
    globalThis.navigator.clipboard = {
      writeText: vi.fn().mockRejectedValue(new Error("denied")),
    };

    // Should not throw
    await expect(clipboardMock.writeText("y")).resolves.toBeUndefined();
    // @ts-ignore
    expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith("y");
  });
});
