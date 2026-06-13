<!-- cc-team deliverable
 group: VQA-BROWSER (Phase 3-4 browser verification)
 member: VQA-B5 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":146,"completion_tokens":3000,"total_tokens":3146,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":994,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T05:25:11.167Z -->
import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

interface VerificationResult {
  status: 'PASS' | 'FAIL';
  timestamp: string;
  checks: {
    navigation: { pass: boolean; detail: string };
    brandElement: { pass: boolean; detail: string };
    columnElements: { pass: boolean; detail: string };
    noFullpageError: { pass: boolean; detail: string };
    screenshot: { pass: boolean; detail: string };
  };
  summary: string;
}

async function verifyPhase4(): Promise<VerificationResult> {
  const result: VerificationResult = {
    status: 'PASS',
    timestamp: new Date().toISOString(),
    checks: {
      navigation: { pass: false, detail: '' },
      brandElement: { pass: false, detail: '' },
      columnElements: { pass: false, detail: '' },
      noFullpageError: { pass: false, detail: '' },
      screenshot: { pass: false, detail: '' },
    },
    summary: '',
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    // (1) Navigate to http://localhost:3001
    try {
      await page.goto('http://localhost:3001', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      await page.waitForTimeout(2000);
      result.checks.navigation = {
        pass: true,
        detail: 'Successfully navigated to http://localhost:3001',
      };
    } catch (err: any) {
      result.checks.navigation = {
        pass: false,
        detail: `Navigation failed: ${err.message}`,
      };
      result.status = 'FAIL';
      result.summary = 'Navigation to localhost:3001 failed';
      return result;
    }

    // (2) Check for element containing text 'MDES INNOMCP' OR has class/id containing 'mdes' or 'brand'
    const brandCheck = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const text = el.textContent?.trim() || '';
        if (text.includes('MDES INNOMCP')) {
          return {
            found: true,
            detail: `Found element containing text "MDES INNOMCP": <${el.tagName.toLowerCase()}> with text "${text.slice(0, 80)}"`,
          };
        }
        const className = (el as HTMLElement).className || '';
        const id = el.id || '';
        const classAndId = `${className} ${id}`.toLowerCase();
        if (classAndId.includes('mdes') || classAndId.includes('brand')) {
          return {
            found: true,
            detail: `Found element with class/id containing 'mdes' or 'brand': <${el.tagName.toLowerCase()}> class="${className}" id="${id}"`,
          };
        }
      }
      return { found: false, detail: 'No element found containing "MDES INNOMCP" text or class/id with "mdes"/"brand"' };
    });

    result.checks.brandElement = {
      pass: brandCheck.found,
      detail: brandCheck.detail,
    };

    // (3) Check page has 3+ visible column elements
    const columnCheck = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const columnElements: string[] = [];

      for (const el of allElements) {
        const htmlEl = el as HTMLElement;
        const className = (htmlEl.className || '').toLowerCase();
        const id = (htmlEl.id || '').toLowerCase();
        const style = window.getComputedStyle(htmlEl);
        const display = style.display;
        const visibility = style.visibility;
        const opacity = parseFloat(style.opacity);
        const rect = htmlEl.getBoundingClientRect();
        const isVisible =
          visibility !== 'hidden' &&
          opacity > 0 &&
          rect.width > 0 &&
          rect.height > 0 &&
          display !== 'none';

        if (!isVisible) continue;

        const hasColumnClass =
          className.includes('col-') ||
          className.includes('col ') ||
          className.includes(' column') ||
          className.includes('column-') ||
          className.includes('grid-col') ||
          /^col\b/.test(className) ||
          /\bcol\b/.test(className) ||
          className.includes('_col') ||
          id.includes('col') ||
          id.includes('column');

        const isFlexOrGridChild =
          (display.includes('flex') || display.includes('grid')) &&
          htmlEl.parentElement &&
          (window.getComputedStyle(htmlEl.parentElement).display.includes('flex') ||
            window.getComputedStyle(htmlEl.parentElement).display.includes('grid'));

        if (hasColumnClass || isFlexOrGridChild) {
          const tag = htmlEl.tagName.toLowerCase();
          const cls = className.slice(0, 60);
          columnElements.push(`<${tag}> class="${cls}" (${Math.round(rect.width)}x${Math.round(rect.height)}px)`);
        }
      }

      const uniqueColumns = [...new Set(columnElements)];
      if (uniqueColumns.length >= 3) {
        return {
          pass: true,
          detail: `Found ${uniqueColumns.length} visible column elements: ${uniqueColumns.slice(0, 5).join('; ')}${uniqueColumns.length > 5 ? '...' : ''}`,
          count: uniqueColumns.length,
        };
      }
      return {
        pass: false,
        detail: `Only found ${uniqueColumns.length} visible column element(s). Need 3+. Found: ${uniqueColumns.join('; ') || 'none'}`,
        count: uniqueColumns.length,
      };
    });

    result.checks.columnElements = {
      pass: columnCheck.pass,
      detail: columnCheck.detail,
    };

    // (4) Check no fullpage error
    const errorCheck = await page.evaluate(() => {
      const errorIndicators: string[] = [];
      const errorTextPatterns = [
        'application error',
        'an error occurred',
        'something went wrong',
        'internal server error',
        'error 500',
        'unhandled error',
        'runtime error',
        'fatal error',
        'unexpected error',
        'sorry, an error',
        'page could not be loaded',
        'failed to load',
        'error loading',
        'not found - 404',
        'this page could not be found',
      ];

      const errorClassPatterns = [
        'error-boundary',
        'error-fallback',
        'error-page',
        'fullpage-error',
        'error-overlay',
        'error-container',
        'next-error',
        'error-component',
        'global-error',
        'crash-boundary',
      ];

      const allElements = document.querySelectorAll('*');
      let hasErrorOverlay = false;
      let errorDetail = '';

      for (const el of allElements) {
        const htmlEl = el as HTMLElement;
        const text = (htmlEl.textContent || '').toLowerCase();
        const className = (htmlEl.className || '').toLowerCase();
        const id = (htmlEl.id || '').toLowerCase();
        const style = window.getComputedStyle(htmlEl);
        const isVisible =
          style.visibility !== 'hidden' &&
          parseFloat(style.opacity) > 0 &&
          htmlEl.getBoundingClientRect().width > 0 &&
          htmlEl.getBoundingClientRect().height > 0 &&
          style.display !== 'none';

        if (!isVisible) continue;

        for (const pattern of errorTextPatterns) {
          if (text.includes(pattern)) {
            errorIndicators.push(`Text match "${pattern}" in <${htmlEl.tagName.toLowerCase()}>: "${text.slice(0, 80)}"`);
            hasErrorOverlay = true;
            break;
          }
        }

        for (const pattern of errorClassPatterns) {
          if (className.includes(pattern) || id.includes(pattern)) {
            errorIndicators.push(`Class/id match "${pattern}" in <${htmlEl.tagName.toLowerCase()}> class="${className.slice(0, 60)}" id="${id}"`);
            hasErrorOverlay = true;
            break;
          }
        }

        if (
          htmlEl.tagName === 'NEXTJS-PORTAL' ||
          (className.includes('next') && className.includes('error'))
        ) {
          errorIndicators.push(`Next.js error portal/overlay detected`);
          hasErrorOverlay = true;
        }

        if (hasErrorOverlay && !errorDetail) {
          errorDetail = errorIndicators[errorIndicators.length - 1];
        }
      }

      const bodyText = document.body?.textContent?.toLowerCase() || '';
      const titleText = document.title?.toLowerCase() || '';
      if (titleText.includes
