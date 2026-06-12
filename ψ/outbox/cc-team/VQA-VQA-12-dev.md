<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-12 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":96,"completion_tokens":1436,"total_tokens":1532,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":971,"image_tokens":0},"cache_creation_input_tokens":0} | 22s
 generated: 2026-06-12T04:21:19.082Z -->
import { test, expect } from '@playwright/test';

test('error boundaries prevent full-page crash when ManusWorkspacePanel fails', async ({ page }) => {
  // Track JS page errors and console errors
  const pageErrors: Error[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (err) => pageErrors.push(err));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Intercept the API request that ManusWorkspacePanel depends on to simulate failure
  await page.route('**/api/manus-panel-data**', async (route) => {
    await route.abort('connectionrefused');
  });

  await page.goto('/'); // Adjust to the actual route where ManusWorkspacePanel is rendered
  await page.waitForLoadState('networkidle');

  // Verify that the page still has visible content outside the error boundary
  // For example, a header, sidebar, or main layout element should be visible
  const header = page.locator('header, [data-testid="app-header"], .navbar, #header');
  await expect(header).toBeVisible({ timeout: 10000 });

  // Ensure there is no blank screen – at least one non‑error element is present
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.length).toBeGreaterThan(0);

  // Verify that no fatal JS exceptions occurred (pageerror events should be empty)
  expect(pageErrors.length).toBe(0);

  // Verify that console errors were logged (the failure should cause an error log)
  expect(consoleErrors.length).toBeGreaterThan(0);

  // The error log messages should not indicate a full page crash (they are expected boundary catches)
  // Additional assertion: the error boundary fallback UI might be visible, but that's optional
  const fallbackContent = page.locator('[data-testid="error-boundary-fallback"], .error-fallback');
  if (await fallbackContent.count() > 0) {
    await expect(fallbackContent).toBeVisible();
  }
});
