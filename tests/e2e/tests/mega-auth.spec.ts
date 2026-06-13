import { test, expect, type Page } from '@playwright/test';

test.describe('Login Page', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const dismissOnboarding = async (page: Page) => {
    try {
      const skipButton = page.getByText('ข้าม');
      await skipButton.waitFor({ state: 'visible', timeout: 3000 });
      await skipButton.click();
    } catch {
      // Onboarding not shown or already dismissed
    }
  };

  test('renders login form with email, password fields and submit button', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/login');
    await dismissOnboarding(page);

    const emailInput = page.getByLabel(/อีเมล|email/i);
    await expect(emailInput).toBeVisible();
    const passwordInput = page.getByLabel(/รหัสผ่าน|password/i);
    await expect(passwordInput).toBeVisible();
    const submitButton = page.getByRole('button', { name: /เข้าสู่ระบบ|login/i });
    await expect(submitButton).toBeVisible();
  });

  test('navigating to /login from guest shows login CTA', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/login');
    await dismissOnboarding(page);

    const loginCTA = page.getByRole('button', { name: /เข้าสู่ระบบ|login/i });
    await expect(loginCTA).toBeVisible();
    // Confirm we are still on the login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('invalid credentials show Thai error', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/login');
    await dismissOnboarding(page);

    const emailInput = page.getByLabel(/อีเมล|email/i);
    await emailInput.fill('invalid@example.com');
    const passwordInput = page.getByLabel(/รหัสผ่าน|password/i);
    await passwordInput.fill('wrongpassword');

    const submitButton = page.getByRole('button', { name: /เข้าสู่ระบบ|login/i });
    await submitButton.click();

    const errorMessage = page.getByText(/อีเมลหรือรหัสผ่านไม่ถูกต้อง|เข้าสู่ระบบไม่สำเร็จ|ข้อผิดพลาด/i);
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});
