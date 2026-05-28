import { describe, it, expect, vi, beforeEach } from "vitest";
import { useProjectStore } from "../lib/stores/projectStore";

beforeEach(() => {
  useProjectStore.getState().clear();
  vi.useRealTimers();
});

describe("projectStore events and getRecentSummary", () => {
  it("adds events and returns recent summary within a window", () => {
    // set system time and add two events separated by 1 minute
    const base = Date.now();
    // make /path/a 100s old
    vi.setSystemTime(base - 100_000);
    useProjectStore.getState().addEvents(["/path/a"]);

    // make /path/b 10s old
    vi.setSystemTime(base - 10_000);
    useProjectStore.getState().addEvents(["/path/b"]);

    // now set time to base
    vi.setSystemTime(base);

    // windowMs of 45_000 (45s) should include only /path/b (10s old)
    const summary = useProjectStore.getState().getRecentSummary(5, 45_000);
    expect(summary).toContain("/path/b");
    expect(summary).not.toContain("/path/a");
  });

  it("clear empties events and getRecentSummary returns null", () => {
    useProjectStore.getState().addEvents(["/x"]);
    useProjectStore.getState().clear();
    const s = useProjectStore.getState().getRecentSummary(5, 1000);
    expect(s).toBeNull();
  });
});
