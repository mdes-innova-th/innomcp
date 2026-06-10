import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Manus-style Chat Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL + '/living-chat');
    await page.waitForLoadState('networkidle');
  });

  test('should display the Manus-style 3-column layout', async ({ page }) => {
    // The main layout container with three columns
    const layout = page.locator('[data-testid="three-column-layout"]');
    await expect(layout).toBeVisible();

    // Ensure the workspace panel (left) is present (might be closed by default)
    const workspacePanel = page.locator('[data-testid="workspace-panel"]');
    // It may be hidden initially; we only check that it exists in DOM
    await expect(workspacePanel).toBeAttached();

    // The central chat area should always be visible
    const chatArea = page.locator('[data-testid="chat-area"]');
    await expect(chatArea).toBeVisible();

    // The right panel (settings) container may be hidden; just check existence
    const rightPanel = page.locator('[data-testid="right-panel"]');
    await expect(rightPanel).toBeAttached();
  });

  test('MDESBrandHeader shows MDES brand', async ({ page }) => {
    const header = page.locator('[data-testid="mdes-brand-header"]');
    await expect(header).toBeVisible();
    // Thai UI string: กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม or simply MDES
    await expect(header).toContainText('MDES');
  });

  test('Workspace panel toggles on click', async ({ page }) => {
    const toggleButton = page.locator('[data-testid="workspace-toggle-button"]');
    const panel = page.locator('[data-testid="workspace-panel"]');

    // Initially check the data-state attribute
    const initialState = await panel.getAttribute('data-state');
    expect(['open', 'closed']).toContain(initialState);

    // Click toggle
    await toggleButton.click();
    // After click, the state should have changed
    const newState = panel.getAttribute('data-state');
    await expect(newState).resolves.toBe(initialState === 'open' ? 'closed' : 'open');

    // Toggle again to revert
    await toggleButton.click();
    await expect(panel.getAttribute('data-state')).resolves.toBe(initialState);
  });

  test('⚙️ settings button opens ModelSettingsPanel', async ({ page }) => {
    const settingsButton = page.locator('[data-testid="settings-button"]');
    const settingsPanel = page.locator('[data-testid="model-settings-panel"]');

    // Panel should not be visible initially (or it might be – our app might start with it closed)
    // We'll check it is hidden
    await expect(settingsPanel).toBeHidden();

    // Click the settings button
    await settingsButton.click();
    // Now panel should be visible
    await expect(settingsPanel).toBeVisible();
  });

  test('Provider toggle switches cloud/local', async ({ page }) => {
    // First ensure settings panel is open
    const settingsButton = page.locator('[data-testid="settings-button"]');
    await settingsButton.click();

    const cloudOption = page.locator('[data-testid="provider-toggle-cloud"]');
    const localOption = page.locator('[data-testid="provider-toggle-local"]');

    // By default, let's assume cloud is selected/has aria-pressed="true"
    // We'll get the initial pressed states
    const cloudPressed = await cloudOption.getAttribute('aria-pressed');
    const localPressed = await localOption.getAttribute('aria-pressed');
    expect(cloudPressed).toBe('true');
    expect(localPressed).toBe('false');

    // Click local option
    await localOption.click();
    // Now local should be pressed, cloud not
    await expect(cloudOption).toHaveAttribute('aria-pressed', 'false');
    await expect(localOption).toHaveAttribute('aria-pressed', 'true');

    // Switch back to cloud
    await cloudOption.click();
    await expect(cloudOption).toHaveAttribute('aria-pressed', 'true');
    await expect(localOption).toHaveAttribute('aria-pressed', 'false');
  });

  test('Empty state shows ChatWelcomeHero', async ({ page }) => {
    // When no conversation has started, the welcome hero should be visible
    const welcomeHero = page.locator('[data-testid="chat-welcome-hero"]');
    await expect(welcomeHero).toBeVisible();

    // It should contain some introductory content (e.g., MDES branding, welcome message)
    await expect(welcomeHero).toContainText('ยินดีต้อนรับ'); // Thai welcome
  });

  test('GovernmentQuickActions are clickable', async ({ page }) => {
    // Gather all government quick action buttons
    const quickActions = page.locator('[data-testid^="government-quick-action"]');
    const count = await quickActions.count();
    // Ensure there are some actions
    expect(count).toBeGreaterThan(0);

    // Click the first action
    const firstAction = quickActions.nth(0);
    await firstAction.click();

    // After clicking, the welcome hero should disappear (a conversation started)
    const welcomeHero = page.locator('[data-testid="chat-welcome-hero"]');
    await expect(welcomeHero).toBeHidden();

    // A message should appear in the message list
    const messageList = page.locator('[data-testid="message-list"]');
    const messages = messageList.locator('[data-testid="message-item"]');
    await expect(messages).toHaveCount(1);
  });

  test('StarterPromptsGrid populates chat input', async ({ page }) => {
    // Locate the first starter prompt item
    const firstPrompt = page.locator('[data-testid="starter-prompt-item-0"]');
    // Get its text content
    const promptText = await firstPrompt.textContent();
    expect(promptText).not.toBeNull();
    
    // Click it
    await firstPrompt.click();

    // The chat input should now contain that text
    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toHaveValue(promptText!.trim());
  });
});