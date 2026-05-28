import { test, expect } from "@playwright/test";

test("opens settings and changes global shortcut", async ({ page }) => {
  await page.goto("http://localhost:1421");

  // Wait for app to be interactive
  await expect(
    page.getByRole("heading", { name: /Conversations/i }),
  ).toBeVisible();

  // Click Settings button
  const settingsBtn = page.getByRole("button", { name: /Settings/i });
  await settingsBtn.click();

  // Verify settings panel opened
  const shortcutInput = page.locator("input#global-shortcut-input");
  await expect(shortcutInput).toBeVisible();

  // Verify default value
  await expect(shortcutInput).toHaveValue("CommandOrControl+Space");

  // Change to a new shortcut
  await shortcutInput.fill("Ctrl+Shift+K");

  // Click Save
  const saveBtn = page.getByRole("button", { name: /Save/i });
  await saveBtn.click();

  // Settings panel should close after save
  await expect(shortcutInput).not.toBeVisible({ timeout: 2000 });

  // Optionally: reopen to verify persistence (if the app reloads settings on open)
  await settingsBtn.click();
  const reopenedInput = page.locator("input#global-shortcut-input");
  await expect(reopenedInput).toBeVisible();
  // Note: actual persistence depends on backend; in web preview this may not persist across reload
});
