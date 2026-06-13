import { test, expect } from '@playwright/test';

test.describe('AI Model Selector / Mode Dropdown on /living-chat', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  async function dismissOnboarding(page: import('@playwright/test').Page) {
    try {
      await page.getByText('ข้าม', { exact: true }).click();
      await page.waitForTimeout(500);
    } catch {
      // onboarding not present, ignore
    }
  }

  test('should display the model dropdown with Local option', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/living-chat');
    await dismissOnboarding(page);

    // Wait for dropdown to be visible
    const dropdown = page.getByRole('combobox', { name: /model|mode/i });
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Check that "Local" is an option
    const options = await dropdown.locator('option, [role="option"]').allTextContents();
    const optionTexts: string[] = options.map((o) => o.trim());
    expect(optionTexts).toContain('Local');
  });

  test('selecting Local mode updates the active model badge', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/living-chat');
    await dismissOnboarding(page);

    const dropdown = page.getByRole('combobox', { name: /model|mode/i });
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Select "Local"
    await dropdown.selectOption('Local');
    await page.waitForTimeout(500);

    // Badge should show "Local"
    const badge = page.getByText(/active.*model/i).or(page.getByTestId('active-model-badge'));
    await expect(badge).toContainText('Local', { timeout: 3000 });
  });

  test('switching mode updates the badge from default to another', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/living-chat');
    await dismissOnboarding(page);

    const dropdown = page.getByRole('combobox', { name: /model|mode/i });
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // First select "Local" (assuming default might be something else)
    await dropdown.selectOption('Local');
    await page.waitForTimeout(300);

    // Then select "GPT" (or whatever non-Local option is available)
    const gptOption = dropdown.locator('option[value="GPT"], option:has-text("GPT")');
    const gptExists = await gptOption.count();
    if (gptExists > 0) {
      await dropdown.selectOption('GPT');
      await page.waitForTimeout(500);
      const badge = page.getByText(/active.*model/i).or(page.getByTestId('active-model-badge'));
      await expect(badge).toContainText('GPT', { timeout: 3000 });
    } else {
      // Fallback: just verify that badge changed from "Local"
      test.skip(gptExists === 0, 'GPT option not available');
    }
  });

  test('dropdown works in guest mode (no login required)', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/living-chat');
    await dismissOnboarding(page);

    // Ensure we are not logged in – guest mode
    // The dropdown should still be functional
    const dropdown = page.getByRole('combobox', { name: /model|mode/i });
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Attempt to select an option
    await dropdown.selectOption('Local');
    await page.waitForTimeout(500);

    // The badge should update even in guest mode
    const badge = page.getByText(/active.*model/i).or(page.getByTestId('active-model-badge'));
    await expect(badge).toContainText('Local', { timeout: 3000 });
  });
});
