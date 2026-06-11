import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('MDES Brand Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
  });

  test('1. Page title includes "INNOMCP"', async ({ page }) => {
    await expect(page).toHaveTitle(/INNOMCP/);
  });

  test('2. MDESBrandHeader visible with "🇹🇭 MDES" text', async ({ page }) => {
    const header = page.locator('[data-testid="mdes-brand-header"]');
    await expect(header).toBeVisible();
    await expect(header).toContainText('🇹🇭 MDES');
  });

  test('3. "ศูนย์ MCP ภาครัฐ" subtitle visible', async ({ page }) => {
    await expect(page.getByText('ศูนย์ MCP ภาครัฐ')).toBeVisible();
  });

  test('4. StatusRibbon shows "พร้อมใช้งาน"', async ({ page }) => {
    // This assumes the ribbon displays "พร้อมใช้งาน" in the default state.
    // If the status can vary, you may need to adjust the expected text accordingly.
    const ribbon = page.locator('[data-testid="status-ribbon"]');
    await expect(ribbon).toBeVisible();
    await expect(ribbon).toContainText('พร้อมใช้งาน');
  });

  test('5. ⚙️ settings button opens settings panel', async ({ page }) => {
    const settingsButton = page.locator('[data-testid="settings-button"]');
    await expect(settingsButton).toBeVisible();

    // Open the panel
    await settingsButton.click();

    const settingsPanel = page.locator('[data-testid="settings-panel"]');
    await expect(settingsPanel).toBeVisible();
  });

  test('6. Cloud/Local toggle works (visual state changes)', async ({ page }) => {
    // Assumes a toggle button/switch with a test ID or role="switch"
    const toggle = page.locator('[data-testid="cloud-local-toggle"]');
    await expect(toggle).toBeVisible();

    // Capture initial state (for example, via aria-checked or a data-state attribute)
    const initialState = (await toggle.getAttribute('aria-checked')) ?? 'false';

    // Toggle
    await toggle.click();

    // Verify the state changed (i.e., the opposite of the initial state)
    await expect(toggle).not.toHaveAttribute('aria-checked', initialState);
  });

  test('7. Default provider badge shows MDES', async ({ page }) => {
    const badge = page.locator('[data-testid="default-provider-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/MDES/);
  });

  test('8. StarterPromptsGrid shows Thai government prompts', async ({ page }) => {
    const grid = page.locator('[data-testid="starter-prompts-grid"]');
    await expect(grid).toBeVisible();

    // Ensure at least one Thai government-related prompt is displayed
    // Example words: "คำร้อง", "ขออนุมัติ", "บริการภาครัฐ", "นโยบาย"
    await expect(grid).toContainText(/คำร้อง|ขออนุมัติ|บริการภาครัฐ|นโยบาย/);
  });

  test('9. GovernmentQuickActions visible on empty state', async ({ page }) => {
    // On a fresh page, the chat input should be empty, showing the quick actions panel
    const quickActions = page.locator('[data-testid="government-quick-actions"]');
    await expect(quickActions).toBeVisible();
  });

  test('10. Keyboard shortcut ? shows help when input focused + empty', async ({ page }) => {
    const chatInput = page.locator('[data-testid="chat-input"]');

    // Focus and ensure the input is empty
    await chatInput.click();
    await chatInput.fill('');

    // Trigger the shortcut
    await page.keyboard.press('?');

    // Verify the help dialog appears
    const helpDialog = page.locator('[data-testid="help-dialog"]');
    await expect(helpDialog).toBeVisible();
  });
});