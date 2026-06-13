import { test, expect } from '@playwright/test';

test.describe('Theme Toggle', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.setTimeout(30000);

  const dismissOnboarding = async (page: import('@playwright/test').Page) => {
    try {
      await page.getByText('ข้าม').click({ timeout: 5000 });
      // Wait for modal to close
      await page.waitForTimeout(500);
    } catch {
      // Onboarding may not appear (e.g. if already dismissed)
    }
  };

  test('theme toggle button exists and toggles html class from light to dark', async ({ page }) => {
    await page.goto('/living-chat');
    await dismissOnboarding(page);

    const toggleButton = page.getByRole('button', { name: 'Toggle theme' });
    await expect(toggleButton).toBeVisible();

    // Initially should be light mode
    let htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).not.toContain('dark');

    // Click to toggle to dark
    await toggleButton.click();
    await page.waitForTimeout(300);
    htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).toContain('dark');

    // Click again to toggle back to light
    await toggleButton.click();
    await page.waitForTimeout(300);
    htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).not.toContain('dark');
  });

  test('theme preference persists after page reload', async ({ page }) => {
    await page.goto('/living-chat');
    await dismissOnboarding(page);

    const toggleButton = page.getByRole('button', { name: 'Toggle theme' });
    await expect(toggleButton).toBeVisible();

    // Switch to dark mode
    await toggleButton.click();
    await page.waitForTimeout(300);
    let htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).toContain('dark');

    // Reload page
    await page.reload();
    await dismissOnboarding(page);

    // After reload, dark mode should persist
    htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).toContain('dark');
  });

  test('theme toggle works on dashboard page', async ({ page }) => {
    await page.goto('/dashboard');
    await dismissOnboarding(page);

    const toggleButton = page.getByRole('button', { name: 'Toggle theme' });
    await expect(toggleButton).toBeVisible();

    // Toggle to dark
    await toggleButton.click();
    await page.waitForTimeout(300);
    let htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).toContain('dark');

    // Navigate to living-chat, theme should remain dark
    await page.goto('/living-chat');
    await dismissOnboarding(page);
    htmlClass = await page.evaluate(() => document.documentElement.className);
    expect(htmlClass).toContain('dark');
  });
});
