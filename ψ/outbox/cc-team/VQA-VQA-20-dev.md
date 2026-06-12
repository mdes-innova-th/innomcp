<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-20 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":124,"completion_tokens":2240,"total_tokens":2364,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1404,"image_tokens":0},"cache_creation_input_tokens":0} | 28s
 generated: 2026-06-12T04:21:47.193Z -->
import { test, expect } from '@playwright/test';

test('basic chat flow: send message and verify response', async ({ page }) => {
  // (1) Page loads
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // (2) Find chat input (textarea or input with placeholder containing 'chat' or 'message' or 'พิมพ์')
  const chatInput = page.locator([
    'textarea[placeholder*="chat" i]',
    'textarea[placeholder*="message" i]',
    'textarea[placeholder*="พิมพ์" i]',
    'input[placeholder*="chat" i]',
    'input[placeholder*="message" i]',
    'input[placeholder*="พิมพ์" i]',
  ].join(', ')).first();

  await expect(chatInput).toBeVisible({ timeout: 15000 });

  // (3) Type 'hello'
  await chatInput.click();
  await chatInput.fill('hello');

  // (4) Press Enter or click send button
  const sendButton = page.locator([
    'button[aria-label*="send" i]',
    'button[aria-label*="submit" i]',
    'button[type="submit"]',
    '[data-testid="send-button"]',
    'button:has(svg[class*="send" i])',
    'button:has([class*="send" i])',
  ].join(', ')).first();

  const sendButtonVisible = await sendButton.isVisible({ timeout: 2000 }).catch(() => false);

  if (sendButtonVisible) {
    await sendButton.click();
  } else {
    await chatInput.press('Enter');
  }

  // (5) Wait 3s
  await page.waitForTimeout(3000);

  // (6) Assert no error toast appears
  const errorToast = page.locator([
    '[role="alert"]',
    '.toast-error',
    '.error-toast',
    '[data-testid="error-toast"]',
    '[data-testid="toast"]',
    '.toast',
    '.alert-error',
    '.notification-error',
    '[class*="error"][class*="toast"]',
    '[class*="toast"][class*="error"]',
    '[class*="notification"]',
  ].join(', '));

  const visibleErrorToast = errorToast.filter({ hasText: /.+/ });
  await expect(visibleErrorToast).not.toBeVisible({ timeout: 3000 });

  // Also check the page doesn't contain error-related alert text
  const errorAlertText = page.getByText(/error|ผิดพลาด|ล้มเหลว|something went wrong/i);
  await expect(errorAlertText).not.toBeVisible({ timeout: 3000 });

  // (7) Assert some response appears in the messages area
  const messagesArea = page.locator([
    '[class*="message"]',
    '[class*="messages"]',
    '[class*="chat"]',
    '[class*="conversation"]',
    '[class*="response"]',
    '[data-testid="messages"]',
    '[data-testid="chat"]',
    '[data-testid="conversation"]',
    '[role="log"]',
    '[aria-label*="message" i]',
    '[aria-label*="chat" i]',
    '[aria-label*="conversation" i]',
  ].join(', ')).first();

  await expect(messagesArea).toBeVisible({ timeout: 5000 });

  // Verify there is at least one message element containing non-empty text
  const messageWithContent = messagesArea.locator('[class*="message"], [class*="bubble"], [class*="item"], > *').filter({ hasText: /.+/ }).first();
  await expect(messageWithContent).toBeVisible({ timeout: 10000 });
});
