import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

/**
 * Playwright harness for Command Center pages.
 * Tauri/desktop specs from WireAssist are intentionally not ported.
 *
 * CI builds packages first, so use production `start` there.
 * Locally prefer `dev` so a full Next build is not required.
 */
const isCi = Boolean(process.env.CI);

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
    command: isCi
      ? 'pnpm --filter @wireassist/command-center start'
      : 'pnpm --filter @wireassist/command-center dev',
    url: 'http://127.0.0.1:3001',
    timeout: 120_000,
    reuseExistingServer: !isCi,
    cwd: '../../..',
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      // Isolated SQLite dir so bootstrap never depends on ~/.wireassist existing
      WIREASSIST_HOME: join(tmpdir(), `wireassist-e2e-${process.pid}`),
    },
  },
});
