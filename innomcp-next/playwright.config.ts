import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for innomcp-next
 * Requires: all 3 services running (innomcp-next :3000, innomcp-node :3011, innomcp-server-node :3012)
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "th-TH",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // No webServer block — services must be started manually or via docker compose
});
