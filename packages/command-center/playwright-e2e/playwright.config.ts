import { defineConfig } from '@playwright/test';

/**
 * Playwright harness for Command Center pages.
 * Tauri/desktop specs from WireAssist are intentionally not ported.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    baseURL: 'http://127.0.0.1:3001',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'pnpm --filter @wireassist/command-center dev',
    url: 'http://127.0.0.1:3001',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    cwd: '../../..',
  },
});
