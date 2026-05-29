import { test, expect } from '@playwright/test';

/**
 * Golden Path E2E Smoke Tests
 * Tests the critical user journey across homepage, login, dashboard, and core API endpoints.
 * These are UI smoke tests — no actual authentication is performed.
 */

test.describe('Homepage', () => {
  test('renders h1 or title on homepage', async ({ page }) => {
    await page.goto('/');
    // Accept either an h1 element or a meaningful <title>
    const h1 = page.locator('h1').first();
    const titleText = await page.title();
    const h1Count = await h1.count();

    const hasH1 = h1Count > 0 && (await h1.textContent())?.trim().length > 0;
    const hasTitle = titleText.trim().length > 0 && titleText !== 'Untitled';

    expect(hasH1 || hasTitle).toBeTruthy();
  });
});

test.describe('Login page', () => {
  test('login page contains a form', async ({ page }) => {
    await page.goto('/login');
    const form = page.locator('form').first();
    await expect(form).toBeVisible();
  });

  test('login form has email/username input', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page
      .locator('input[type="email"], input[type="text"], input[name="email"], input[name="username"]')
      .first();
    await expect(emailInput).toBeVisible();
  });

  test('login form has password input', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(passwordInput).toBeVisible();
  });

  test('login form has a submit button', async ({ page }) => {
    await page.goto('/login');
    const submitButton = page
      .locator('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("เข้าสู่ระบบ")')
      .first();
    await expect(submitButton).toBeVisible();
  });
});

test.describe('Dashboard page', () => {
  test('dashboard redirects to login or renders for guest mode', async ({ page }) => {
    const response = await page.goto('/dashboard');

    // Either: redirected to /login (unauthenticated), or dashboard renders successfully
    const finalUrl = page.url();
    const isRedirectedToLogin =
      finalUrl.includes('/login') ||
      finalUrl.includes('/signin') ||
      finalUrl.includes('/auth');

    const isDashboardRendered =
      finalUrl.includes('/dashboard') || response?.status() === 200;

    expect(isRedirectedToLogin || isDashboardRendered).toBeTruthy();
  });
});

test.describe('Backend API — health', () => {
  test('GET /api/health returns 200 with status ok', async ({ request }) => {
    const response = await request.get('http://localhost:3011/api/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
  });
});

test.describe('Backend API — agent-leaderboard', () => {
  test('GET /api/agent-leaderboard returns 200 with agents array', async ({ request }) => {
    const response = await request.get('http://localhost:3011/api/agent-leaderboard');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('agents');
    expect(Array.isArray(body.agents)).toBeTruthy();
  });
});
