import { test, expect } from "@playwright/test";

test("app shows main page", async ({ page }) => {
  await page.goto("http://localhost:1421");
  await expect(page).toHaveTitle(/Linux AI/i);
});
