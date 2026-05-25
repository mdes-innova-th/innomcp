import { defineConfig, devices } from '@playwright/test';

/**
 * Root-level Playwright config — used only for CI and repo-root `npx playwright test` runs.
 *
 * IMPORTANT: `tests/e2e/` is a self-contained Playwright sub-project with its own
 * `package.json`, `node_modules`, and `playwright.config.ts`.  Running `npx playwright test`
 * from the repo root previously caused "Requiring @playwright/test second time" because the
 * root scanner loaded spec files from `tests/e2e/` while those specs imported from the
 * sub-project's own Playwright install.
 *
 * Fix: point `testDir` at the nested `tests/` folder inside the sub-project so the root
 * scanner only picks up specs that import from THIS root install, not the sub-project's.
 * To run the full suite use:  cd tests/e2e && npx playwright test
 */
export default defineConfig({
  testDir: './tests/e2e/tests',
  // Exclude specs that import from the tests/e2e sub-project's own Playwright install.
  // Those specs are self-contained and must be run via: cd tests/e2e && npx playwright test
  testIgnore: ['**/node_modules/**', '**/tests/e2e/**'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,   // 1 retry in local to handle transient flake
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'echo "Assuming services are already running"',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
});
