import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command:
      "pnpm --filter linux-ai-assistant exec -- vite preview --port 1421",
    port: 1421,
    timeout: 60_000,
    reuseExistingServer: true,
  },
});
