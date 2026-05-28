import { render, fireEvent, waitFor } from "@testing-library/react";
import { vi, beforeEach } from "vitest";

// Mock uiStore (selector-aware) and export mocks
vi.mock("../lib/stores/uiStore", () => {
  const mockAddToast = vi.fn();
  const state = { addToast: mockAddToast } as any;
  const useUiStore = (selector?: any) => (selector ? selector(state) : state);
  (useUiStore as any).getState = () => state;
  return { useUiStore, __mockAddToast: mockAddToast };
});

// Mock chatStore
vi.mock("../lib/stores/chatStore", () => {
  const retryMessage = vi.fn();
  const useChatStore = (selector?: any) =>
    selector ? selector({ retryMessage }) : { retryMessage };
  return { useChatStore, __mockRetry: retryMessage };
});

import MessageBubble from "../components/MessageBubble";
import * as uiStoreMock from "../lib/stores/uiStore";
import * as chatStoreMock from "../lib/stores/chatStore";

beforeEach(() => {
  (uiStoreMock as any).__mockAddToast.mockClear();
  (chatStoreMock as any).__mockRetry.mockClear?.();
});

describe("MessageBubble", () => {
  test("renders user message raw and shows retry when failed", () => {
    const message = {
      id: "1",
      role: "user",
      content: "hi user",
      status: "failed",
      timestamp: Date.now(),
    } as any;
    const { getByText } = render(<MessageBubble message={message} />);
    expect(getByText("hi user")).toBeTruthy();
    const retryBtn = getByText("Retry");
    fireEvent.click(retryBtn);
    expect((chatStoreMock as any).__mockRetry).toHaveBeenCalledWith("1");
  });

  test("renders assistant markdown and copy button calls addToast on success", async () => {
    // @ts-ignore
    global.navigator.clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    const message = {
      id: "2",
      role: "assistant",
      content: "Some content",
    } as any;
    const { getByLabelText } = render(<MessageBubble message={message} />);
    const copyBtn = getByLabelText("Copy message");
    fireEvent.click(copyBtn);
    await waitFor(() =>
      expect((uiStoreMock as any).__mockAddToast).toHaveBeenCalled(),
    );
    // cleanup
    // @ts-ignore
    delete global.navigator.clipboard;
  });

  test("copy failure shows error toast", async () => {
    // @ts-ignore
    global.navigator.clipboard = {
      writeText: vi.fn().mockRejectedValue(new Error("denied")),
    };
    const message = { id: "3", role: "assistant", content: "x" } as any;
    const { getByLabelText } = render(<MessageBubble message={message} />);
    const copyBtn = getByLabelText("Copy message");
    fireEvent.click(copyBtn);
    await waitFor(() =>
      expect((uiStoreMock as any).__mockAddToast).toHaveBeenCalled(),
    );
    // cleanup
    // @ts-ignore
    delete global.navigator.clipboard;
  });
});
