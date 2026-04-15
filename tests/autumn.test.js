const { test, expect } = require('@playwright/test');

test.describe('Autumn Page Tests', () => {
  test('Autumn page loads and contains required initial layout', async ({ page }) => {
    // Navigate to the local autumn.html server
    await page.goto('http://127.0.0.1:8000/autumn.html');

    // Check title
    await expect(page).toHaveTitle(/Autumn/i);

    // Data Policy consent modal should be visible or hidden, just accept if visible
    const agreeBtn = page.getByRole('button', { name: /I CONSENT & AGREE/i });
    if (await agreeBtn.isVisible()) {
      await agreeBtn.click();
    }

    // Check main UI regions using the correct IDs
    await expect(page.locator('#chat-region')).toBeVisible();
    await expect(page.locator('#input-bar')).toBeVisible();
  });

  test('Data Policy button is present and links to policy', async ({ page }) => {
    await page.goto('http://127.0.0.1:8000/autumn.html');

    const agreeBtn = page.getByRole('button', { name: /I CONSENT & AGREE/i });
    if (await agreeBtn.isVisible()) {
      await agreeBtn.click();
    }

    // Ensure the POLICY button is present
    const policyBtn = page.getByRole('button', { name: /POLICY/i });
    await expect(policyBtn).toBeVisible();
  });
});
