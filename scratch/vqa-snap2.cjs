const { chromium } = require('C:/Users/USER-NT/DEV/innomcp/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const failed = {};
  page.on('response', r => { if (r.status() >= 400) { const k = `${r.status()} ${r.url()}`; failed[k] = (failed[k] || 0) + 1; } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message.slice(0, 250)));
  for (const [name, url] of [['home', 'http://localhost:3000/'], ['living-chat', 'http://localhost:3000/living-chat'], ['dashboard', 'http://localhost:3000/dashboard']]) {
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(5000);
      await page.screenshot({ path: `screenshots/vqa-prism-${name}.png` });
      const title = await page.title();
      const bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 400).replace(/\s*\n+\s*/g, ' | ');
      console.log(`=== ${name} === status=${resp.status()} title="${title}"`);
      console.log(`TEXT: ${bodyText}`);
    } catch (e) { console.log(`=== ${name} === FAILED: ${e.message.slice(0, 120)}`); }
  }
  console.log('=== FAILED REQUESTS (url x count) ===');
  Object.entries(failed).slice(0, 15).forEach(([k, c]) => console.log(` - [x${c}] ${k.slice(0, 160)}`));
  console.log('=== PAGE ERRORS ===');
  pageErrors.slice(0, 8).forEach(e => console.log(' -', e));
  if (!pageErrors.length) console.log(' (none)');
  await browser.close();
})();
