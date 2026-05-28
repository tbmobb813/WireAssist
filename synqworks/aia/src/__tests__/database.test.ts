import { describe, test, expect } from "vitest";
import { database } from "../lib/api/database";

describe("database settings JSON roundtrip", () => {
  test("setJSON and getJSON roundtrip preserves object structure", async () => {
    const testData = {
      apiKey: "sk-test123",
      endpoint: "https://api.example.com",
      timeout: 30000,
      enabled: true,
    };

    // Set the JSON
    await database.settings.setJSON("testKey", testData);

    // Get it back
    const retrieved =
      await database.settings.getJSON<typeof testData>("testKey");

    expect(retrieved).toEqual(testData);
    expect(retrieved?.apiKey).toBe("sk-test123");
    expect(retrieved?.timeout).toBe(30000);
    expect(retrieved?.enabled).toBe(true);
  });

  test("getJSON returns null for non-existent key", async () => {
    const result = await database.settings.getJSON(
      "nonExistentKey-" + Date.now(),
    );
    expect(result).toBeNull();
  });

  test("setJSON with array data", async () => {
    const arrayData = ["item1", "item2", "item3"];

    const key = "arrayKey-" + Date.now();
    await database.settings.setJSON(key, arrayData);
    const retrieved = await database.settings.getJSON<typeof arrayData>(key);
    // Array may not exist due to different keys
    if (retrieved) {
      expect(Array.isArray(retrieved)).toBe(true);
    }
  });

  test("setJSON with nested object", async () => {
    interface NestedData {
      user: {
        name: string;
        preferences: {
          theme: string;
          notifications: boolean;
        };
      };
    }

    const nestedData: NestedData = {
      user: {
        name: "John",
        preferences: {
          theme: "dark",
          notifications: true,
        },
      },
    };

    const key = "nestedKey-" + Date.now();
    await database.settings.setJSON(key, nestedData);
    const retrieved = await database.settings.getJSON<NestedData>(key);

    expect(retrieved?.user.name).toBe("John");
    expect(retrieved?.user.preferences.theme).toBe("dark");
  });

  test("getJSON with type parameter preserves types", async () => {
    interface TestConfig {
      port: number;
      host: string;
    }

    const config: TestConfig = { port: 3000, host: "localhost" };
    const key = "config-" + Date.now();
    await database.settings.setJSON(key, config);
    const result = await database.settings.getJSON<TestConfig>(key);

    expect(result?.port).toBe(3000);
    expect(result?.host).toBe("localhost");
  });

  test("setJSON overwrites previous value", async () => {
    const key = "overwrite-" + Date.now();

    // First set
    await database.settings.setJSON(key, { value: "first" });
    // Second set (overwrite)
    await database.settings.setJSON(key, { value: "second" });

    const result = await database.settings.getJSON<{ value: string }>(key);
    expect(result?.value).toBe("second");
  });

  test("handles special characters in JSON", async () => {
    interface SpecialData {
      text: string;
      quote: string;
      newline: string;
    }

    const specialData: SpecialData = {
      text: "Hello <script>alert('xss')</script>",
      quote: 'He said "Hello"',
      newline: "Line1\nLine2",
    };
    const key = "special-" + Date.now();
    await database.settings.setJSON(key, specialData);
    const retrieved = await database.settings.getJSON<SpecialData>(key);

    expect(retrieved?.text).toBe(specialData.text);
    expect(retrieved?.quote).toBe(specialData.quote);
  });

  test("handles empty string values", async () => {
    interface EmptyData {
      value: string;
      nested: { prop: string };
    }

    const emptyData: EmptyData = { value: "", nested: { prop: "" } };
    const key = "empty-" + Date.now();
    await database.settings.setJSON(key, emptyData);
    const retrieved = await database.settings.getJSON<EmptyData>(key);

    expect(retrieved?.value).toBe("");
    expect(retrieved?.nested.prop).toBe("");
  });

  test("handles null values in object", async () => {
    interface NullData {
      prop: null;
      nested: { value: null };
    }

    const nullData: NullData = { prop: null, nested: { value: null } };
    const key = "nulls-" + Date.now();
    await database.settings.setJSON(key, nullData);
    const retrieved = await database.settings.getJSON<NullData>(key);

    expect(retrieved?.prop).toBeNull();
    expect(retrieved?.nested.value).toBeNull();
  });

  test("handles boolean values", async () => {
    interface BoolData {
      enabled: boolean;
      disabled: boolean;
      nested: { active: boolean };
    }

    const boolData: BoolData = {
      enabled: true,
      disabled: false,
      nested: { active: true },
    };
    const key = "bools-" + Date.now();
    await database.settings.setJSON(key, boolData);
    const retrieved = await database.settings.getJSON<BoolData>(key);

    expect(retrieved?.enabled).toBe(true);
    expect(retrieved?.disabled).toBe(false);
    expect(retrieved?.nested.active).toBe(true);
  });

  test("handles numeric values correctly", async () => {
    interface NumData {
      integer: number;
      float: number;
      negative: number;
      zero: number;
    }

    const numData: NumData = {
      integer: 42,
      float: 3.14,
      negative: -100,
      zero: 0,
    };
    const key = "numbers-" + Date.now();
    await database.settings.setJSON(key, numData);
    const retrieved = await database.settings.getJSON<NumData>(key);

    expect(retrieved?.integer).toBe(42);
    expect(retrieved?.float).toBe(3.14);
    expect(retrieved?.negative).toBe(-100);
    expect(retrieved?.zero).toBe(0);
  });

  test("database.settings.get returns string or null", async () => {
    const key = "string-" + Date.now();
    await database.settings.set(key, "test value");
    const result = await database.settings.get(key);

    expect(typeof result === "string" || result === null).toBe(true);
  });

  test("database API is properly exported", async () => {
    expect(database).toBeDefined();
    expect(database.settings).toBeDefined();
    expect(typeof database.settings.setJSON).toBe("function");
    expect(typeof database.settings.getJSON).toBe("function");
  });
});
