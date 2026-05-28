import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

beforeEach(() => {
  vi.resetModules();
});

describe("ExecutionAuditModal", () => {
  it("renders audit content, copies to clipboard and rotates log via invokeSafe", async () => {
    const closeAudit = vi.fn();
    const showAudit = vi.fn();

    // mock ui store
    vi.doMock("../lib/stores/uiStore", () => ({
      useUiStore: () => ({
        auditModal: { open: true, content: "line1\nline2", loading: false },
        closeAudit,
        showAudit,
      }),
    }));

    // mock invokeSafe to return new content for read_audit
    const invokeSafe = vi.fn().mockImplementation(async (cmd: string) => {
      if (cmd === "read_audit") return "new-line";
      return null;
    });
    vi.doMock("../lib/utils/tauri", () => ({ invokeSafe }));

    // mock clipboard
    const writeText = vi.fn().mockResolvedValue(undefined);
    // @ts-ignore
    global.navigator = { clipboard: { writeText } } as any;

    const { default: ExecutionAuditModal } = await import(
      "../components/ExecutionAuditModal"
    );

    render(<ExecutionAuditModal />);

    // content present
    expect(screen.getByText(/Execution Audit/)).toBeTruthy();
    expect(screen.getByText(/line1/)).toBeTruthy();

    // copy button
    fireEvent.click(screen.getByText("Copy"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("line1\nline2"));

    // rotate log button
    fireEvent.click(screen.getByText(/Rotate Log/));
    // invokeSafe should have been called for rotate_audit and read_audit
    await waitFor(() => expect(invokeSafe).toHaveBeenCalled());
    // showAudit should be called with new content
    await waitFor(() => expect(showAudit).toHaveBeenCalledWith("new-line"));

    // close
    fireEvent.click(screen.getByText("Close"));
    expect(closeAudit).toHaveBeenCalled();
  });
});
