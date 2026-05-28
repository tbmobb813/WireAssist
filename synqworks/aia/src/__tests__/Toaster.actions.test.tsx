import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { act } from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import Toaster from "../components/Toaster";
import { useUiStore } from "../lib/stores/uiStore";

describe("Toaster actions and TTL", () => {
  beforeEach(() => {
    // reset store between tests by preserving shape but clearing toasts
    useUiStore.setState((s) => ({ ...s, toasts: [] }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-dismisses a toast after ttl expires", async () => {
    render(<Toaster />);

    // add toast with a small ttl so we can wait for removal with real timers
    act(() => {
      useUiStore.getState().addToast({ message: "temporary", ttl: 50 });
    });

    // wait for the toast to appear
    await screen.findByText("temporary");

    // wait for it to be removed (allow some buffer)
    await waitFor(
      () => {
        expect(screen.queryByText("temporary")).toBeNull();
      },
      { timeout: 2000 },
    );
  });

  it("calls action.onClick and removes toast when action button clicked", async () => {
    render(<Toaster />);

    const onClick = vi.fn();

    act(() => {
      useUiStore.getState().addToast({
        message: "with-action",
        action: { label: "Do", onClick },
      });
    });

    const btn = await screen.findByText("Do");
    fireEvent.click(btn);

    expect(onClick).toHaveBeenCalled();

    await waitFor(() => expect(screen.queryByText("with-action")).toBeNull());
  });

  it("removes toast when dismiss button clicked", async () => {
    render(<Toaster />);

    act(() => {
      useUiStore.getState().addToast({ message: "dismiss-me" });
    });

    const dismiss = await screen.findByLabelText("Dismiss");
    fireEvent.click(dismiss);

    await waitFor(() => expect(screen.queryByText("dismiss-me")).toBeNull());
  });
});
