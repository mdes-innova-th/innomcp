const { chromium } = require('C:/Users/USER-NT/DEV/innomcp/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/living-chat', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  // skip onboarding modal
  try { await page.getByText('ข้าม', { exact: true }).click({ timeout: 3000 }); console.log('clicked ข้าม'); } catch { console.log('no ข้าม button'); }
  await page.waitForTimeout(1000);
  // close System Activity panel (X button)
  try { await page.locator('button:has-text("✕"), [aria-label*="close" i], [aria-label*="ปิด"]').first().click({ timeout: 3000 }); console.log('closed panel'); } catch { console.log('no close button found'); }
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/vqa-prism-living-chat-clean.png' });
  // measure layout: main columns
  const layout = await page.evaluate(() => {
    const cols = [...document.querySelectorAll('main > *, [class*="grid"] > [class*="col"], [class*="panel"]')].slice(0, 8)
      .map(el => ({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), w: el.offsetWidth, h: el.offsetHeight }));
    return { scrollW: document.body.scrollWidth, innerW: window.innerWidth, cols };
  });
  console.log('LAYOUT:', JSON.stringify(layout, null, 1).slice(0, 1200));
  await browser.close();
})();
