import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Provider Health Indicators on /living-chat', () => {
  const dismissOnboarding = async (page: import('@playwright/test').Page) => {
    try {
      await page.getByText('ข้าม').click();
    } catch {
      // ignore if not present
    }
  };

  test('should display at least one provider health indicator', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/living-chat');
    await dismissOnboarding(page);

    const providerNames: string[] = ['ollama-local', 'anthropic', 'openai'];
    let found = false;
    for (const name of providerNames) {
      const locator = page.getByText(name, { exact: true });
      if (await locator.isVisible()) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  test('each provider health indicator row contains a dot (●)', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/living-chat');
    await dismissOnboarding(page);
    await page.waitForTimeout(1000);

    const providers: string[] = ['ollama-local', 'anthropic', 'openai'];
    for (const name of providers) {
      const row = page.locator(`text="${name}"`).first();
      if (await row.isVisible()) {
        await expect(row.locator('..').locator('text=●')).toBeVisible();
      }
    }
  });

  test('provider names are rendered in the UI', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/living-chat');
    await dismissOnboarding(page);

    const expectedNames: string[] = ['ollama-local', 'anthropic', 'openai'];
    for (const name of expectedNames) {
      const count = await page.locator(`text="${name}"`).count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('edge case: provider health indicators persist after page navigation', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/living-chat');
    await dismissOnboarding(page);

    const providers: string[] = ['ollama-local', 'anthropic', 'openai'];
    let initialVisible = 0;
    for (const name of providers) {
      if (await page.getByText(name).isVisible()) {
        initialVisible++;
      }
    }

    await page.goto('/');
    await dismissOnboarding(page);
    await page.goto('/living-chat');
    await dismissOnboarding(page);

    let afterVisible = 0;
    for (const name of providers) {
      if (await page.getByText(name).isVisible()) {
        afterVisible++;
      }
    }
    expect(afterVisible).toBeGreaterThanOrEqual(initialVisible);
  });
});
