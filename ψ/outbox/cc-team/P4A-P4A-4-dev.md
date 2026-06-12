<!-- cc-team deliverable
 group: P4A (Phase 4.1 â€” Playwright browser runtime audit script)
 member: P4A-4 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":83,"completion_tokens":1230,"total_tokens":1313,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1003,"image_tokens":0},"cache_creation_input_tokens":0} | 18s
 generated: 2026-06-12T03:43:38.395Z -->
import { test, expect } from '@playwright/test';

test.describe('Browser Audit', () => {
  test('should load page, show key elements, and have no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // MDESBrandHeader visible
    await expect(page.locator('[data-testid="mdes-brand-header"]')).toBeVisible();

    // Chat input focusable
    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible();
    await chatInput.focus();
    await expect(chatInput).toBeFocused();

    // Workspace panel present
    await expect(page.locator('[data-testid="workspace-panel"]')).toBeVisible();

    // 0 console errors
    expect(errors).toHaveLength(0);
  });
});
