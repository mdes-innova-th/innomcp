import { test, expect } from '@playwright/test';

test.describe('Living Chat spec', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.setTimeout(30000);

  async function skipOnboarding(page) {
    try {
      await page.getByText('ข้าม').click();
      await page.waitForTimeout(500);
    } catch {}
  }

  test('chat input and Send button render', async ({ page }) => {
    await page.goto('/living-chat');
    await skipOnboarding(page);
    const input = page.getByPlaceholder(/พิมพ์|Type your message/i);
    const sendButton = page.getByRole('button', { name: /Send|ส่ง/i });
    await expect(input).toBeVisible();
    await expect(sendButton).toBeVisible();
  });

  test('typing a message enables Send button', async ({ page }) => {
    await page.goto('/living-chat');
    await skipOnboarding(page);
    const input = page.getByPlaceholder(/พิมพ์|Type your message/i);
    const sendButton = page.getByRole('button', { name: /Send|ส่ง/i });
    await expect(sendButton).toBeDisabled();
    await input.fill('Hello');
    await expect(sendButton).not.toBeDisabled();
  });

  test('message appears in transcript after send', async ({ page }) => {
    await page.goto('/living-chat');
    await skipOnboarding(page);
    const input = page.getByPlaceholder(/พิมพ์|Type your message/i);
    const sendButton = page.getByRole('button', { name: /Send|ส่ง/i });
    const testMessage = 'สวัสดี test';
    await input.fill(testMessage);
    await sendButton.click();
    await expect(page.getByText(testMessage)).toBeVisible();
  });

  test('mode selector shows Local', async ({ page }) => {
    await page.goto('/living-chat');
    await skipOnboarding(page);
    const modeButton = page.getByRole('button', { name: /Local/ });
    await expect(modeButton).toBeVisible();
  });

  test('clearing input disables Send button', async ({ page }) => {
    await page.goto('/living-chat');
    await skipOnboarding(page);
    const input = page.getByPlaceholder(/พิมพ์|Type your message/i);
    const sendButton = page.getByRole('button', { name: /Send|ส่ง/i });
    await expect(sendButton).toBeDisabled();
    await input.fill('Hello');
    await expect(sendButton).not.toBeDisabled();
    await input.fill('');
    await page.waitForTimeout(200);
    await expect(sendButton).toBeDisabled();
  });
});
