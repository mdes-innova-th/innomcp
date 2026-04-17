import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const FRONTEND_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.resolve(__dirname, '..', '..', 'docs', 'screenshots', 'preprod', 'public-perfect');

async function findInput(page: Page) {
  for (const sel of [
    'textarea[placeholder*="พิมพ์"]', 'textarea[placeholder*="ข้อความ"]',
    'textarea', 'input[type="text"]',
  ]) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 })) return el;
    } catch { /* next */ }
  }
  throw new Error('Cannot find input');
}

async function sendAndWait(page: Page, msg: string) {
  const input = await findInput(page);
  await input.fill(msg);
  await page.waitForTimeout(300);
  for (const sel of [
    'form:has(textarea) button[type="submit"]',
    'form button[type="submit"]',
    'button:has-text("ส่ง"):not([aria-label*="theme"])',
    'button[aria-label*="send" i]',
  ]) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 })) { await btn.click(); break; }
    } catch { /* next */ }
  }
  // Wait for AI response to appear
  await page.waitForTimeout(8000);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, name), fullPage: false });
  console.log('[screenshot]', name);
}

test.describe('Phase 8 — public-perfect screenshots', () => {
  test.setTimeout(180_000);

  test('capture 10 representative screenshots', async ({ page }) => {
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });

    // 01 — homepage initial state
    await shot(page, '01-homepage.png');

    // 02 — weather query (Bangkok)
    await sendAndWait(page, 'อากาศกรุงเทพวันนี้เป็นยังไง');
    await shot(page, '02-weather-bangkok.png');

    // 03 — weather 7-day forecast (Chiang Mai)
    await sendAndWait(page, 'พยากรณ์ 7 วันเชียงใหม่');
    await shot(page, '03-weather-7day-chiangmai.png');

    // 04 — honest unsupported (yesterday)
    await sendAndWait(page, 'เมื่อวานฝนตกที่ไหนบ้าง');
    await shot(page, '04-weather-yesterday-honest.png');

    // 05 — calculator
    await sendAndWait(page, '999 คูณ 888 เท่าไร');
    await shot(page, '05-calculator.png');

    // 06 — geo question
    await sendAndWait(page, 'จังหวัดนครราชสีมาอยู่ภาคไหน');
    await shot(page, '06-geo-knowledge.png');

    // 07 — detect/evidence (online scan count)
    await sendAndWait(page, 'ตอนนี้เครื่องสแกนออนไลน์กี่เครื่อง');
    await shot(page, '07-detect-evidence.png');

    // 08 — multi-province comparison
    await sendAndWait(page, 'เปรียบเทียบอากาศระหว่างภาคเหนือและภาคใต้วันนี้');
    await shot(page, '08-weather-multiregion.png');

    // 09 — English query
    await sendAndWait(page, 'weather in Phuket tomorrow');
    await shot(page, '09-weather-english.png');

    // 10 — final UI clean state
    await page.reload({ waitUntil: 'networkidle' });
    await shot(page, '10-ui-clean.png');

    // Verify all 10 screenshots exist
    const files = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
    console.log('Screenshots captured:', files.length);
    expect(files.length).toBeGreaterThanOrEqual(10);
  });
});
