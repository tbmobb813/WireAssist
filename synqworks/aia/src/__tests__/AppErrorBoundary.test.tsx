import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { ErrorHandler } from "../lib/utils/errorHandler";

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls ErrorHandler.handle and renders default fallback when child throws, and reset restores child", async () => {
    const handleSpy = vi
      .spyOn(ErrorHandler, "handle")
      .mockImplementation(() => {
        // noop
        return {} as any;
      });

    // outside mutable flag to control whether the child throws
    let shouldThrow = true;

    const Bomb = () => {
      if (shouldThrow) throw new Error("boom");
      return <div>Child OK</div>;
    };

    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>,
    );

    // default fallback contains heading text
    expect(await screen.findByText(/Something went wrong/i)).toBeTruthy();
    expect(handleSpy).toHaveBeenCalled();

    // Prepare child to be non-throwing after reset
    shouldThrow = false;

    const resetBtn = screen.getByText(/Reset Component/i);
    fireEvent.click(resetBtn);

    // After reset, child should render
    expect(await screen.findByText("Child OK")).toBeTruthy();
  });

  it("uses a custom fallback when provided and reset works", async () => {
    const handleSpy = vi
      .spyOn(ErrorHandler, "handle")
      .mockImplementation(() => ({}) as any);

    let shouldThrow = true;

    const Bomb = () => {
      if (shouldThrow) throw new Error("custom boom");
      return <div>Child Alive</div>;
    };

    const CustomFallback: React.FC<{ error: Error; reset: () => void }> = ({
      error,
      reset,
    }) => (
      <div>
        <span>Custom: {error.message}</span>
        <button onClick={reset}>Reset</button>
      </div>
    );

    render(
      <AppErrorBoundary fallback={CustomFallback}>
        <Bomb />
      </AppErrorBoundary>,
    );

    expect(await screen.findByText(/Custom:/i)).toBeTruthy();
    expect(handleSpy).toHaveBeenCalled();

    shouldThrow = false;
    const reset = screen.getByText("Reset");
    fireEvent.click(reset);

    expect(await screen.findByText("Child Alive")).toBeTruthy();
  });
});
