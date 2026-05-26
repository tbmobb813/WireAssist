import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { act } from "react";
import { vi } from "vitest";
import Settings from "../components/Settings";
import { useSettingsStore } from "../lib/stores/settingsStore";

describe("Settings (global shortcut)", () => {
  beforeEach(() => {
    // Reset store to a known baseline before each test
    act(() => {
      useSettingsStore.setState({
        globalShortcut: "CommandOrControl+Space",
      } as any);
    });
  });

  test("renders and shows current shortcut", async () => {
    await act(async () => {
      render(<Settings />);
    });
    const input = screen.getByLabelText(/Global shortcut/i) as HTMLInputElement;
    expect(input.value).toBe("CommandOrControl+Space");
  });

  test("shows validation error for invalid value", async () => {
    await act(async () => {
      render(<Settings />);
    });
    const input = screen.getByLabelText(/Global shortcut/i) as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: "JustAKey" } });
    });
    const save = screen.getByRole("button", { name: /^save$/i });
    act(() => {
      fireEvent.click(save);
    });
    expect(
      await screen.findByText(/Use format like CommandOrControl\+Space/i),
    ).toBeTruthy();
  });

  test("saves valid shortcut and calls onClose", async () => {
    const onClose = vi.fn();

    // Spy/override setGlobalShortcut to avoid invoking actual tauri registration in tests
    const mockSet = vi.fn(async () => Promise.resolve());
    act(() => {
      useSettingsStore.setState({ setGlobalShortcut: mockSet } as any);
    });

    await act(async () => {
      render(<Settings onClose={onClose} />);
    });
    const input = screen.getByLabelText(/Global shortcut/i) as HTMLInputElement;
    act(() => {
      fireEvent.change(input, { target: { value: "Ctrl+Shift+K" } });
    });

    const save = screen.getByRole("button", { name: /^save$/i });
    act(() => {
      fireEvent.click(save);
    });

    await waitFor(() => expect(mockSet).toHaveBeenCalledWith("Ctrl+Shift+K"));
    expect(onClose).toHaveBeenCalled();
  });

  test("clears validation message when corrected", async () => {
    // Ensure setGlobalShortcut resolves immediately
    const mockSet = vi.fn(async () => Promise.resolve());
    act(() => {
      useSettingsStore.setState({ setGlobalShortcut: mockSet } as any);
    });

    await act(async () => {
      render(<Settings />);
    });
    const input = screen.getByLabelText(/Global shortcut/i) as HTMLInputElement;
    // Trigger invalid
    act(() => {
      fireEvent.change(input, { target: { value: "OnlyKey" } });
    });
    const saveBtn = screen.getByRole("button", { name: /^save$/i });
    act(() => {
      fireEvent.click(saveBtn);
    });
    // Error appears
    const errorEl = await screen.findByText(
      /Use format like CommandOrControl\+Space/i,
    );
    expect(errorEl).toBeTruthy();

    // Correct it
    act(() => {
      fireEvent.change(input, { target: { value: "Ctrl+Shift+K" } });
    });
    act(() => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => expect(mockSet).toHaveBeenCalledWith("Ctrl+Shift+K"));
    // Error should be cleared
    await waitFor(() => {
      const maybeError = screen.queryByText(
        /Use format like CommandOrControl\+Space/i,
      );
      expect(maybeError).toBeNull();
    });
  });
});
