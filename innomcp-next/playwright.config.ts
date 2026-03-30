import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for innomcp-next
 * Requires: all 3 services running (innomcp-next :3000, innomcp-node :3011, innomcp-server-node :3012)
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,  // zero retries — globalSetup pre-warms caches so no test needs retry
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/globalSetup.ts",
  timeout: 120_000, // 2min per test — weather/NWP queries can take 40s+ cold
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "on",
    locale: "th-TH",
    video: "off",
    actionTimeout: 30_000,  // raised from 15s — covers post-warmup prose renders
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // No webServer block — services must be started manually or via docker compose
});
