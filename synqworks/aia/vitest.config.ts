import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    // Use an absolute path so worker processes resolve the same file regardless
    // of current working directory when Vitest is invoked from workspaces.
    setupFiles: path.resolve(__dirname, "src/setupTests.ts"),
    // Explicit include prevents accidental discovery of e2e/playwright files
    // when Vitest is invoked from the workspace root or with globs.
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/playwright-e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "coverage",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@tauri-apps/api/tauri": path.resolve(__dirname, "src/mocks/tauri.ts"),
      "@tauri-apps/plugin-clipboard-manager": path.resolve(
        __dirname,
        "src/mocks/clipboard.ts",
      ),
    },
  },
});
