/**
 * E2E Test: Evidence Dashboard (structuredContent-only)
 *
 * Validates that evidence structuredContent (kpis/table/series) renders
 * as a deterministic dashboard in the chat UI.
 */

import { test, expect, Page } from "@playwright/test";

async function sendMessageAndWaitForAssistant(page: Page, message: string, timeout = 45000) {
  const textInput = page.locator('[data-testid="chat-input"]');
  const sendBtn = page.locator('[data-testid="send-btn"]');
  const assistantMessages = page.locator('[data-testid="message-assistant"]');

  await expect(textInput).toBeVisible({ timeout: 10000 });
  await expect(sendBtn).toBeEnabled({ timeout: 15000 });

  const assistantBefore = await assistantMessages.count();
  await textInput.fill(message);
  await sendBtn.click();

  await expect(assistantMessages).toHaveCount(assistantBefore + 1, { timeout });
  return assistantMessages.nth(assistantBefore);
}

test.describe("Evidence Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem("chatMessages");
        localStorage.removeItem("chatSummaries");
      } catch {
        // ignore
      }
    });

    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");
  });

  test("renders KPI/table for ISP evidence", async ({ page }) => {
    const lastAssistant = await sendMessageAndWaitForAssistant(
      page,
      "เมื่อวาน evidence แยกตาม ISP และใครมากสุด"
    );

    await expect(lastAssistant).toBeVisible({ timeout: 10000 });

    const dashboard = lastAssistant.locator('[data-testid="evidence-dashboard"]');
    await expect(dashboard).toBeVisible({ timeout: 30000 });

    await expect(dashboard.locator('[data-testid="evidence-kpi-total"]')).toBeVisible();
    await expect(dashboard.locator('[data-testid="evidence-kpi-topisp"]')).toBeVisible();
    await expect(dashboard.locator('[data-testid="evidence-kpi-topcount"]')).toBeVisible();

    await expect(dashboard.locator('[data-testid="evidence-table"]')).toBeVisible();
  });
});
