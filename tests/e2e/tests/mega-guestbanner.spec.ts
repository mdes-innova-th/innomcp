import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 }, baseURL: 'http://localhost:3000' });

test.describe('Guest mode banner', () => {
  const dismissOnboarding = async (page: import('playwright').Page) => {
    try {
      await page.getByText('ข้าม').click();
    } catch {
      // onboarding may not be present
    }
  };

  test('should show guest mode banner with usage percentage and login CTA', async ({ page }) => {
    await page.goto('/living-chat');
    await dismissOnboarding(page);
    await page.getByText('ใช้งานได้ประมาณ 50%').waitFor({ state: 'visible', timeout: 5000 });
    const banner = page.getByText('ใช้งานได้ประมาณ 50%');
    await expect(banner).toBeVisible();
    const loginCta = page.getByRole('link', { name: 'เข้าสู่ระบบ' });
    await expect(loginCta).toBeVisible();
  });

  test('should dismiss banner when close button is clicked', async ({ page }) => {
    await page.goto('/living-chat');
    await dismissOnboarding(page);
    await page.getByText('ใช้งานได้ประมาณ 50%').waitFor({ state: 'visible', timeout: 5000 });
    const closeButton = page.getByRole('button', { name: /close|ปิด/ });
    await closeButton.click();
    await expect(page.getByText('ใช้งานได้ประมาณ 50%')).not.toBeVisible();
  });

  test('banner should persist across reload if not dismissed', async ({ page }) => {
    await page.goto('/living-chat');
    await dismissOnboarding(page);
    await page.getByText('ใช้งานได้ประมาณ 50%').waitFor({ state: 'visible', timeout: 5000 });
    await expect(page.getByText('ใช้งานได้ประมาณ 50%')).toBeVisible();
    await page.reload();
    await dismissOnboarding(page);
    await page.getByText('ใช้งานได้ประมาณ 50%').waitFor({ state: 'visible', timeout: 5000 });
    await expect(page.getByText('ใช้งานได้ประมาณ 50%')).toBeVisible();
  });

  test('banner should not reappear after reload once dismissed', async ({ page }) => {
    await page.goto('/living-chat');
    await dismissOnboarding(page);
    await page.getByText('ใช้งานได้ประมาณ 50%').waitFor({ state: 'visible', timeout: 5000 });
    const closeButton = page.getByRole('button', { name: /close|ปิด/ });
    await closeButton.click();
    await expect(page.getByText('ใช้งานได้ประมาณ 50%')).not.toBeVisible();
    await page.reload();
    await dismissOnboarding(page);
    await page.waitForTimeout(2000);
    await expect(page.getByText('ใช้งานได้ประมาณ 50%')).not.toBeVisible();
  });
});
