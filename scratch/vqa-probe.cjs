const { chromium } = require('C:/Users/USER-NT/DEV/innomcp/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/living-chat', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  try { await page.getByText('ข้าม', { exact: true }).click({ timeout: 2000 }); } catch {}
  await page.waitForTimeout(1000);
  const zeros = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('main div').forEach(el => {
      const t = (el.textContent || '').trim();
      if (t.length > 0 && el.offsetWidth === 0 && el.offsetHeight === 0) {
        const cs = getComputedStyle(el);
        out.push({
          cls: (el.className || '').toString().slice(0, 80),
          text: t.slice(0, 60),
          display: cs.display, pos: cs.position, overflow: cs.overflow,
          parentCls: (el.parentElement?.className || '').toString().slice(0, 60),
        });
      }
    });
    return out;
  });
  console.log(JSON.stringify(zeros, null, 1));
  await page.screenshot({ path: 'screenshots/vqa-prism-round3.png' });
  await browser.close();
})();
