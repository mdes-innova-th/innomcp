<!-- cc-team deliverable
 group: P4D (Phase 4.4 â€” Layout QA vs manus.im (3-column, header, responsive))
 member: P4D-1 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":216,"completion_tokens":3022,"total_tokens":3238,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":258,"image_tokens":0},"cache_creation_input_tokens":0} | 57s
 generated: 2026-06-12T03:45:25.563Z -->
import { chromium, Page, Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface ColumnInfo {
  index: number;
  width: number;
  height: number;
  left: number;
  top: number;
  className: string;
  role: 'left-sidebar' | 'center-chat' | 'right-workspace' | 'unknown';
}

interface HeaderInfo {
  found: boolean;
  selector: string | null;
  top: number | null;
  width: number | null;
  height: number | null;
  text: string | null;
}

interface LayoutQAReport {
  url: string;
  timestamp: string;
  header: HeaderInfo;
  columns: ColumnInfo[];
  columnCount: number;
  screenshots: {
    desktop_1440: string | null;
    tablet_768: string | null;
    mobile_375: string | null;
  };
  passed: boolean;
  failures: string[];
}

const TARGET_URL = process.env.PLAYWRIGHT_URL || 'http://localhost:3000';
const REPORT_PATH = process.env.REPORT_PATH || path.resolve(process.cwd(), 'layout-qa-report.json');
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || path.resolve(process.cwd(), 'layout-qa-screenshots');

async function detectHeader(page: Page): Promise<HeaderInfo> {
  const info: HeaderInfo = {
    found: false,
    selector: null,
    top: null,
    width: null,
    height: null,
    text: null,
  };

  // Try data-testid first
  const byTestId = await page.$("[data-testid='mdes-brand-header']");
  if (byTestId) {
    const box = await byTestId.boundingBox();
    const text = await byTestId.innerText().catch(() => null);
    if (box) {
      info.found = true;
      info.selector = "[data-testid='mdes-brand-header']";
      info.top = box.y;
      info.width = box.width;
      info.height = box.height;
      info.text = text;
      return info;
    }
  }

  // Fallback: element containing text 'MDES INNOMCP'
  const byText = await page.locator("text=/MDES\\s*INNOMCP/i").first();
  try {
    const box = await byText.boundingBox({ timeout: 2000 });
    if (box) {
      const text = await byText.innerText().catch(() => null);
      info.found = true;
      info.selector = "text=/MDES\\s*INNOMCP/i";
      info.top = box.y;
      info.width = box.width;
      info.height = box.height;
      info.text = text;
      return info;
    }
  } catch {
    // not found
  }

  return info;
}

async function detectColumns(page: Page): Promise<ColumnInfo[]> {
  // Scan all div-like containers and classify by computed width.
  const raw = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>('div, section, aside, main, nav')
    );
    return candidates
      .map((el, idx) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          index: idx,
          tag: el.tagName.toLowerCase(),
          width: rect.width,
          height: rect.height,
          left: rect.left,
          top: rect.top,
          className: (el.className && typeof el.className === 'string') ? el.className : '',
          display: style.display,
          visible: style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0,
        };
      })
      .filter((c) => c.visible && c.height > 200);
  });

  // Classify by width buckets
  const leftCandidates: typeof raw = [];
  const centerCandidates: typeof raw = [];
  const rightCandidates: typeof raw = [];

  for (const c of raw) {
    if (c.width >= 200 && c.width <= 450) {
      // Could be left or right sidebar; disambiguate by horizontal position
      if (c.left < 300) leftCandidates.push(c);
      else if (c.left > 900) rightCandidates.push(c);
      else {
        // ambiguous — push to both pools, resolve later
        leftCandidates.push(c);
        rightCandidates.push(c);
      }
    } else if (c.width > 500) {
      centerCandidates.push(c);
    } else if (c.width > 200) {
      rightCandidates.push(c);
    }
  }

  const pickBest = (arr: typeof raw, role: ColumnInfo['role']): ColumnInfo | null => {
    if (arr.length === 0) return null;
    // Prefer tallest element (most likely the main column container)
    const sorted = [...arr].sort((a, b) => b.height - a.height);
    const best = sorted[0];
    return {
      index: best.index,
      width: Math.round(best.width),
      height: Math.round(best.height),
      left: Math.round(best.left),
      top: Math.round(best.top),
      className: best.className.slice(0, 200),
      role,
    };
  };

  const columns: ColumnInfo[] = [];
  const left = pickBest(leftCandidates, 'left-sidebar');
  const center = pickBest(centerCandidates, 'center-chat');
  const right = pickBest(rightCandidates, 'right-workspace');

  if (left) columns.push(left);
  if (center) columns.push(center);
  if (right) columns.push(right);

  // Sort by horizontal position for stable output
  columns.sort((a, b) => a.left - b.left);
  return columns;
}

async function takeScreenshot(page: Page, width: number, label: string): Promise<string | null> {
  try {
    await page.setViewportSize({ width, height: 900 });
    // Allow layout to settle
    await page.waitForTimeout(800);
    const filePath = path.join(SCREENSHOT_DIR, `${label}.png`);
    await page.screenshot({ path: filePath, fullPage: false });
    return filePath;
  } catch (err) {
    console.error(`Screenshot failed for ${label}:`, (err as Error).message);
    return null;
  }
}

async function main(): Promise<void> {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const report: LayoutQAReport = {
    url: TARGET_URL,
    timestamp: new Date().toISOString(),
    header: { found: false, selector: null, top: null, width: null, height: null, text: null },
    columns: [],
    columnCount: 0,
    screenshots: { desktop_1440: null, tablet_768: null, mobile_375: null },
    passed: false,
    failures: [],
  };

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page: Page = await context.newPage();

    console.log(`[layout-qa] Navigating to ${TARGET_URL} at 1440px...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1000);

    // (1) Confirm viewport width
    const vp = page.viewportSize();
    if (!vp || vp.width !== 1440) {
      report.failures.push(`Expected viewport width 1440, got ${vp?.width}`);
    }

    // (2) Header check
    report.header = await detectHeader(page);
    if (!report.header.found) {
      report.failures.push("Header element [data-testid='mdes-brand-header'] or text 'MDES INNOMCP' not found.");
    } else if (report.header.top !== null && report.header.top >= 100) {
      report.failures.push(`Header top position ${report.header.top} is not at top (expected < 100).`);
    }

    // (3) Column detection
    report.columns = await detectColumns(page);
    report.columnCount = report.columns.length;
    if (report.columnCount < 3) {
      report.failures.push(`Expected 3 main columns, detected ${report.columnCount}.`);
    }

    // Validate column width constraints
    for (const col of report.columns) {
      if (col.role === 'left-sidebar' && (col.width < 200 || col.width > 450)) {
        report.failures.push(`Left sidebar width ${col.width}px outside 200-450px range.`);
      }
      if (col.role === 'center-chat' && col.width <= 500) {
        report.failures.push(`Center chat width ${col.width}px not > 500px.`);
      }
      if (col.role === 'right-workspace' && col.width <= 200) {
        report.failures.push(`Right workspace width ${col.width}px not > 200px.`);
      }
    }

    // (4) Screenshots at 3 widths (start from 1440, then shrink)
    report.screenshots.desktop_1440 = await takeScreenshot(page, 1440, 'desktop-1440');
    report.screenshots.tablet_768 = await takeScreenshot(page, 768, 'tablet-768');
    report.screenshots.mobile_375 = await takeScreenshot(page, 375, 'mobile-375');

    // (5) Determine pass/fail
    report.passed = report.failures.length === 0;

    // (5) Write report
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`[layout-qa] Report written to ${REPORT_PATH}`);
    console.log(`[layout-qa] Header: found=${report.header.found}, top=${report.header.top}`);
    console.log(`[layout-qa] Columns detected: ${report.columnCount}`);
    for (const c of report.columns) {
      console.log(`  - ${c.role}: width=${c.width}px left=${c.left}px`);
    }
    if (report.failures.length > 0) {
      console.error('[layout-qa] Failures:');
      for (const f of report.failures) console.error(`  * ${f}`);
    }

    await context.close();
  } catch (err) {
    console.error('[layout-qa] Fatal error:', err);
    report.failures.push(`Fatal: ${(err as Error).message}`);
    report.passed = false;
    try {
      fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }

  // (6) Exit 1 if header missing or fewer than 3 columns
  const headerMissing = !report.header.found;
  const insufficientColumns = report.columnCount < 3;
  if (headerMissing || insufficientColumns || !report.passed) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
