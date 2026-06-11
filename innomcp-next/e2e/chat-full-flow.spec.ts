// e2e/chat-flow.spec.ts
import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

// Thai UI strings used in selectors (approximation; adjust to match actual app)
const TH_UI = {
  welcome: 'ยินดีต้อนรับสู่ INNOMCP', // heading in ChatWelcomeHero
  inputPlaceholder: 'พิมพ์ข้อความของคุณ',
  settingsLabel: 'ตั้งค่า',
  workspaceLabel: 'พื้นที่ทำงาน',
  closeLabel: 'ปิด',
  quickActions: ['ยื่นภาษี', 'ข้อมูลบัตรประชาชน', 'ลงทะเบียนผู้สูงอายุ', 'ตรวจสอบสิทธิ์เราไม่ทิ้งกัน'], // sample
  responseIndicator: 'message', // role/class used for response bubble
};

// Helper: capture console errors during test
import type { Page } from '@playwright/test';
const captureConsoleErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
};

// Desktop viewport
test.describe('INNOMCP Chat Flow - Desktop', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('complete user journey', async ({ page }) => {
    const consoleErrors = await captureConsoleErrors(page);

    await test.step('1. Open /living-chat & verify page loads', async () => {
      await page.goto(`${BASE}/living-chat`);
      await expect(page).toHaveURL(/\/living-chat$/);
      // Wait for app to be interactive (no loading spinner)
      await expect(page.getByRole('banner')).toBeVisible({ timeout: 10000 });
    });

    await test.step('2. MDESBrandHeader visible with MDES branding', async () => {
      const header = page.getByRole('banner');
      await expect(header).toBeVisible();
      // Check Thai government branding (MDES/INNOMCP logo alt text or text content)
      await expect(header.getByAltText(/MDES|INNOMCP/)).toBeVisible();
      // Alternative: check for text 'กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม'
      // await expect(header.getByText(/กระทรวงดิจิทัล/)).toBeVisible();
    });

    await test.step('3. Empty state shows ChatWelcomeHero', async () => {
      // Use a heading or specific text in the welcome component
      const welcome = page.getByRole('heading', { name: TH_UI.welcome });
      await expect(welcome).toBeVisible();
      // Also ensure the chat input is visible
      const input = page.getByPlaceholder(TH_UI.inputPlaceholder);
      await expect(input).toBeVisible();
    });

    await test.step('4. Click a GovernmentQuickAction → verify input populated', async () => {
      const quickAction = page.getByRole('button', { name: TH_UI.quickActions[0] });
      await quickAction.click();
      const input = page.getByPlaceholder(TH_UI.inputPlaceholder);
      // Assert that the input now contains some text (exact text depends on implementation)
      await expect(input).not.toHaveValue('');
      // Optionally check that it contains a keyword from the quick action
      await expect(input).toHaveValue(/ภาษี|บัตรประชาชน|ผู้สูงอายุ|สิทธิ์/);
    });

    await test.step('5. Clear input, type custom message', async () => {
      const input = page.getByPlaceholder(TH_UI.inputPlaceholder);
      await input.clear();
      await input.fill('สวัสดี ฉันอยากรู้เกี่ยวกับโครงการเราไม่ทิ้งกัน');
      await expect(input).toHaveValue('สวัสดี ฉันอยากรู้เกี่ยวกับโครงการเราไม่ทิ้งกัน');
    });

    await test.step('6. Click settings ⚙️ → verify ModelSettingsPanel opens', async () => {
      const settingsButton = page.getByRole('button', { name: TH_UI.settingsLabel });
      await settingsButton.click();
      // Expect a panel with heading 'การตั้งค่าโมเดล' or similar
      const settingsPanel = page.getByRole('dialog', { name: /การตั้งค่า/ }).or(
        page.locator('[role="dialog"]').filter({ hasText: /การตั้งค่า/ })
      );
      await expect(settingsPanel).toBeVisible({ timeout: 3000 });
      // Verify typical content (e.g., temperature slider or model selector)
      await expect(settingsPanel.getByText(/อุณหภูมิ|temperature/i)).toBeVisible();
    });

    await test.step('7. Close settings', async () => {
      // Use a close button or click outside
      const closeSettings = page.getByRole('button', { name: TH_UI.closeLabel }).or(
        page.getByRole('button', { name: TH_UI.settingsLabel })
      );
      await closeSettings.click();
      // Wait for disappearance
      await expect(page.getByRole('dialog', { name: /การตั้งค่า/ })).not.toBeVisible({ timeout: 3000 });
    });

    await test.step('8. Click workspace panel 🗂️ → verify ManusWorkspacePanel opens', async () => {
      const workspaceButton = page.getByRole('button', { name: TH_UI.workspaceLabel });
      await workspaceButton.click();
      const workspacePanel = page.locator('[role="dialog"], .manus-workspace')
        .filter({ hasText: /เอกสาร|ไฟล์|document/i });
      await expect(workspacePanel).toBeVisible({ timeout: 3000 });
    });

    await test.step('9. Close workspace', async () => {
      const closeWorkspace = page.getByRole('button', { name: TH_UI.closeLabel });
      await closeWorkspace.click();
      await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 3000 });
    });

    await test.step('10. Click provider toggle Cloud/Local → verify toggle changes', async () => {
      // The toggle might be a switch with aria-label or associated text
      const toggle = page.getByRole('switch', { name: /การเชื่อมต่อ|cloud|local/i });
      if (await toggle.isVisible()) {
        const initialChecked = await toggle.isChecked();
        await toggle.click();
        await expect(toggle).toBeChecked({ checked: !initialChecked });
      } else {
        // Fallback: Look for a button that toggles between cloud/local text
        const providerButton = page.getByRole('button', { name: /cloud|local/i });
        await expect(providerButton).toBeVisible();
        const originalText = await providerButton.textContent();
        await providerButton.click();
        const newText = await providerButton.textContent();
        expect(newText).not.toEqual(originalText);
      }
    });

    await test.step('11. Type in chat input → verify Enter sends (smoke: checks for response area)', async () => {
      const input = page.getByPlaceholder(TH_UI.inputPlaceholder);
      await input.clear();
      await input.fill('ช่วยอธิบายขั้นตอนการลงทะเบียนด้วย');
      // Submit by pressing Enter
      await input.press('Enter');

      // Wait for a response message to appear (could be a loading indicator then content)
      const responseArea = page.locator(`[role="${TH_UI.responseIndicator}"]`).or(
        page.locator('.chat-message--assistant')
      );
      // Expect at least one message from assistant after a timeout
      await expect(responseArea.first()).toBeVisible({ timeout: 15000 });
      // Optionally check that the message contains something
      // await expect(responseArea.first()).toContainText(/ขั้นตอน|ลงทะเบียน/);
    });

    await test.step('12. Verify no console errors on page', async () => {
      expect(consoleErrors.length).toBe(0);
    });
  });
});

// Mobile viewport
test.describe('INNOMCP Chat Flow - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('complete user journey on mobile', async ({ page }) => {
    const consoleErrors = await captureConsoleErrors(page);

    await test.step('1. Open /living-chat & verify page loads', async () => {
      await page.goto(`${BASE}/living-chat`);
      await expect(page).toHaveURL(/\/living-chat$/);
      await expect(page.getByRole('banner')).toBeVisible({ timeout: 10000 });
    });

    await test.step('2. MDESBrandHeader visible', async () => {
      await expect(page.getByRole('banner').getByAltText(/MDES|INNOMCP/)).toBeVisible();
    });

    await test.step('3. Empty state shows ChatWelcomeHero', async () => {
      await expect(page.getByRole('heading', { name: TH_UI.welcome })).toBeVisible();
      await expect(page.getByPlaceholder(TH_UI.inputPlaceholder)).toBeVisible();
    });

    await test.step('4. Click a GovernmentQuickAction', async () => {
      // On mobile, quick actions may be in a scrollable area; ensure it's in view
      const quickAction = page.getByRole('button', { name: TH_UI.quickActions[2] }); // เลือกลำดับอื่น
      await quickAction.scrollIntoViewIfNeeded();
      await quickAction.click();
      await expect(page.getByPlaceholder(TH_UI.inputPlaceholder)).not.toHaveValue('');
    });

    // Steps 5-11 are similar to desktop; only selectors might need adaptation for mobile layout
    await test.step('5. Clear, type custom', async () => {
      const input = page.getByPlaceholder(TH_UI.inputPlaceholder);
      await input.clear();
      await input.fill('ทดสอบจากมือถือ');
      await expect(input).toHaveValue('ทดสอบจากมือถือ');
    });

    await test.step('6-7. Settings open/close', async () => {
      const settingsButton = page.getByRole('button', { name: TH_UI.settingsLabel });
      await settingsButton.click();
      await expect(page.getByRole('dialog', { name: /การตั้งค่า/ })).toBeVisible({ timeout: 3000 });
      await page.getByRole('button', { name: TH_UI.closeLabel }).click();
      await expect(page.getByRole('dialog', { name: /การตั้งค่า/ })).not.toBeVisible({ timeout: 3000 });
    });

    await test.step('8-9. Workspace open/close', async () => {
      const workspaceButton = page.getByRole('button', { name: TH_UI.workspaceLabel });
      await workspaceButton.click();
      await expect(page.locator('[role="dialog"]').filter({ hasText: /เอกสาร|ไฟล์/i })).toBeVisible();
      await page.getByRole('button', { name: TH_UI.closeLabel }).click();
      await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 3000 });
    });

    await test.step('10. Toggle provider', async () => {
      const toggle = page.getByRole('switch', { name: /เชื่อมต่อ|cloud|local/i });
      if (await toggle.isVisible()) {
        const initial = await toggle.isChecked();
        await toggle.click();
        await expect(toggle).toBeChecked({ checked: !initial });
      } else {
        const button = page.getByRole('button', { name: /cloud|local/i });
        const textBefore = await button.textContent();
        await button.click();
        await expect(await button.textContent()).not.toEqual(textBefore);
      }
    });

    await test.step('11. Send message and see response', async () => {
      const input = page.getByPlaceholder(TH_UI.inputPlaceholder);
      await input.clear();
      await input.fill('อธิบายขั้นตอนเราด่วน');
      await input.press('Enter');
      await expect(page.locator(`[role="${TH_UI.responseIndicator}"]`).first()).toBeVisible({ timeout: 15000 });
    });

    await test.step('12. No console errors', async () => {
      expect(consoleErrors.length).toBe(0);
    });
  });
});