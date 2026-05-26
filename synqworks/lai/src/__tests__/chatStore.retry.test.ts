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

test("retryMessage retries a failed user message and persists assistant response", async () => {
  const conv = {
    id: "conv-retry",
    title: "Retry",
    model: "gpt-4",
    provider: "local",
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  // First call fails, subsequent calls succeed
  const createMock = vi
    .fn()
    .mockImplementationOnce(async () => {
      throw new Error("DB write failed");
    })
    .mockImplementationOnce(async (data: any) => ({
      id: "m1",
      ...data,
      timestamp: Date.now(),
    }))
    .mockImplementationOnce(async (data: any) => ({
      id: "m2",
      ...data,
      timestamp: Date.now(),
    }));

  (db.messages as any).create = createMock;

  useChatStore.setState({ currentConversation: conv, messages: [] });

  // initial send - will fail and mark message failed
  await useChatStore.getState().sendMessage("will be retried");

  const msgsAfterFail = useChatStore.getState().messages;
  expect(msgsAfterFail.length).toBe(1);
  const failedMsg = msgsAfterFail[0];
  expect(failedMsg.status).toBe("failed");

  // Now retry the failed message
  await useChatStore.getState().retryMessage(failedMsg.id);

  const msgsAfterRetry = useChatStore.getState().messages;
  // After retry, we should have the persisted user message and the assistant message
  expect(msgsAfterRetry.length).toBe(2);
  expect(msgsAfterRetry[0].status).toBe("sent");
  expect(msgsAfterRetry[1].role).toBe("assistant");
  expect(msgsAfterRetry[1].status).toBe("sent");
  expect(createMock).toHaveBeenCalledTimes(3);
});
