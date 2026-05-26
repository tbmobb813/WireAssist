import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyTheme } from "../lib/utils/theme";
import { useSettingsStore } from "../lib/stores/settingsStore";

describe("theme application", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
  });

  it("applies dark and light classes when setTheme is called", async () => {
    const { setTheme } = useSettingsStore.getState();
    await setTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await setTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("applies system theme based on matchMedia", async () => {
    const mm = vi
      .spyOn(window, "matchMedia")
      .mockImplementation((q: string) => {
        return {
          media: q,
          matches: true, // simulate dark system
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
          addListener: () => {},
          removeListener: () => {},
        } as unknown as MediaQueryList;
      });

    applyTheme("system");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    mm.mockRestore();
  });
});
