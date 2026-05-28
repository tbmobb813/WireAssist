import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { useUiStore } from "../lib/stores/uiStore";

describe("uiStore toasts (ttl)", () => {
  beforeEach(() => {
    // reset toasts
    useUiStore.setState({ toasts: [] } as any);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    useUiStore.setState({ toasts: [] } as any);
  });

  test("adds a toast with ttl and it is removed after ttl", async () => {
    const id = useUiStore.getState().addToast({ message: "hi", ttl: 500 });
    let ts = useUiStore.getState().toasts;
    expect(ts.length).toBe(1);

    // advance clock
    vi.advanceTimersByTime(500);

    // run microtasks to let setTimeout handler run
    await Promise.resolve();

    ts = useUiStore.getState().toasts;
    expect(ts.find((t) => t.id === id)).toBeUndefined();
  });

  test("removeToast removes a toast immediately", () => {
    const id = useUiStore.getState().addToast({ message: "to-remove" });
    let ts = useUiStore.getState().toasts;
    expect(ts.some((t) => t.id === id)).toBeTruthy();

    useUiStore.getState().removeToast(id);
    ts = useUiStore.getState().toasts;
    expect(ts.some((t) => t.id === id)).toBeFalsy();
  });
});
