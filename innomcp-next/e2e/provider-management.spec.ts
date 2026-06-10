import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Provider Management', () => {
  test('gear button in MDESBrandHeader opens ModelSettingsPanel', async ({ page }) => {
    await page.goto(BASE_URL);
    const gearButton = page.locator('[data-testid="settings-toggle"]');
    await expect(gearButton).toBeVisible();
    await gearButton.click();
    const panel = page.locator('[data-testid="model-settings-panel"]');
    await expect(panel).toBeVisible();
  });

  test('ModelSettingsPanel is visible (right slide-in panel)', async ({ page }) => {
    await page.goto(BASE_URL);
    // open panel first
    const gearButton = page.locator('[data-testid="settings-toggle"]');
    await gearButton.click();
    const panel = page.locator('[data-testid="model-settings-panel"]');
    await expect(panel).toBeVisible();
    // Verify slide-in position or transition class if needed
    await expect(panel).toHaveAttribute('data-side', 'right');
  });

  test('ProviderModal can be opened', async ({ page }) => {
    await page.goto(BASE_URL);
    const gearButton = page.locator('[data-testid="settings-toggle"]');
    await gearButton.click();
    // Assume panel contains an "add provider" button
    const addButton = page.getByRole('button', { name: 'เพิ่มผู้ให้บริการ' });
    await addButton.click();
    const modal = page.locator('[data-testid="provider-modal"]');
    await expect(modal).toBeVisible();
  });

  test('provider type dropdown works', async ({ page }) => {
    await page.goto(BASE_URL);
    // open panel and then modal
    const gearButton = page.locator('[data-testid="settings-toggle"]');
    await gearButton.click();
    const addButton = page.getByRole('button', { name: 'เพิ่มผู้ให้บริการ' });
    await addButton.click();
    await expect(page.locator('[data-testid="provider-modal"]')).toBeVisible();

    const typeSelect = page.getByLabel('ประเภทผู้ให้บริการ');
    await typeSelect.selectOption({ label: 'Anthropic' });
    await expect(typeSelect).toHaveValue('anthropic');
  });

  test('base URL input accepts text', async ({ page }) => {
    await page.goto(BASE_URL);
    // open panel and modal
    const gearButton = page.locator('[data-testid="settings-toggle"]');
    await gearButton.click();
    const addButton = page.getByRole('button', { name: 'เพิ่มผู้ให้บริการ' });
    await addButton.click();
    await expect(page.locator('[data-testid="provider-modal"]')).toBeVisible();

    const baseUrlInput = page.getByLabel(/Base URL|URL พื้นฐาน/i);
    await baseUrlInput.fill('https://api.example.com/v1');
    await expect(baseUrlInput).toHaveValue('https://api.example.com/v1');
  });

  test('API Key input is type="password" (masked)', async ({ page }) => {
    await page.goto(BASE_URL);
    // open panel and modal
    const gearButton = page.locator('[data-testid="settings-toggle"]');
    await gearButton.click();
    const addButton = page.getByRole('button', { name: 'เพิ่มผู้ให้บริการ' });
    await addButton.click();
    await expect(page.locator('[data-testid="provider-modal"]')).toBeVisible();

    const apiKeyInput = page.getByLabel(/API Key|รหัส API/i);
    await expect(apiKeyInput).toHaveAttribute('type', 'password');
  });

  test('"ทดสอบการเชื่อมต่อ" button is present', async ({ page }) => {
    await page.goto(BASE_URL);
    // open panel and modal
    const gearButton = page.locator('[data-testid="settings-toggle"]');
    await gearButton.click();
    const addButton = page.getByRole('button', { name: 'เพิ่มผู้ให้บริการ' });
    await addButton.click();
    await expect(page.locator('[data-testid="provider-modal"]')).toBeVisible();

    const testButton = page.getByRole('button', { name: 'ทดสอบการเชื่อมต่อ' });
    await expect(testButton).toBeVisible();
  });

  test('provider presets section exists (8 presets)', async ({ page }) => {
    await page.goto(BASE_URL);
    const gearButton = page.locator('[data-testid="settings-toggle"]');
    await gearButton.click();
    await expect(page.locator('[data-testid="model-settings-panel"]')).toBeVisible();

    const presetsContainer = page.locator('[data-testid="provider-presets"]');
    await expect(presetsContainer).toBeVisible();
    const presetItems = presetsContainer.locator('button'); // each preset is a button
    await expect(presetItems).toHaveCount(8);
  });

  test('clicking a preset fills the form', async ({ page }) => {
    await page.goto(BASE_URL);
    const gearButton = page.locator('[data-testid="settings-toggle"]');
    await gearButton.click();
    await expect(page.locator('[data-testid="model-settings-panel"]')).toBeVisible();

    const presetItems = page.locator('[data-testid="provider-presets"] button');
    // click first preset
    await presetItems.first().click();

    // expect provider modal to open with pre-filled data
    const modal = page.locator('[data-testid="provider-modal"]');
    await expect(modal).toBeVisible();

    // check that base URL input is filled (not empty)
    const baseUrlInput = page.getByLabel(/Base URL|URL พื้นฐาน/i);
    await expect(baseUrlInput).not.toHaveValue('');
  });

  test('closing the settings panel works', async ({ page }) => {
    await page.goto(BASE_URL);
    const gearButton = page.locator('[data-testid="settings-toggle"]');
    await gearButton.click();
    const panel = page.locator('[data-testid="model-settings-panel"]');
    await expect(panel).toBeVisible();

    const closeButton = panel.getByRole('button', { name: 'ปิด' });
    await closeButton.click();
    await expect(panel).not.toBeVisible();
  });
});