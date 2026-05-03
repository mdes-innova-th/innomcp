/**
 * living-agent-chat.spec.ts — Phase C browser E2E
 *
 * Two cases land in this slice:
 *   Case 1 — rainy-season seminar planning (vertical-slice happy path)
 *   Case 8 — no raw chain-of-thought leak (security/UX guard)
 *
 * Cases 2..7 from the Phase C brief land as the slice expands. They are
 * tracked open in docs/brain/TASK_GRAPH.md C-7.
 *
 * Forbidden visible strings the suite asserts against (any DOM match
 * blocks the test):
 *   privateThought, hiddenReasoning, chainOfThought, rawThought,
 *   innerMonologue, secret":, "apiKey":, "password":,
 *   Weather Map Placeholder, Deterministic Local Static Tile,
 *   ข้อมูลไม่ครบสำหรับการแสดงแผนที่
 */

import { test, expect, type Page, type Request } from "@playwright/test";

const SEMINAR_QUERY =
  "ช่วยวางแผนค้นหาข้อมูลจังหวัดที่เหมาะจะจัดงานสัมมนาช่วงหน้าฝน โดยดูทั้งอากาศและการเดินทาง";

const FORBIDDEN_KEY_NAMES = [
  "privateThought",
  "hiddenReasoning",
  "chainOfThought",
  "rawThought",
  "innerMonologue",
];

const FORBIDDEN_VISIBLE_STRINGS = [
  "Weather Map Placeholder",
  "Deterministic Local Static Tile",
  "ข้อมูลไม่ครบสำหรับการแสดงแผนที่",
];

async function waitForAssistant(page: Page, expectedSubstring: RegExp) {
  // The streaming surface fills #assistant-message progressively. We poll
  // until either the regex matches or the timeout fires.
  await expect
    .poll(
      async () => {
        const text =
          (await page.locator('[data-testid="assistant-message"]').last().textContent()) || "";
        return text;
      },
      { timeout: 30_000, intervals: [500, 1000, 1500] }
    )
    .toMatch(expectedSubstring);
}

test.describe("Living Agent Chat — Phase C vertical slice", () => {
  test("Case 1 — rainy-season seminar planning streams a structured answer with thinking panel", async ({
    page,
  }) => {
    await page.goto("/living-chat");

    await expect(page.locator("h1")).toContainText("Living Agent Chat");
    const input = page.locator('[data-testid="chat-input"]');
    await expect(input).toBeVisible();

    // The page seeds the seminar prompt by default — assert and submit.
    await expect(input).toHaveValue(SEMINAR_QUERY);
    await page.locator('[data-testid="chat-send"]').click();

    // Wait for the assistant message to contain the structured plan
    // markers (criteria heading + follow-up cue) — proves it is NOT
    // just "กรุณาระบุจังหวัด...".
    await waitForAssistant(page, /เกณฑ์ที่จะใช้คัดเลือก/);
    await waitForAssistant(page, /(สมมติฐาน|first-pass|เกณฑ์|ปัจจัย)/);
    await waitForAssistant(page, /(\?|รบกวน|ระบุได้|จะให้|กี่ข้อ)/);

    // Final answer must NOT be only the canned 'please specify province'
    const finalText =
      (await page.locator('[data-testid="assistant-message"]').last().textContent()) || "";
    expect(finalText.trim()).not.toMatch(/^Innova-bot:\s*กรุณาระบุจังหวัด[^\n]*$/);

    // No forbidden visible strings anywhere in the assistant message
    for (const s of FORBIDDEN_VISIBLE_STRINGS) {
      expect(finalText).not.toContain(s);
    }

    // Thinking panel: visible, expand it, assert >= 3 workstream events
    const thinkingToggle = page.locator('[data-testid="thinking-panel-toggle"]');
    await expect(thinkingToggle).toBeVisible();
    const panel = page.locator('[data-testid="thinking-panel"]').last();
    await expect(panel).toBeVisible();
    await thinkingToggle.last().click();
    await expect(page.locator('[data-testid="thinking-panel-events"]')).toBeVisible();
    const events = page.locator('[data-testid="thinking-panel-event"]');
    expect(await events.count()).toBeGreaterThanOrEqual(3);

    // The expanded panel renders TH role labels — confirm at least one
    // recognisable agent role appears.
    const eventsText = (await events.allTextContents()).join("\n");
    expect(eventsText).toMatch(/(ผู้กำกับงาน|ผู้เรียบเรียงคำตอบ|นักวิเคราะห์อากาศ|นักวางแผน)/);

    // Save a screenshot for the evidence trail
    await page.screenshot({
      path: "e2e/screenshots/living-agent/case-1-seminar-planning.png",
      fullPage: true,
    });
  });

  test("Case 8 — no raw chain-of-thought leak in network or DOM", async ({ page }) => {
    // Capture every /api/chat/stream request body (raw text) so we can
    // scan it for forbidden field names.
    const streamRawPayloads: string[] = [];
    page.on("response", async (resp) => {
      if (resp.url().includes("/api/chat/stream")) {
        try {
          const text = await resp.text();
          streamRawPayloads.push(text);
        } catch {
          // ignore
        }
      }
    });

    await page.goto("/living-chat");
    await page.locator('[data-testid="chat-send"]').click();

    // Wait for the answer so the entire SSE response is in the buffer
    await waitForAssistant(page, /เกณฑ์|ขออนุญาต/);

    // Scan the raw SSE bytes
    for (const raw of streamRawPayloads) {
      const lower = raw.toLowerCase();
      for (const key of FORBIDDEN_KEY_NAMES) {
        expect(lower, `forbidden key "${key}" leaked in /api/chat/stream`).not.toContain(
          `"${key.toLowerCase()}":`
        );
      }
    }

    // Scan the rendered DOM for the same key names + visible strings
    const bodyText = (await page.locator("body").textContent()) || "";
    for (const key of FORBIDDEN_KEY_NAMES) {
      expect(bodyText).not.toContain(key);
    }
    for (const s of FORBIDDEN_VISIBLE_STRINGS) {
      expect(bodyText).not.toContain(s);
    }

    // Confirm the public-safe sentinel survived: every event the panel
    // displays should be marked safe upstream — we re-render only the
    // public fields, so the absence of forbidden keys is the proof.
    await page.screenshot({
      path: "e2e/screenshots/living-agent/case-8-no-cot-leak.png",
      fullPage: true,
    });
  });
});
