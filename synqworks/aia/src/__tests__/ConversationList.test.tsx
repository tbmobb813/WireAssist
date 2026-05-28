import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { act } from "react";
import ConversationList from "../components/ConversationList";
import { useChatStore } from "../lib/stores/chatStore";
import { vi, afterEach } from "vitest";

afterEach(async () => {
  // Reset store state to a clean baseline after each test
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

test("renders empty state and calls createConversation when New clicked", async () => {
  const createMock = vi.fn(
    async (title: string, model: string, provider: string) => ({
      id: "c1",
      title,
      model,
      provider,
      created_at: Date.now(),
      updated_at: Date.now(),
    }),
  );

  act(() => {
    useChatStore.setState({
      conversations: [],
      isLoading: false,
      createConversation: createMock,
    });
  });
  // Prevent the component's useEffect from triggering the real loader which sets isLoading
  act(() => {
    useChatStore.setState({
      loadConversations: async () => {
        /* noop for test */
      },
    });
  });

  await act(async () => {
    render(<ConversationList />);
  });

  // The component shows a friendly empty state when there are no conversations
  expect(screen.getByText(/No conversations yet/i)).toBeTruthy();

  const newBtn = screen.getByRole("button", { name: /New/i });
  await act(async () => {
    fireEvent.click(newBtn);
  });

  await waitFor(() => expect(createMock).toHaveBeenCalled());
});

test("lists conversations and selecting one calls selectConversation", async () => {
  const selectMock = vi.fn(async (_id: string) => {});

  const conv = {
    id: "c2",
    title: "Test convo",
    model: "gpt-4",
    provider: "local",
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  act(() => {
    useChatStore.setState({
      conversations: [conv],
      isLoading: false,
      selectConversation: selectMock,
    });
  });

  await act(async () => {
    render(<ConversationList />);
  });

  expect(screen.getByText(/Test convo/i)).toBeTruthy();

  await act(async () => {
    fireEvent.click(screen.getByText(/Test convo/i));
  });

  await waitFor(() => expect(selectMock).toHaveBeenCalledWith("c2"));
});
