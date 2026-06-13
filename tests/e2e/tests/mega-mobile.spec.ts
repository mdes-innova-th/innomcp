import { test, expect } from '@playwright/test';

test.describe('Living Chat Mobile Responsive', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(30000);

  test.beforeEach(async ({ page }) => {
    // Log in via UI
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Navigate to living-chat
    await page.goto('/living-chat');
    await page.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 });

    // Skip onboarding modal if present
    const skipButton = page.locator('button:has-text("ข้าม")');
    if (await skipButton.isVisible()) {
      await skipButton.click();
      await expect(skipButton).not.toBeVisible();
    }
  });

  test('should not have horizontal overflow', async ({ page }) => {
    const { scrollWidth, innerWidth } = await page.evaluate(() => {
      return {
        scrollWidth: document.scrollWidth,
        innerWidth: window.innerWidth,
      };
    });
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 2);
  });

  test('chat input should be reachable and visible', async ({ page }) => {
    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible();
    await expect(chatInput).toBeInViewport();
  });

  test('sidebar should be collapsed (hidden) on mobile', async ({ page }) => {
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).toBeHidden();

    // Optionally test toggle behavior
    const toggleButton = page.locator('[data-testid="sidebar-toggle"]');
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      await expect(sidebar).toBeVisible();
      await toggleButton.click();
      await expect(sidebar).toBeHidden();
    }
  });
});
