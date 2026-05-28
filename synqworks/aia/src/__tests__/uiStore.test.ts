// vitest globals available (describe/it/expect/vi)
import { beforeEach, afterEach } from "vitest";

beforeEach(() => {
  // Ensure a clean module cache so Zustand stores are fresh per test
  vi.resetModules();
  vi.restoreAllMocks();
});

afterEach(() => {
  try {
    vi.useRealTimers();
  } catch {}
});

describe("uiStore basic flows", () => {
  it("addToast and removeToast work", async () => {
    const mod = await import("../lib/stores/uiStore");
    const { useUiStore } = mod;

    const id = useUiStore.getState().addToast({ message: "hi", type: "info" });
    const state1 = useUiStore.getState();
    expect(state1.toasts.find((t) => t.id === id)).toBeTruthy();

    useUiStore.getState().removeToast(id);
    const state2 = useUiStore.getState();
    expect(state2.toasts.find((t) => t.id === id)).toBeUndefined();
  });

  it("addToast with ttl auto-removes after ttl", async () => {
    vi.useFakeTimers();
    const mod = await import("../lib/stores/uiStore");
    const { useUiStore } = mod;

    const id = useUiStore.getState().addToast({ message: "temp", ttl: 100 });
    expect(useUiStore.getState().toasts.some((t) => t.id === id)).toBe(true);

    // advance timers past ttl
    vi.advanceTimersByTime(150);
    // allow any pending microtasks
    await Promise.resolve();

    expect(useUiStore.getState().toasts.some((t) => t.id === id)).toBe(false);
  });

  it("runModal show/close updates state", async () => {
    const mod = await import("../lib/stores/uiStore");
    const { useUiStore } = mod;

    useUiStore
      .getState()
      .showRunResult({ stdout: "out", stderr: "err", exit_code: 1 });
    expect(useUiStore.getState().runModal.open).toBe(true);
    expect(useUiStore.getState().runModal.stdout).toBe("out");
    expect(useUiStore.getState().runModal.stderr).toBe("err");

    useUiStore.getState().closeRunResult();
    expect(useUiStore.getState().runModal.open).toBe(false);
  });

  it("auditModal show/close updates state", async () => {
    const mod = await import("../lib/stores/uiStore");
    const { useUiStore } = mod;

    useUiStore.getState().showAudit("audit content");
    expect(useUiStore.getState().auditModal.open).toBe(true);
    expect(useUiStore.getState().auditModal.content).toBe("audit content");

    useUiStore.getState().closeAudit();
    expect(useUiStore.getState().auditModal.open).toBe(false);
  });

  it("suggestionsModal show/close updates items", async () => {
    const mod = await import("../lib/stores/uiStore");
    const { useUiStore } = mod;

    useUiStore.getState().showSuggestions(["one", "two"]);
    expect(useUiStore.getState().suggestionsModal.open).toBe(true);
    expect(useUiStore.getState().suggestionsModal.items).toEqual([
      "one",
      "two",
    ]);

    useUiStore.getState().closeSuggestions();
    expect(useUiStore.getState().suggestionsModal.open).toBe(false);
    expect(useUiStore.getState().suggestionsModal.items).toEqual([]);
  });

  it("apiKeyModal show/close and onSubmit stored", async () => {
    const mod = await import("../lib/stores/uiStore");
    const { useUiStore } = mod;

    const submit = vi.fn();
    useUiStore.getState().showApiKeyModal("Title", submit);
    expect(useUiStore.getState().apiKeyModal.open).toBe(true);
    expect(useUiStore.getState().apiKeyModal.title).toBe("Title");
    expect(typeof useUiStore.getState().apiKeyModal.onSubmit).toBe("function");

    // call the stored onSubmit to ensure it's the same function
    useUiStore.getState().apiKeyModal.onSubmit?.("k");
    expect(submit).toHaveBeenCalledWith("k");

    useUiStore.getState().closeApiKeyModal();
    expect(useUiStore.getState().apiKeyModal.open).toBe(false);
  });
});
