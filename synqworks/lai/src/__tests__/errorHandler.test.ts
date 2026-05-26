import { describe, it, expect, vi, beforeEach } from "vitest";

import * as EH from "../lib/utils/errorHandler";
import { useUiStore } from "../lib/stores/uiStore";

describe("errorHandler utilities", () => {
  beforeEach(() => {
    // reset store to ensure addToast is available and spyable
    useUiStore.setState((s) => ({ ...s, toasts: [] }));
    // reset error log
    EH.ErrorHandler.clearErrorLog();
    vi.restoreAllMocks();
  });

  it("classifies common errors correctly", () => {
    const net = EH.classifyError("fetch failed: timeout");
    expect(net.type).toBe(EH.ErrorType.NETWORK);

    const db = EH.classifyError("SQLite database is locked");
    expect(db.type).toBe(EH.ErrorType.DATABASE);

    const api = EH.classifyError("API unauthorized");
    expect(api.type).toBe(EH.ErrorType.API);

    const perm = EH.classifyError("permission denied to file");
    expect(perm.type).toBe(EH.ErrorType.PERMISSION);

    const unknown = EH.classifyError("something odd happened");
    expect(unknown.type).toBe(EH.ErrorType.UNKNOWN);
  });

  it("createAppError produces structured AppError with friendly message", () => {
    const appErr = EH.createAppError("disk full error", "DB", undefined);
    expect(appErr).toHaveProperty("id");
    expect(appErr).toHaveProperty("userMessage");
    // disk full should map to disk_full message key
    expect(typeof appErr.userMessage).toBe("string");
  });

  it("ErrorHandler.handle logs and shows toast for database errors", () => {
    const addToast = vi.fn();
    // stub addToast on store
    useUiStore.setState((s) => ({ ...s, addToast }));

    const err = new Error("db query failed: something");
    const result = EH.ErrorHandler.handle(err, "TestContext");

    expect(result).toHaveProperty("type");
    // should have added a toast
    expect(addToast).toHaveBeenCalled();

    const log = EH.ErrorHandler.getErrorLog();
    expect(log.length).toBeGreaterThan(0);
  });

  it("getRecoverySuggestions returns helpful items for types", () => {
    const netErr = EH.createAppError("fetch failed", "ctx");
    const netSug = EH.ErrorHandler.getRecoverySuggestions(netErr);
    expect(
      netSug.some((s) => s.includes("internet") || s.includes("Retry")),
    ).toBeTruthy();

    const dbErr = EH.createAppError("database locked", "ctx");
    const dbSug = EH.ErrorHandler.getRecoverySuggestions(dbErr);
    expect(
      dbSug.some((s) => s.includes("restart") || s.includes("disk")),
    ).toBeTruthy();

    const apiErr = EH.createAppError("api key invalid", "ctx");
    const apiSug = EH.ErrorHandler.getRecoverySuggestions(apiErr);
    expect(
      apiSug.some((s) => s.includes("API") || s.includes("settings")),
    ).toBeTruthy();
  });

  it("withErrorHandling returns null and shows a toast when operation throws", async () => {
    const addToast = vi.fn();
    useUiStore.setState((s) => ({ ...s, addToast }));

    const res = await EH.withErrorHandling(
      async () => {
        throw new Error("network fetch failed");
      },
      "OpCtx",
      "Custom msg",
    );

    expect(res).toBeNull();
    expect(addToast).toHaveBeenCalled();
  });

  it("reportCriticalError writes to localStorage", () => {
    const fakeAppError: any = {
      id: "e1",
      severity: EH.ErrorSeverity.CRITICAL,
      type: EH.ErrorType.SYSTEM,
    };

    const setItem = vi.fn();
    // stub global localStorage
    // @ts-ignore
    global.localStorage = { setItem } as any;

    // access private static method via any cast
    (EH.ErrorHandler as any).reportCriticalError(fakeAppError);

    expect(setItem).toHaveBeenCalled();
  });
});
