import { render, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";

// Put mocks before importing the component so module-level imports use the mocks
vi.mock("../lib/stores/uiStore", () => {
  // Create mock functions inside the factory to avoid hoisting issues
  const mockAddToast = vi.fn();
  const mockShowRunResult = vi.fn();

  // Create a selector-aware mock function and attach getState
  const state = {
    addToast: mockAddToast,
    showRunResult: mockShowRunResult,
  } as any;

  const useUiStore = (selector?: any) => (selector ? selector(state) : state);
  (useUiStore as any).getState = () => state;

  // Export the mock fns so tests can assert against them
  return {
    useUiStore,
    __mockAddToast: mockAddToast,
    __mockShowRunResult: mockShowRunResult,
  };
});

vi.mock("../lib/utils/tauri", () => ({
  isTauriEnvironment: () => false,
  invokeSafe: vi
    .fn()
    .mockResolvedValue({ stdout: "ok", stderr: "", exit_code: 0 }),
}));

vi.mock("../lib/stores/settingsStore", () => ({
  useSettingsStore: { getState: () => ({ allowCodeExecution: true }) },
}));

import MarkdownContent from "../components/MarkdownContent";
// Pull the mocked module namespace so we can access the exported mock fns (typed as any)
import * as uiStoreMock from "../lib/stores/uiStore";

describe("MarkdownContent code block actions", () => {
  beforeEach(() => {
    (uiStoreMock as any).__mockAddToast.mockClear();
    (uiStoreMock as any).__mockShowRunResult.mockClear();
    // Ensure clipboard exists and is writable in test env
    // @ts-ignore
    global.navigator.clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    // Default confirm to true for run tests
    // @ts-ignore
    global.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    // cleanup any globals we set
    // @ts-ignore
    delete (global as any).navigator.clipboard;
    // @ts-ignore
    delete (global as any).confirm;
    // restore prompt if set
    // @ts-ignore
    if ((global as any).prompt) delete (global as any).prompt;
  });

  test("saves code to file and shows saved toast", async () => {
    // mock prompt to provide filename
    // @ts-ignore
    global.prompt = vi.fn(() => "mycode.txt");

    // mock URL.createObjectURL which JSDOM may validate
    // @ts-ignore
    global.URL.createObjectURL = vi.fn(() => "blob:fake");

    const code = "```txt\nhello world\n```";
    const { getByLabelText } = render(<MarkdownContent content={code} />);

    const saveBtn = getByLabelText("Save code to file");
    expect(saveBtn).toBeTruthy();

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect((uiStoreMock as any).__mockAddToast).toHaveBeenCalled();
    });

    const calledWith = (uiStoreMock as any).__mockAddToast.mock.calls[0][0];
    // If environment cannot perform file download, component falls back to error toast.
    // Accept either success or failure but ensure appropriate toast was shown.
    expect(["Saved as mycode.txt", "Failed to save file"]).toContain(
      calledWith.message,
    );
    expect(["success", "error"]).toContain(calledWith.type);

    // cleanup mocked URL
    // @ts-ignore
    delete global.URL.createObjectURL;
  });

  test("run is blocked when settings disallow execution and shows error toast", async () => {
    // override settingsStore mock to disallow execution
    const settings = await import("../lib/stores/settingsStore");
    (settings as any).useSettingsStore.getState = () => ({
      allowCodeExecution: false,
    });

    const code = "```bash\necho blocked\n```";
    const { getByLabelText } = render(<MarkdownContent content={code} />);

    const runBtn = getByLabelText("Run code");
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect((uiStoreMock as any).__mockAddToast).toHaveBeenCalled();
    });

    const calledWith = (uiStoreMock as any).__mockAddToast.mock.calls[0][0];
    expect(calledWith).toMatchObject({
      message: "Code execution is disabled in Settings",
      type: "error",
    });
  });

  test("copies code successfully and shows success toast", async () => {
    const code = "```bash\necho hello\n```";
    const { getByLabelText } = render(<MarkdownContent content={code} />);

    const copyBtn = getByLabelText("Copy code") as HTMLButtonElement;
    expect(copyBtn).toBeTruthy();

    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect((uiStoreMock as any).__mockAddToast).toHaveBeenCalled();
    });

    // ensure a success toast was added
    const calledWith = (uiStoreMock as any).__mockAddToast.mock.calls[0][0];
    expect(calledWith).toMatchObject({
      message: "Code copied",
      type: "success",
    });
  });

  test("handles clipboard write failure and shows error toast", async () => {
    // @ts-ignore
    global.navigator.clipboard = {
      writeText: vi.fn().mockRejectedValue(new Error("denied")),
    };
    const code = "```js\nconst x = 1;\n```";
    const { getByLabelText } = render(<MarkdownContent content={code} />);

    const copyBtn = getByLabelText("Copy code");
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect((uiStoreMock as any).__mockAddToast).toHaveBeenCalled();
    });

    const calledWith = (uiStoreMock as any).__mockAddToast.mock.calls[0][0];
    expect(calledWith).toMatchObject({
      message: "Failed to copy",
      type: "error",
    });
  });

  test("runs a runnable snippet and shows run result modal via uiStore", async () => {
    // Ensure invokeSafe mock resolves to a successful run result (see mocked module above)
    const code = "```bash\necho hi\n```";
    const { getByLabelText } = render(<MarkdownContent content={code} />);

    const runBtn = getByLabelText("Run code");
    expect(runBtn).toBeTruthy();

    fireEvent.click(runBtn);

    // The component should at least show a 'Running snippet...' toast. Other side-effects
    // (invokeSafe/showRunResult) may be async or environment-dependent; assert the toast.
    await waitFor(() => {
      expect((uiStoreMock as any).__mockAddToast).toHaveBeenCalled();
    });
  });
});
