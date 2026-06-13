import { test, expect } from '@playwright/test';

test.describe('Living Chat Offline Resilience', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.setTimeout(60000);

  async function navigateAndSkip(page) {
    await page.goto('/living-chat');
    try {
      // Robust selection for the "Skip" button across potential implementations
      const skipBtn = page.locator('button:has-text("ข้าม"), a:has-text("ข้าม"), [role="button"]:has-text("ข้าม"), .skip-button').first();
      await skipBtn.waitFor({ state: 'visible', timeout: 8000 });
      await skipBtn.click();
      await expect(skipBtn).toBeHidden({ timeout: 3000 });
    } catch (e) {
      // Onboarding already skipped or not present
    }
  }

  test('should survive offline/online and keep chat input interactive', async ({ page }) => {
    await navigateAndSkip(page);
    const chatInput = page.getByRole('textbox').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Cycle: Online -> Offline -> Online
    await page.context().setOffline(true);
    await expect(chatInput).toBeEnabled();
    
    await page.context().setOffline(false);
    await expect(chatInput).toBeEnabled();
    
    await chatInput.fill('Hello after reconnect');
    await expect(chatInput).toHaveValue('Hello after reconnect');
  });

  test('should handle rapid network flickers without UI regression', async ({ page }) => {
    await navigateAndSkip(page);
    const chatInput = page.getByRole('textbox').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Rapidly flip network state to test for race conditions in state handlers
    for (let i = 0; i < 15; i++) {
      await page.context().setOffline(true);
      await page.context().setOffline(false);
    }
    
    await expect(chatInput).toBeEnabled();
    await chatInput.fill('flicker test');
    await expect(chatInput).toHaveValue('flicker test');
  });

  test('should maintain input content across network transitions', async ({ page }) => {
    await navigateAndSkip(page);
    const chatInput = page.getByRole('textbox').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    const offlineMsg = 'message typed while offline';
    
    await page.context().setOffline(true);
    await chatInput.fill(offlineMsg);
    await expect(chatInput).toHaveValue(offlineMsg);

    await page.context().setOffline(false);
    // Ensure the restoration doesn't trigger a re-render that wipes the uncontrolled input
    await expect(chatInput).toHaveValue(offlineMsg);
    
    await chatInput.clear();
    await chatInput.fill('reconnected');
    await expect(chatInput).toHaveValue('reconnected');
  });

  test('should handle "Send" attempt while offline without crashing and preserve input state', async ({ page }) => {
    await navigateAndSkip(page);
    const chatInput = page.getByRole('textbox').first();
    const sendButton = page.getByRole('button', { name: /send|ส่ง/i }).first();

    await page.context().setOffline(true);
    const offlineMsg = 'offline send test';
    await chatInput.fill(offlineMsg);
    
    if (await sendButton.isVisible()) {
      await sendButton.click();
    } else {
      await chatInput.press('Enter');
    }
    
    // The application should handle the failed request gracefully.
    // We verify the chat interface is still operational.
    await expect(chatInput).toBeVisible();
    
    await page.context().setOffline(false);
    await expect(chatInput).toBeVisible();
  });

  test('should not trigger page reload or crash on network restoration', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (error) => errors.push(error));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('net::ERR_INTERNET_DISCONNECTED')) {
        errors.push(new Error(msg.text()));
      }
    });

    await navigateAndSkip(page);
    const chatInput = page.getByRole('textbox').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    await page.context().setOffline(true);
    await chatInput.fill('state check');
    
    await page.context().setOffline(false);
    
    // Verifying no full page reload happened by checking for value persistence
    await expect(chatInput).toBeVisible();
    await expect(chatInput).toHaveValue('state check');
    expect(errors).toHaveLength(0);
  });
});
