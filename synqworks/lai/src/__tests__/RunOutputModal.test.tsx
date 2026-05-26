import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import RunOutputModal from "../components/RunOutputModal";
import { useUiStore } from "../lib/stores/uiStore";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock the UI store module; we'll control the return value per-test
vi.mock("../lib/stores/uiStore", () => ({
  useUiStore: vi.fn(),
}));

describe("RunOutputModal component", () => {
  test("renders nothing when modal is closed", () => {
    (useUiStore as any).mockReturnValue({
      runModal: { open: false },
      closeRunResult: vi.fn(),
    });

    const { container } = render(<RunOutputModal />);
    // Should render nothing when closed
    expect(container.firstChild).toBeNull();
  });

  test("renders modal when open and shows stdout", () => {
    (useUiStore as any).mockReturnValue({
      runModal: {
        open: true,
        stdout: "Hello stdout",
        stderr: "",
        exit_code: 0,
        timed_out: false,
      },
      closeRunResult: vi.fn(),
    });

    const { container, getByText } = render(<RunOutputModal />);
    expect(container.firstChild).toBeTruthy();
    expect(getByText("Hello stdout")).toBeTruthy();
  });

  test("component is properly exported", () => {
    expect(RunOutputModal).toBeDefined();
    expect(typeof RunOutputModal).toBe("function");
  });

  test("close button calls closeRunResult", () => {
    const mockClose = vi.fn();
    (useUiStore as any).mockReturnValue({
      runModal: {
        open: true,
        stdout: "",
        stderr: "",
        exit_code: 0,
        timed_out: false,
      },
      closeRunResult: mockClose,
    });

    const { getByText } = render(<RunOutputModal />);
    const btn = getByText(/Close/i);
    btn.click();
    expect(mockClose).toHaveBeenCalled();
  });

  test("shows (no output) when stdout empty", () => {
    (useUiStore as any).mockReturnValue({
      runModal: {
        open: true,
        stdout: "",
        stderr: "",
        exit_code: 0,
        timed_out: false,
      },
      closeRunResult: vi.fn(),
    });

    const { getByText } = render(<RunOutputModal />);
    expect(getByText(/no output/i)).toBeTruthy();
  });
});
