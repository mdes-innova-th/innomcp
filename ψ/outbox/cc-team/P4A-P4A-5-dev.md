<!-- cc-team deliverable
 group: P4A (Phase 4.1 â€” Playwright browser runtime audit script)
 member: P4A-5 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":87,"completion_tokens":1870,"total_tokens":1957,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1579,"image_tokens":0},"cache_creation_input_tokens":0} | 38s
 generated: 2026-06-12T03:44:01.742Z -->
import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 375, height: 812 },
];

for (const viewport of viewports) {
  test.describe(`Responsive layout at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('page loads, header is visible, and no horizontal overflow', async ({ page }) => {
      await page.goto('/');
      
      const header = page.locator('header, [role="banner"]').first();
      await expect(header).toBeVisible();

      const hasHorizontalOverflow = await page.evaluate(() => {
        const docScrollWidth = document.documentElement.scrollWidth;
        const bodyScrollWidth = document.body ? document.body.scrollWidth : 0;
        const clientWidth = document.documentElement.clientWidth;
        return Math.max(docScrollWidth, bodyScrollWidth) > clientWidth;
      });

      expect(hasHorizontalOverflow).toBe(false);
    });
  });
}
