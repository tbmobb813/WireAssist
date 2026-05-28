import { useChatStore } from "../lib/stores/chatStore";
import { database as db } from "../lib/api/database";
import { vi, afterEach, expect, test } from "vitest";

afterEach(() => {
  useChatStore.setState({
    currentConversation: null,
    conversations: [],
    messages: [],
    isLoading: false,
    error: null,
  });
  vi.restoreAllMocks();
});

test("sendMessage handles DB failure and marks optimistic message failed", async () => {
  const conv = {
    id: "conv-err",
    title: "Err",
    model: "gpt-4",
    provider: "local",
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  // Make db.messages.create reject to simulate a write error
  const createMock = vi.fn(async () => {
    throw new Error("DB write failed");
  });

  (db.messages as any).create = createMock;

  useChatStore.setState({ currentConversation: conv, messages: [] });

  await useChatStore.getState().sendMessage("this will fail");

  // After failure, optimistic message should be present and marked failed
  const msgs = useChatStore.getState().messages;
  expect(msgs.length).toBe(1);
  expect(msgs[0].status).toBe("failed");
  expect(useChatStore.getState().isLoading).toBe(false);
  expect(useChatStore.getState().error).toMatch(/DB write failed/i);
  expect(createMock).toHaveBeenCalled();
});
