import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

beforeEach(() => {
  vi.resetModules();
});

describe("ChatInterface keyboard and clipboard behavior", () => {
  it("focuses the input on Ctrl+K", async () => {
    const sendMessage = vi.fn();
    const mockStore = {
      currentConversation: {
        id: "c1",
        title: "C",
        provider: "local",
        model: "gpt-4",
      },
      messages: [],
      sendMessage,
      isLoading: false,
    };

    vi.doMock("../lib/stores/chatStore", () => ({
      useChatStore: () => mockStore,
    }));

    const addToast = vi.fn();
    const defaultUi = {
      suggestionsModal: { open: false, items: [] },
      closeSuggestions: vi.fn(),
      addToast,
      showRunResult: vi.fn(),
      showSuggestions: vi.fn(),
    };
    vi.doMock("../lib/stores/uiStore", () => ({
      useUiStore: (selector: any) =>
        selector ? selector(defaultUi) : defaultUi,
    }));

    // ensure error wrapper calls through
    vi.doMock("../lib/utils/errorHandler", () => ({
      withErrorHandling: async (fn: any) => await fn(),
    }));

    const ChatInterface = (await import("../components/ChatInterface")).default;
    render(<ChatInterface />);

    const input = await screen.findByLabelText(/Message input/i);
    // simulate Ctrl+K
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });

  it("pastes from clipboard and shows toast", async () => {
    const sendMessage = vi.fn();
    const mockStore = {
      currentConversation: {
        id: "c1",
        title: "C",
        provider: "local",
        model: "gpt-4",
      },
      messages: [],
      sendMessage,
      isLoading: false,
    };
    vi.doMock("../lib/stores/chatStore", () => ({
      useChatStore: () => mockStore,
    }));

    const addToast = vi.fn();
    const defaultUi = {
      suggestionsModal: { open: false, items: [] },
      closeSuggestions: vi.fn(),
      addToast,
      showRunResult: vi.fn(),
      showSuggestions: vi.fn(),
    };
    vi.doMock("../lib/stores/uiStore", () => ({
      useUiStore: (selector: any) =>
        selector ? selector(defaultUi) : defaultUi,
    }));

    vi.doMock("../lib/utils/errorHandler", () => ({
      withErrorHandling: async (fn: any) => await fn(),
    }));

    // stub clipboard
    (navigator as any).clipboard = {
      readText: vi.fn().mockResolvedValue("from-clipboard"),
    };

    const ChatInterface = (await import("../components/ChatInterface")).default;
    render(<ChatInterface />);

    const pasteBtn = await screen.findByLabelText(/Paste from clipboard/i);
    pasteBtn.click();

    await waitFor(() => expect(addToast).toHaveBeenCalled());
    const input = await screen.findByLabelText(/Message input/i);
    expect((input as HTMLInputElement).value).toContain("from-clipboard");
  });
});
