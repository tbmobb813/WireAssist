import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { act } from "react";
import ChatInterface from "../components/ChatInterface";
import { useChatStore } from "../lib/stores/chatStore";
import { vi, afterEach } from "vitest";

afterEach(async () => {
  await act(async () => {
    useChatStore.setState({
      currentConversation: null,
      conversations: [],
      messages: [],
      isLoading: false,
      error: null,
    });
  });
});

test("shows placeholder when no conversation selected", async () => {
  await act(async () => {
    render(<ChatInterface />);
  });
  expect(
    screen.getByText(/Select or create a conversation to get started/i),
  ).toBeTruthy();
});

test("typing and sending calls sendMessage and clears input", async () => {
  const sendMock: any = vi.fn(async (_content: string) => {
    return;
  });

  act(() => {
    useChatStore.setState({
      currentConversation: {
        id: "c1",
        title: "Test",
        model: "gpt-4",
        provider: "local",
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      messages: [],
      sendMessage: sendMock,
    });
  });

  await act(async () => {
    render(<ChatInterface />);
  });

  const input = screen.getByPlaceholderText(
    /Type a message/i,
  ) as HTMLInputElement;
  act(() => {
    fireEvent.change(input, { target: { value: "hello world" } });
  });

  const sendBtn = screen.getByRole("button", { name: /Send/i });
  act(() => {
    fireEvent.click(sendBtn);
  });

  await waitFor(() => expect(sendMock).toHaveBeenCalledWith("hello world"));
  expect(input.value).toBe("");
});

test("disables send while pending", async () => {
  let resolveSend: () => void;
  const sendMock: any = vi.fn(() => {
    // When called, mark the store as loading and return a promise we control
    useChatStore.setState({ isLoading: true });
    return new Promise<void>((res) => {
      resolveSend = () => {
        useChatStore.setState({ isLoading: false });
        res();
      };
    });
  });

  act(() => {
    useChatStore.setState({
      currentConversation: {
        id: "c1",
        title: "Test",
        model: "gpt-4",
        provider: "local",
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      messages: [],
      sendMessage: sendMock,
      isLoading: false,
    });
  });

  await act(async () => {
    render(<ChatInterface />);
  });

  const input = screen.getByPlaceholderText(
    /Type a message/i,
  ) as HTMLInputElement;
  act(() => {
    fireEvent.change(input, { target: { value: "pending message" } });
  });

  const sendBtn = screen.getByRole("button", { name: /Send|Sending.../i });
  act(() => {
    fireEvent.click(sendBtn);
  });

  // After clicking, the button should show sending state and be disabled
  expect(sendBtn).toBeDisabled();
  expect(sendBtn.textContent).toMatch(/Sending.../i);

  // Resolve the pending send inside act to avoid warnings
  act(() => {
    resolveSend!();
  });

  await waitFor(() => expect(sendMock).toHaveBeenCalled());

  // Input should be cleared after send resolves
  expect(input.value).toBe("");
});
