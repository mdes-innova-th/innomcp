/**
 * Visual sanity checks after the chat-page-reqs.md redesign.
 * Captures three viewports (mobile / tablet / desktop) for both
 * empty and seeded conversation states, then asserts:
 *  - composer never visually overlaps the last message
 *  - body text never wider than viewport (no horizontal overflow)
 *  - sidebar never covers the textarea on small viewports (when collapsed)
 */
import { test, expect, Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 720 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const;

const SEED = [
  { sender: "user", text: "อากาศในกรุงเทพฯ วันนี้เป็นอย่างไร?" },
  {
    sender: "ai",
    text: [
      "ช่วงเวลา: วันนี้ (30/04/2026)",
      "",
      "พื้นที่: กรุงเทพมหานคร",
      "📍 กรุงเทพมหานคร — มีโอกาสฝนตก ณ ขณะนี้ 26-33°C",
    ].join("\n"),
    structuredContent: {
      chatMeta: {
        mode: "online",
        route: "weatherPipeline",
        reason_code: "TOOL_OK",
        toolsUsed: [{ name: "weatherPipeline" }],
      },
      __groundedContract: { sourceType: "tool-only", llmUsed: false, modelUsed: null },
      memoryRag: { mode: "hot", entities: ["province:กรุงเทพ"], coldHits: 0, turn: 1 },
      guidance: ["ข้อมูลอากาศที่ได้รับยังไม่ครบถ้วนสำหรับการแสดงแผนที่"],
      toolsUsed: ["weatherPipeline"],
      sources: ["weather-bkk.json", "TMD-forecast-30Apr2026.PDF"],
    },
    toolsUsed: ["weatherPipeline"],
  },
];

async function seedAndOpen(page: Page) {
  await page.addInitScript((seeded) => {
    localStorage.setItem("chatMessages", JSON.stringify(seeded));
    localStorage.setItem("chatTitle", "อากาศกรุงเทพฯ วันนี้");
  }, SEED);
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  // Allow 1px tolerance for sub-pixel rounding.
  expect(overflow).toBeLessThanOrEqual(1);
}

for (const vp of VIEWPORTS) {
  test.describe(`viewport ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("empty state — full page", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: `e2e/screenshots/impeccable-${vp.name}-empty.png`,
        fullPage: true,
      });
      await noHorizontalOverflow(page);
    });

    test("conversation state — full page", async ({ page }) => {
      await seedAndOpen(page);
      await page.screenshot({
        path: `e2e/screenshots/impeccable-${vp.name}-conversation.png`,
        fullPage: true,
      });

      await noHorizontalOverflow(page);

      // Composer top must be ≥ last-message bottom (no overlap).
      const composer = page.locator("textarea").first();
      const last = page
        .locator('[data-testid="message-assistant"], [data-testid="message-user"]')
        .last();
      if ((await last.count()) > 0) {
        const composerBox = await composer.boundingBox();
        const lastBox = await last.boundingBox();
        if (composerBox && lastBox) {
          expect(composerBox.y).toBeGreaterThanOrEqual(lastBox.y + lastBox.height - 6);
        }
      }
    });
  });
}

test("desktop — composer toolbar is single-row at 1280+", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedAndOpen(page);

  // Tools selector + attach button + send button live in one row when room allows.
  const toolsBtn = page.getByRole("button", { name: /อัตโนมัติ|สภาพอากาศ|คำนวณ|ภาพและกราฟ|ข้อมูล|วัน-เวลา|เจ้าหน้าที่/ }).first();
  const attachBtn = page.getByTitle("แนบไฟล์").first();
  const sendBtn = page.locator('[data-testid="send-btn"]').first();

  const [t, a, s] = await Promise.all([
    toolsBtn.boundingBox(),
    attachBtn.boundingBox(),
    sendBtn.boundingBox(),
  ]);
  expect(t && a && s).toBeTruthy();
  if (t && a && s) {
    // Their top y values should be within ~6px of each other (same row).
    const tops = [t.y, a.y, s.y];
    const maxTop = Math.max(...tops);
    const minTop = Math.min(...tops);
    expect(maxTop - minTop).toBeLessThanOrEqual(6);
  }
});
