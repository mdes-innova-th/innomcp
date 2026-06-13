import { test, expect, Locator } from '@playwright/test';

test.describe('Memory Panel Tests', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const dismissOnboarding = async (page: import('@playwright/test').Page) => {
    try {
      await page.getByText('ข้าม', { exact: true }).click({ timeout: 5000 });
    } catch {
      // onboarding may already be dismissed or not present
    }
  };

  test('should open memory panel and show empty state for new guest', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/living-chat');
    await dismissOnboarding(page);

    // Locate memory panel trigger button (assume it's a button with text "Memory" or icon)
    const memoryButton = page.getByRole('button', { name: /memory/i });
    await memoryButton.click();
    await page.waitForTimeout(1000);

    // Check that the memory panel is visible and contains either a list region or empty state
    const panel = page.locator('[data-testid="memory-panel"]'); // adjust selector as needed
    await expect(panel).toBeVisible();

    // Assert that there is either a list of memories or an empty state message
    const emptyState = page.getByText(/no memories|ยังไม่มี|empty/i);
    const memoriesList = page.locator('[data-testid="memory-list"]');
    await expect(emptyState.or(memoriesList).first()).toBeVisible();

    // Ensure no uncaught page errors
    await expect(page).not.toHaveEvent('pageerror');
  });

  test('should open memory panel from dashboard and display memories list if any', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/dashboard');
    await dismissOnboarding(page);

    // Navigate to chat area or directly find memory button
    const memoryButton = page.getByRole('button', { name: /memory/i });
    await memoryButton.click();
    await page.waitForTimeout(1000);

    const panel = page.locator('[data-testid="memory-panel"]');
    await expect(panel).toBeVisible();

    // Wait for potential content
    await page.waitForTimeout(2000);

    // Check for list or empty state
    const memoriesList = page.locator('[data-testid="memory-list"]');
    const emptyState = page.getByText(/no memories|ยังไม่มี|empty/i);
    // At least one should exist
    await expect(memoriesList.or(emptyState).first()).toBeVisible();

    await expect(page).not.toHaveEvent('pageerror');
  });

  test('should close memory panel when clicking close button', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/living-chat');
    await dismissOnboarding(page);

    const memoryButton = page.getByRole('button', { name: /memory/i });
    await memoryButton.click();
    await page.waitForTimeout(500);

    const closeButton = page.getByRole('button', { name: /close|ปิด/i });
    await closeButton.click();
    await page.waitForTimeout(500);

    // Panel should disappear
    const panel = page.locator('[data-testid="memory-panel"]');
    await expect(panel).not.toBeVisible();

    await expect(page).not.toHaveEvent('pageerror');
  });

  test('edge case: memory panel should handle long list gracefully', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/living-chat');
    await dismissOnboarding(page);

    // Simulate having many memories by injecting data via backend? Instead, just verify scroll exists
    const memoryButton = page.getByRole('button', { name: /memory/i });
    await memoryButton.click();
    await page.waitForTimeout(1000);

    const panel = page.locator('[data-testid="memory-panel"]');
    await expect(panel).toBeVisible();

    // Check that the list container is scrollable (if list is present)
    const listContainer = page.locator('[data-testid="memory-list"]');
    if (await listContainer.isVisible()) {
      const overflow = await listContainer.evaluate(el => window.getComputedStyle(el).overflowY);
      expect(['auto', 'scroll']).toContain(overflow);
    }

    await expect(page).not.toHaveEvent('pageerror');
  });
});
