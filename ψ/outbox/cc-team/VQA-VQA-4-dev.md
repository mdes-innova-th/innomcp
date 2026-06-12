<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-4 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":116,"completion_tokens":2698,"total_tokens":2814,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2456,"image_tokens":0},"cache_creation_input_tokens":0} | 37s
 generated: 2026-06-12T04:21:10.368Z -->
import { test, expect } from '@playwright/test';

test('MDESBrandHeader is sticky and visible', async ({ page }) => {
  await page.goto('http://localhost:3001');

  // Locate the header element that contains either 'MDES INNOMCP' or 'ศูนย์ MCP'
  const header = page.locator('header, [role="banner"]')
    .filter({ hasText: /MDES INNOMCP|ศูนย์ MCP/ })
    .first();

  // Step 2 & 4: ensure it is visible initially
  await expect(header).toBeVisible();

  // Step 3: scroll down to trigger sticky behaviour
  await page.evaluate(() => window.scrollTo(0, 500));

  // After scrolling, the header should remain visible
  await expect(header).toBeVisible();

  // getBoundingClientRect().top === 0 after scrolling means the header is stuck to the top
  const boundingBox = await header.boundingBox();
  expect(boundingBox?.y, 'Header should be stuck to the top after scrolling').toBe(0);
});
