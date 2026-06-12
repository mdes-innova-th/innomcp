import { chromium, ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function runAudit(): Promise<void> {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

  page.on('console', (msg: ConsoleMessage) => {
    const type = msg.type();
    if (type === 'error') {
      consoleErrors.push(msg.text());
    } else if (type === 'warning') {
      consoleWarnings.push(msg.text());
    }
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch {
    consoleErrors.push('Failed to navigate to http://localhost:3000');
  }

  await page.waitForTimeout(5000);

  const qaDir = path.resolve('innomcp-next/qa');
  const screenshotDir = path.resolve(qaDir, 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const fullScreenshotPath = path.join(screenshotDir, 'audit-full.png');
  await page.screenshot({ path: fullScreenshotPath, fullPage: true });

  const panelClips = [
    { filename: 'audit-left.png',   clip: { x: 0,   y: 0, width: 400, height: 800 } },
    { filename: 'audit-center.png', clip: { x: 400, y: 0, width: 400, height: 800 } },
    { filename: 'audit-right.png',  clip: { x: 800, y: 0, width: 400, height: 800 } },
  ];

  const screenshots: string[] = ['audit-full.png'];

  for (const { filename, clip } of panelClips) {
    await page.screenshot({ path: path.join(screenshotDir, filename), clip });
    screenshots.push(filename);
  }

  const requiredSelectors = [
    "[data-testid='mdes-brand-header']",
    ".chat-panel, [data-testid='chat-panel']",
    ".manus-workspace, [data-testid='workspace-panel']",
  ];

  const missingElements: string[] = [];

  for (const selector of requiredSelectors) {
    const count = await page.locator(selector).count();
    if (count === 0) {
      missingElements.push(selector);
    }
  }

  const report = {
    consoleErrors,
    missingElements,
    screenshots,
  };

  fs.writeFileSync(path.join(qaDir, 'audit-report.json'), JSON.stringify(report, null, 2));

  await browser.close();

  if (missingElements.length > 0 || consoleErrors.length > 0) {
    process.exitCode = 1;
  }
}

runAudit().catch((err) => {
  console.error('Audit script failed:', err);
  process.exit(1);
});
