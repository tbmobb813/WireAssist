import { render, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";

const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockAddToast = vi.fn();
const mockInvoke = vi.fn();

vi.mock("../lib/stores/chatStore", () => ({
  useChatStore: (sel: any) =>
    sel({
      updateConversationTitle: mockUpdate,
      deleteConversation: mockDelete,
    }),
}));
vi.mock("../lib/stores/uiStore", () => ({
  useUiStore: (sel: any) => sel({ addToast: mockAddToast }),
}));
vi.mock("../lib/utils/tauri", () => ({
  invokeSafe: (...args: any[]) => mockInvoke(...args),
}));

import ConversationItem from "../components/ConversationItem";

describe("ConversationItem (unit)", () => {
  beforeEach(() => vi.resetAllMocks());

  const conv = { id: "c1", title: "Hello", model: "gpt-4" } as any;

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    const { getByText } = render(
      <ConversationItem
        conversation={conv}
        selected={false}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(getByText("Hello"));
    expect(onSelect).toHaveBeenCalledWith("c1");
  });

  it("rename success shows toast", async () => {
    mockUpdate.mockResolvedValue(undefined);
    const { getByText, getByDisplayValue } = render(
      <ConversationItem
        conversation={conv}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.click(getByText("Rename"));
    fireEvent.change(getByDisplayValue("Hello"), {
      target: { value: "New Title" },
    });
    fireEvent.click(getByText("Save"));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith("c1", "New Title"),
    );
    expect(mockAddToast).toHaveBeenCalled();
  });

  it("delete shows toast", async () => {
    mockDelete.mockResolvedValue(undefined);
    const { getByText } = render(
      <ConversationItem
        conversation={conv}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.click(getByText("Delete"));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("c1"));
    expect(mockAddToast).toHaveBeenCalled();
  });

  it("export triggers invoke and shows toast", async () => {
    mockInvoke.mockResolvedValue("ok");
    const { getByTitle } = render(
      <ConversationItem
        conversation={conv}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.click(getByTitle("Export as JSON"));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
    expect(mockAddToast).toHaveBeenCalled();
  });
});
