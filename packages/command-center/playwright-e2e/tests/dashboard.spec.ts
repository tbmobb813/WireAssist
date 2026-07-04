import { test, expect } from '@playwright/test';

// Minimal harness smoke — not a port of WireAssist Tauri specs.
test('command-center dashboard loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/WireAssist/i);
  await expect(page.locator('body')).toBeVisible();
});
