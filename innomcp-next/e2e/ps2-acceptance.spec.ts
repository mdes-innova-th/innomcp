/**
 * PS2 ACCEPTANCE — Remote AI Reliability + FastPath Identity + Clean Release
 * Covers: identity phrasing, capability phrasing, remote AI stability, weather, evidence, UI
 * Run: cd innomcp-next && npx playwright test e2e/ps2-acceptance.spec.ts --reporter=list
 */
import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND = process.env.BACKEND_URL || "http://localhost:3011";
const SS_DIR = path.join(__dirname, "..", "docs", "acceptance");
if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

const JWT_SECRET = process.env.JWT_SECRET || "gMail.com";
const API_KEY = "innomcp_d5acd09cc0103b16293181020cba0bace9b426f41ffb685c";
const CSRF_SECRET = "testcsrf123";
const CSRF_HASH = crypto.createHash("sha256").update(CSRF_SECRET).digest("hex");
const JWT_TOKEN = jwt.sign(
  { userId: 999, userEmail: "test@innomcp.local", userRoleId: 0, userDispName: "PS2 E2E" },
  JWT_SECRET,
  { expiresIn: "1h", issuer: "innomcp", audience: "innomcp-client" }
);
const API_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "x-api-key": API_KEY,
  "x-csrf-token": CSRF_HASH,
  "Cookie": `csrf_token=${CSRF_SECRET}`,
  "Authorization": `Bearer ${JWT_TOKEN}`,
};

// ─── Helpers ────────────────────────────────────────────────────────
async function ss(page: Page, name: string) {
  await page.screenshot({ path: path.join(SS_DIR, `${name}.png`), fullPage: true });
}

async function navigateToChat(page: Page) {
  try { await page.goto("/", { timeout: 45_000 }); } catch { await page.waitForTimeout(3_000); await page.goto("/", { timeout: 45_000 }); }
  const ready = await page.locator('[data-testid="chat-input"]').isVisible({ timeout: 5_000 }).catch(() => false);
  if (!ready) await page.reload({ timeout: 45_000 });
  await page.waitForSelector('[data-testid="chat-input"]', { timeout: 20_000 });
}

async function sendAndWait(page: Page, message: string, timeoutMs = 90_000): Promise<string> {
  const input = page.locator('[data-testid="chat-input"]');
  await input.click();
  await input.fill(message);
  await page.locator('[data-testid="send-btn"]').click();
  await page.waitForFunction(() => {
    const btn = document.querySelector('[data-testid="send-btn"]');
    return btn?.getAttribute("title") === "ส่งข้อความ (Enter)";
  }, undefined, { timeout: timeoutMs });
  try {
    await page.waitForFunction(() => {
      const proses = document.querySelectorAll('.prose');
      if (proses.length === 0) return false;
      const last = proses[proses.length - 1] as HTMLElement;
      return (last.innerText || '').trim().length > 0;
    }, undefined, { timeout: 8_000 });
  } catch { /* some responses render outside .prose */ }
  await page.waitForTimeout(2000);
  const proses = page.locator('.prose');
  const count = await proses.count();
  if (count > 0) return await proses.last().innerText({ timeout: 5_000 });
  const wrapper = page.locator('[data-testid="message-assistant"]');
  const wCount = await wrapper.count();
  if (wCount > 0) return await wrapper.last().innerText({ timeout: 5_000 });
  return "";
}

async function apiChat(message: string) {
  const resp = await fetch(`${BACKEND}/api/chat`, {
    method: "POST",
    headers: API_HEADERS,
    body: JSON.stringify({ message, sessionId: `ps2-${Date.now()}` }),
  });
  const json = await resp.json();
  const sc = json?.structuredContent || {};
  return {
    text: json?.text || "",
    fastPath: sc?.fastPath || false,
    fastPathHit: sc?.fastPathHit || "",
    route: sc?.__render?.route || sc?.__groundedContract?.selectedRoute || "unknown",
    model: sc?.__render?.modelUsed || sc?.aiSelectorTruth?.actualModel || "",
    llmUsed: sc?.__render?.llmUsed || false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// A) FASTPATH IDENTITY CLOSURE
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("A) FastPath Identity Closure", () => {
  test("PS2-A1: 'คุณชื่ออะไร' returns identity (browser)", async ({ page }) => {
    await navigateToChat(page);
    const answer = await sendAndWait(page, "คุณชื่ออะไร");
    await ss(page, "ps2-01-identity-query");
    expect(answer).toContain("Innova-bot");
  });

  test("PS2-A2: 'เป็นใคร' returns identity (API)", async () => {
    const r = await apiChat("เป็นใคร");
    expect(r.fastPathHit).toBe("identity");
    expect(r.text).toContain("Innova-bot");
  });

  test("PS2-A3: 'คุณคือใคร' returns identity (API)", async () => {
    const r = await apiChat("คุณคือใคร");
    expect(r.fastPathHit).toBe("identity");
    expect(r.text).toContain("Innova-bot");
  });

  test("PS2-A4: 'what is your name' returns identity (API)", async () => {
    const r = await apiChat("what is your name");
    expect(r.fastPathHit).toBe("identity");
    expect(r.text).toContain("Innova-bot");
  });

  test("PS2-A5: 'who are you' returns identity (API)", async () => {
    const r = await apiChat("who are you");
    expect(r.fastPathHit).toBe("identity");
    expect(r.text).toContain("Innova-bot");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// B) FASTPATH CAPABILITY CLOSURE
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("B) FastPath Capability Closure", () => {
  test("PS2-B1: 'ช่วยอะไรได้บ้าง' returns capability (browser)", async ({ page }) => {
    await navigateToChat(page);
    const answer = await sendAndWait(page, "ช่วยอะไรได้บ้าง");
    await ss(page, "ps2-02-capability-query");
    expect(answer).toContain("weather");
  });

  test("PS2-B2: 'ทำอะไรได้บ้าง' returns capability (API)", async () => {
    const r = await apiChat("ทำอะไรได้บ้าง");
    expect(r.fastPathHit).toBe("capability");
    expect(r.text).toContain("weather");
  });

  test("PS2-B3: 'what can you do' returns capability (API)", async () => {
    const r = await apiChat("what can you do");
    expect(r.fastPathHit).toBe("capability");
    expect(r.text).toContain("weather");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// C) REMOTE AI RELIABILITY
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("C) Remote AI Reliability", () => {
  test("PS2-C1: Remote AI — useful answer for tech query (browser)", async ({ page }) => {
    await navigateToChat(page);
    const answer = await sendAndWait(page, "API คืออะไร");
    await ss(page, "ps2-03-remote-ai-answer");
    expect(answer.length).toBeGreaterThan(20);
    expect(answer.toLowerCase()).toMatch(/api|application|programming|interface|โปรแกรม|เชื่อมต่อ/);
  });

  test("PS2-C2: Remote AI — repeated stability (3 runs API)", async () => {
    const queries = ["DevOps คืออะไร", "JavaScript คืออะไร", "Big Data คืออะไร"];
    for (const q of queries) {
      const r = await apiChat(q);
      expect(r.text.length).toBeGreaterThan(20);
    }
  });

  test("PS2-C3: Remote AI — no silent fallback on tech queries", async () => {
    const r = await apiChat("ช่วยอธิบาย cloud computing แบบคนทั่วไปเข้าใจ");
    expect(r.text.length).toBeGreaterThan(20);
    expect(r.text).not.toContain("ไม่สามารถตอบ");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D) DETERMINISTIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("D) Deterministic Routes", () => {
  test("PS2-D1: Weather answer is useful (browser)", async ({ page }) => {
    await navigateToChat(page);
    const answer = await sendAndWait(page, "อากาศกรุงเทพวันนี้");
    await ss(page, "ps2-05-weather-answer");
    expect(answer.length).toBeGreaterThan(30);
    expect(answer).toMatch(/อุณหภูมิ|กรุงเทพ|พยากรณ์|ฝน|°C|องศา/);
  });

  test("PS2-D2: Evidence answer runs (browser)", async ({ page }) => {
    await navigateToChat(page);
    const answer = await sendAndWait(page, "สถิติหลักฐานดิจิทัลล่าสุด");
    await ss(page, "ps2-06-evidence-answer");
    expect(answer.length).toBeGreaterThan(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E) CLEAN UI + RELEASE STATE
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("E) Clean UI + Release", () => {
  test("PS2-E1: Chat UI polished state (browser)", async ({ page }) => {
    await navigateToChat(page);
    await ss(page, "ps2-07-clean-chat-ui");
    const input = page.locator('[data-testid="chat-input"]');
    await expect(input).toBeVisible();
    const sendBtn = page.locator('[data-testid="send-btn"]');
    await expect(sendBtn).toBeVisible();
  });

  test("PS2-E2: Homepage loads clean (browser)", async ({ page }) => {
    await navigateToChat(page);
    await ss(page, "ps2-08-release-ready");
    await expect(page.locator('text=สวัสดี')).toBeVisible({ timeout: 10_000 });
  });
});
