const { chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: "th-TH", viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);

  await page.locator('[data-testid="chat-input"]').fill("นาซ่ากำลังเร่งเดินหน้าภารกิจ Artemis เพื่อส่งมนุษย์กลับไปบนดวงจันทร์ บอกให้กระชับ");
  await page.waitForTimeout(500);

  // Full page screenshot showing composer
  await page.screenshot({ path: "workspace-storage/phase-10-66-composer.png" });
  console.log("SHOT composer");

  // Send and wait
  await page.locator('[data-testid="send-btn"]').click();
  await page.waitForTimeout(10000);

  await page.screenshot({ path: "workspace-storage/phase-10-66-response.png" });
  console.log("SHOT response");

  await browser.close();
})().catch((err) => { console.error("FAIL", err.message); process.exit(1); });
