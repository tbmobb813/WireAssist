import { useChatStore } from "../lib/stores/chatStore";
import { database as db } from "../lib/api/database";
import { vi, afterEach, expect, test } from "vitest";

afterEach(() => {
  // reset store state
  useChatStore.setState({
    currentConversation: null,
    conversations: [],
    messages: [],
    isLoading: false,
    error: null,
  });

  // restore mocks
  vi.restoreAllMocks();
});

test("sendMessage creates user and assistant messages and updates store", async () => {
  const conv = {
    id: "conv1",
    title: "Conv 1",
    model: "gpt-4",
    provider: "local",
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  // Mock db.messages.create to return a message object echoing inputs.
  const createMock = vi.fn(async (data: any) => {
    return {
      id: Math.random().toString(36).slice(2, 9),
      conversation_id: data.conversation_id,
      role: data.role,
      content: data.content,
      created_at: Date.now(),
    };
  });

  // Replace the database implementation for tests
  (db.messages as any).create = createMock;

  // Set current conversation in store
  useChatStore.setState({ currentConversation: conv, messages: [] });

  // Call sendMessage
  await useChatStore.getState().sendMessage("hello test");

  // Expect db.messages.create to have been called twice (user + assistant)
  expect(createMock).toHaveBeenCalledTimes(2);

  const msgs = useChatStore.getState().messages;
  expect(msgs.length).toBe(2);
  expect(msgs[0].role).toBe("user");
  expect(msgs[0].content).toBe("hello test");
  expect(msgs[1].role).toBe("assistant");
  expect(msgs[1].content).toBeDefined();
});
