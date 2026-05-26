import { describe, it, expect, vi, beforeEach } from "vitest";
import { useUiStore } from "../lib/stores/uiStore";

beforeEach(() => {
  // reset store to initial
  const s = useUiStore.getState();
  s.toasts = [];
});

describe("uiStore TTL behavior", () => {
  it("adds a toast and it auto-removes after ttl", async () => {
    vi.useFakeTimers();
    const id = useUiStore.getState().addToast({ message: "hi", ttl: 1000 });
    expect(useUiStore.getState().toasts.find((t) => t.id === id)).toBeTruthy();
    // advance time
    vi.advanceTimersByTime(1200);
    // allow queued timeout to run
    await Promise.resolve();
    expect(
      useUiStore.getState().toasts.find((t) => t.id === id),
    ).toBeUndefined();
    vi.useRealTimers();
  });
});
