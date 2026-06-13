import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('INNOMCP Dashboard and Chat', () => {
  async function dismissOnboarding(page: import('playwright').Page): Promise<void> {
    try {
      const skipButton = page.getByText('ข้าม');
      await skipButton.waitFor({ state: 'visible', timeout: 3000 });
      await skipButton.click();
    } catch {
      // onboarding not present – ignore
    }
  }

  test('Dashboard redirects to login for guest and title contains INNOMCP', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/dashboard');
    await dismissOnboarding(page);
    // Expect to be redirected to /login (or stay at /dashboard if logged in)
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveTitle(/INNOMCP/);
    // Login page should have a form or button (use a common role)
    await expect(page.getByRole('button', { name: /Login|Sign in|เข้าสู่ระบบ/i })).toBeVisible({ timeout: 3000 });
  });

  test('Login page loads with correct title and UI elements', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/login');
    await dismissOnboarding(page);
    await expect(page).toHaveTitle(/INNOMCP/);
    // Assert presence of either a login button or a heading
    const loginButton = page.getByRole('button', { name: /Login|Sign in|เข้าสู่ระบบ/i });
    const loginHeading = page.getByRole('heading', { name: /Login|Sign in|เข้าสู่ระบบ/i });
    await expect(loginButton.or(loginHeading).first()).toBeVisible({ timeout: 3000 });
  });

  test('Living chat route redirects to login for guest', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/living-chat');
    await dismissOnboarding(page);
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveTitle(/INNOMCP/);
  });

  test('Root route redirects appropriately and title contains INNOMCP', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/');
    await dismissOnboarding(page);
    // Root likely redirects to /dashboard or /login – wait for any final URL
    await page.waitForURL(/\/(login|dashboard)/, { timeout: 5000 });
    await expect(page).toHaveTitle(/INNOMCP/);
  });

  test('Edge case: visiting a non-existent route shows a 404 page with INNOMCP title', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/non-existent-route');
    await dismissOnboarding(page);
    // The Next.js 404 page should still contain 'INNOMCP' in the title
    await expect(page).toHaveTitle(/INNOMCP/);
    await expect(page.getByText(/404|not found|ไม่พบ/i)).toBeVisible({ timeout: 3000 });
  });
});
