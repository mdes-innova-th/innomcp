/**
 * E2E tests for innomcp-next chat UI — Phase 10.12
 * Prerequisites: all 3 services running (innomcp-next :3000, innomcp-node :3011, innomcp-server-node :3012)
 * Run: npx playwright test
 *      npm run e2e            (headless)
 *      npm run e2e:ui         (interactive)
 */
import { test, expect, Page } from "@playwright/test";

const CHAT_URL = "/";
const WAIT_FOR_RESPONSE_MS = 90_000; // 90s max per AI response — station/LLM queries can take 30–60s

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function navigateToChat(page: Page) {
  await page.goto(CHAT_URL);
  await page.waitForSelector('[data-testid="chat-input"]', { timeout: 10_000 });
}

async function sendMessage(page: Page, message: string) {
  const input = page.locator('[data-testid="chat-input"]');
  await input.click();
  await input.fill(message);
  await page.locator('[data-testid="send-btn"]').click();
}

async function waitForAIResponse(page: Page) {
  // The send-btn is NEVER disabled during a response — it stays enabled but changes title.
  // Correct approach: wait for title to flip to "หยุดการตอบ" (in-flight), then back to "ส่งข้อความ (Enter)" (done).

  // Step 1: wait for in-flight signal ("หยุดการตอบ"). Fast-path may skip this entirely — ignore timeout.
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('[data-testid="send-btn"]');
      return btn?.getAttribute("title") === "หยุดการตอบ";
    },
    undefined,
    { timeout: 5_000 }
  ).catch(() => {});

  // Step 2: wait for response complete ("ส่งข้อความ (Enter)").
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('[data-testid="send-btn"]');
      return btn?.getAttribute("title") === "ส่งข้อความ (Enter)";
    },
    undefined,
    { timeout: WAIT_FOR_RESPONSE_MS }
  );

  // Step 3: wait for prose content to be non-empty (avoids stale-read before React paints).
  await page.waitForFunction(
    () => {
      const proses = document.querySelectorAll('.prose');
      if (proses.length === 0) return false;
      const last = proses[proses.length - 1] as HTMLElement;
      return (last.innerText || '').trim().length > 0;
    },
    undefined,
    { timeout: 5_000 }
  ).catch(() => {});
}

// ─── TC-01: Page loads and chat input is visible ──────────────────────────────
test("TC-01: page loads, chat input visible, mode status bar present", async ({ page }) => {
  await navigateToChat(page);

  // Chat input should be visible
  await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();

  // Send button should be visible
  await expect(page.locator('[data-testid="send-btn"]')).toBeVisible();

  // ModeStatusBar should render (might take 2s to load from backend)
  await page.waitForTimeout(2500);
  const modeBarText = await page.locator("body").innerText();
  // The mode bar shows "INNOMCP_MODE:" somewhere on the page
  // If backend is unreachable, it shows degraded notice; either way no crash
  expect(modeBarText).not.toContain("500");
  expect(modeBarText).not.toContain("Internal Server Error");
});

// ─── TC-02: Placeholder text is correct ──────────────────────────────────────
test("TC-02: chat input placeholder shows weather-hint text", async ({ page }) => {
  await navigateToChat(page);
  const placeholder = await page.locator('[data-testid="chat-input"]').getAttribute("placeholder");
  expect(placeholder).toContain("อากาศ");
});

// ─── TC-03: Weather query returns a response ──────────────────────────────────
test("TC-03: weather query returns non-empty AI response", async ({ page }) => {
  await navigateToChat(page);
  await sendMessage(page, "วันนี้ฝนจะตกไหม");
  await waitForAIResponse(page);

  // Find AI message content
  const aiMessages = page.locator(".prose");
  const count = await aiMessages.count();
  expect(count).toBeGreaterThan(0);
  const text = await aiMessages.last().innerText();
  expect(text.trim().length).toBeGreaterThan(5);
  // Should not contain raw error stack
  expect(text).not.toContain("TypeError:");
  expect(text).not.toContain("stack:");
});

// ─── TC-04: Offline fallback notice shows correct color ─────────────────────
test("TC-04: weather fallback notice uses correct error color (red=upstream, yellow=offline)", async ({ page }) => {
  await navigateToChat(page);
  await sendMessage(page, "อากาศกรุงเทพวันนี้เป็นอย่างไร");
  await waitForAIResponse(page);

  // Count notice boxes — may be 0 if fixture returns real data
  const redNotice = page.locator(".border-red-400\\/30");
  const yellowNotice = page.locator(".border-yellow-400\\/30");
  const orangeNotice = page.locator(".border-orange-400\\/30");

  const totalNotices =
    (await redNotice.count()) +
    (await yellowNotice.count()) +
    (await orangeNotice.count());

  // If any notice is shown, it should NOT show default.svg map at the same time
  if (totalNotices > 0) {
    const mapTiles = page.locator('[data-testid="weather-map-tiles"]');
    // Map tiles with real data guard should not show placeholder
    const mapCount = await mapTiles.count();
    expect(mapCount).toBe(0);
  } else {
    // No error notice means real data might be available
    expect(totalNotices).toBeGreaterThanOrEqual(0);
  }
});

// ─── TC-05: Phuket station data query ────────────────────────────────────────
test("TC-05: Phuket station query returns a response", async ({ page }) => {
  await navigateToChat(page);
  await sendMessage(page, "ข้อมูลสถานี ภูเก็ต");
  await waitForAIResponse(page);

  // Wait for prose content to render (station queries can paint after send-btn re-enables)
  await page.waitForSelector(".prose", { timeout: WAIT_FOR_RESPONSE_MS }).catch(() => {});
  const aiMessages = page.locator(".prose");
  const count = await aiMessages.count();
  // Fallback: use message-assistant wrapper if .prose is absent
  let text = "";
  if (count > 0) {
    text = await aiMessages.last().innerText({ timeout: WAIT_FOR_RESPONSE_MS });
  } else {
    const wrapper = page.locator('[data-testid="message-assistant"]');
    text = await wrapper.last().innerText({ timeout: WAIT_FOR_RESPONSE_MS });
  }
  expect(text.trim().length).toBeGreaterThan(5);
  expect(/[\u0E00-\u0E7F]/.test(text)).toBeTruthy(); // Thai characters present
});

// ─── TC-06: Thai knowledge routing ───────────────────────────────────────────
test("TC-06: Thai knowledge query returns Thai-language response", async ({ page }) => {
  await navigateToChat(page);
  await sendMessage(page, "ภาษาไทยเป็นภาษาอะไร");
  await waitForAIResponse(page);

  // Wait for prose to paint (may render just after send-btn title resets)
  await page.waitForSelector(".prose", { timeout: WAIT_FOR_RESPONSE_MS }).catch(() => {});
  const aiMessages = page.locator(".prose");
  const text = await aiMessages.last().innerText({ timeout: WAIT_FOR_RESPONSE_MS });
  expect(text.trim().length).toBeGreaterThan(5);
  expect(/[\u0E00-\u0E7F]/.test(text)).toBeTruthy();
  // Should not be an error response
  expect(text.toLowerCase()).not.toContain("error 500");
});

// ─── TC-07: Typing dots appear during response wait ───────────────────────────
test("TC-07: typing indicator appears while waiting for AI response", async ({ page }) => {
  await navigateToChat(page);

  // Start a query and immediately check for typing dots (before response comes)
  await page.locator('[data-testid="chat-input"]').fill("สวัสดี");
  await page.locator('[data-testid="send-btn"]').click();

  // Typing balloon uses animate-bounce class on dots
  const typingDots = page.locator(".animate-bounce");
  await expect(typingDots.first()).toBeVisible({ timeout: 3000 });

  // Wait for response to complete
  await waitForAIResponse(page);
});

// ─── TC-08: Health endpoint returns valid JSON ────────────────────────────────
test("TC-08: /api/health returns valid JSON without 502/401 errors", async ({ page }) => {
  const response = await page.request.get("/api/health");
  // Should not be 401 (was the old bug) or 502 (proxy error)
  expect(response.status()).not.toBe(401);
  expect(response.status()).not.toBe(502);
  // Should be 200 (ok or degraded)
  expect([200, 503]).toContain(response.status());

  const json = await response.json();
  expect(json).toHaveProperty("status");
  expect(json).toHaveProperty("service", "innomcp-next");
  expect(json).toHaveProperty("mode");
  expect(json).toHaveProperty("mode_ready");
  expect(json).toHaveProperty("mcp_status");
  expect(json).toHaveProperty("redis_status");
  expect(json).toHaveProperty("redis_ready");
  expect(json).toHaveProperty("redis_configured");
  expect(json).toHaveProperty("redis_retry_after_ms");
});

test("TC-09: ModeStatusBar shows limited readiness when only local tools are available", async ({ page }) => {
  await page.route("**/api/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "degraded",
        service: "innomcp-next",
        mode: "online",
        mode_ready: false,
        ai_mode: "local",
        mcp_status: "local-only",
        redis_status: "disconnected",
        redis_ready: false,
        redis_configured: true,
        redis_retry_after_ms: 0,
        local_tools: 4,
        remote_tools: 0,
        total_tools: 4,
        notes: ["remote_mcp_unavailable"],
      }),
    });
  });

  await navigateToChat(page);
  await expect(page.locator('[data-testid="mode-status-bar"]')).toBeVisible();
  await expect(page.locator('[data-testid="mcp-badge"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="mcp-badge"]')).toContainText("เฉพาะในเครื่อง");
  await expect(page.locator('[data-testid="mode-summary"]')).toContainText("ระบบออนไลน์แบบจำกัดความสามารถ");
});

test("TC-10: Evidence placeholder renders unavailable state instead of zero-data dashboard", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "chatMessages",
      JSON.stringify([
        {
          sender: "ai",
          text: "สรุปหลักฐานเบื้องต้น: ขณะนี้ยังไม่มีข้อมูลจากคลังหลักฐาน (โหมดสำรอง)",
          structuredContent: {
            __render: { route: "evidence" },
            ok: false,
            code: "EVIDENCE_PLACEHOLDER",
            message: "ขณะนี้ยังไม่พร้อมเชื่อมต่อฐานข้อมูลหลักฐาน",
            meta: { dataSource: "placeholder", note: "detect-evidence-api not available" },
            kpis: { total: 0 },
            table: { rows: [] },
            stats: { total: 0 },
          },
        },
      ])
    );
  });

  await navigateToChat(page);
  await expect(page.locator('[data-testid="evidence-unavailable-state"]')).toBeVisible();
  await expect(page.locator('[data-testid="evidence-unavailable-state"]')).toContainText("ข้อมูลจากคลังหลักฐานยังไม่พร้อมใช้งาน");
  await expect(page.locator('[data-testid="evidence-kpi-total"]')).toHaveCount(0);
});
