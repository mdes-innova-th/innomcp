const { chromium } = require('C:/Users/USER-NT/DEV/innomcp/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0, 200)));
  for (const [name, url] of [['home', 'http://localhost:3000/'], ['living-chat', 'http://localhost:3000/living-chat']]) {
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `screenshots/vqa-prism-${name}.png`, fullPage: false });
      const title = await page.title();
      const bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 400).replace(/\n+/g, ' | ');
      console.log(`=== ${name} === status=${resp.status()} title="${title}"`);
      console.log(`TEXT: ${bodyText}`);
    } catch (e) { console.log(`=== ${name} === FAILED: ${e.message.slice(0, 150)}`); }
  }
  console.log('=== CONSOLE ERRORS ===');
  errors.slice(0, 10).forEach(e => console.log(' -', e));
  if (!errors.length) console.log(' (none)');
  await browser.close();
})();
