// e2e/living-chat.spec.ts
import { test, expect, Page } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Living Chat Page (Manus-style)', () => {
  let page: Page;
  let errors: string[] = [];
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page: newPage }) => {
    page = newPage;
    errors = [];
    consoleErrors = [];

    // Listen for uncaught JS errors
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Listen for console errors (optional: avoid flaky due to third-party scripts)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test('1. /living-chat returns HTTP 200', async () => {
    const response = await page.goto(`${BASE}/living-chat`);
    expect(response?.status()).toBe(200);

    // Double-check: no navigation error
    expect(errors).toHaveLength(0);
  });

  test('2. Page has <html lang="th">', async () => {
    await page.goto(`${BASE}/living-chat`);
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('th');
  });

  test('3. No uncaught JavaScript errors', async () => {
    await page.goto(`${BASE}/living-chat`);
    // The listener captures errors after navigation; wait a bit for potential async errors
    await page.waitForTimeout(2000);

    // Filter out flaky errors that aren't ours (e.g., third-party tracking)
    const relevantErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('ThirdParty')
    );
    expect(relevantErrors).toHaveLength(0);
  });

  test('4. Title contains "INNOMCP" or "InnoMCP"', async () => {
    await page.goto(`${BASE}/living-chat`);
    await expect(page).toHaveTitle(/INNOMCP|InnoMCP/i);
  });

  test('5. MDES branding visible', async () => {
    await page.goto(`${BASE}/living-chat`);

    // Check for MDES logo image (alt text) or textual branding
    const brandingLogo = page.locator('img[alt="MDES"]');
    const brandingText = page.locator('text=MDES').first();

    const visibleLogo = await brandingLogo.isVisible();
    const visibleText = await brandingText.isVisible();

    expect(visibleLogo || visibleText).toBeTruthy();
  });

  test('6. Chat input exists', async () => {
    await page.goto(`${BASE}/living-chat`);

    const chatInput = page.locator('[data-testid="chat-input"], textarea');
    await expect(chatInput).toBeVisible({ timeout: 10000 });
  });

  test('7. Send button exists', async () => {
    await page.goto(`${BASE}/living-chat`);

    // Using common patterns: a button with Thai "ส่ง" or English "Send", or a testid
    const sendButton = page.locator('[data-testid="send-button"], button:has-text("ส่ง"), button:has-text("Send")');
    await expect(sendButton).toBeVisible({ timeout: 10000 });
  });

  test('8. Page is responsive at 375px and 1440px viewports', async () => {
    await page.goto(`${BASE}/living-chat`);

    // Helper to test a specific viewport
    const testResponsive = async (width: number, height = 800) => {
      await page.setViewportSize({ width, height });

      // Key elements should be visible
      const chatInput = page.locator('[data-testid="chat-input"], textarea');
      await expect(chatInput).toBeVisible();

      const sendButton = page.locator('[data-testid="send-button"], button:has-text("ส่ง"), button:has-text("Send")');
      await expect(sendButton).toBeVisible();

      // No horizontal scrollbar (optional, but proves responsiveness)
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(width);
    };

    // Mobile (375px)
    await testResponsive(375);
    // Desktop (1440px)
    await testResponsive(1440);
  });

  test('9. No console errors about missing modules', async () => {
    await page.goto(`${BASE}/living-chat`);
    // Wait for lazy modules to load
    await page.waitForTimeout(3000);

    const moduleErrors = consoleErrors.filter((msg) =>
      /failed to load module|cannot find module|module not found/i.test(msg)
    );
    expect(moduleErrors).toHaveLength(0);
  });
});