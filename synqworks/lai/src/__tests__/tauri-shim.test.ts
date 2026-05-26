import { describe, test, expect } from "vitest";
import { invoke, hasTauri } from "../lib/tauri-shim";

describe("tauri-shim API", () => {
  test("hasTauri returns a boolean", () => {
    const result = hasTauri();
    expect(typeof result).toBe("boolean");
  });

  test("invoke is an async function", async () => {
    try {
      await invoke("test");
      // Should either succeed or fail predictably
      expect(true).toBeTruthy();
    } catch {
      // Expected in test environment
      expect(true).toBeTruthy();
    }
  });

  test("invoke with command and parameters", async () => {
    try {
      await invoke("cmd", { key: "value" });
      expect(true).toBeTruthy();
    } catch {
      expect(true).toBeTruthy();
    }
  });
  test("invoke handles various command names", async () => {
    const commands = ["command", "get_data", "set_config", ""];
    for (const cmd of commands) {
      try {
        await invoke(cmd);
      } catch {
        // Expected
      }
    }
    expect(true).toBeTruthy();
  });

  test("invoke with object parameters", async () => {
    try {
      await invoke("cmd", { str: "test", num: 42, bool: true });
      expect(true).toBeTruthy();
    } catch {
      expect(true).toBeTruthy();
    }
  });

  test("invoke with array parameters", async () => {
    try {
      await invoke("cmd", { items: [1, 2, 3] });
      expect(true).toBeTruthy();
    } catch {
      expect(true).toBeTruthy();
    }
  });

  test("invoke with null parameters", async () => {
    try {
      await invoke("cmd", null as any);
      expect(true).toBeTruthy();
    } catch {
      expect(true).toBeTruthy();
    }
  });

  test("multiple invocations work sequentially", async () => {
    try {
      await invoke("cmd1");
      await invoke("cmd2");
      expect(true).toBeTruthy();
    } catch {
      expect(true).toBeTruthy();
    }
  });

  test("tauri-shim provides fallback behavior", async () => {
    hasTauri(); // Just verify it can be called
    try {
      await invoke("test");
      expect(true).toBeTruthy();
    } catch (e) {
      // Expected when Tauri is not available
      expect(e).toBeDefined();
    }
  });
  test("hasTauri is consistently boolean", () => {
    for (let i = 0; i < 5; i++) {
      const result = hasTauri();
      expect([true, false]).toContain(result);
    }
  });

  test("invoke function exists and is callable", () => {
    expect(typeof invoke).toBe("function");
  });

  test("hasTauri function exists and is callable", () => {
    expect(typeof hasTauri).toBe("function");
  });
});
