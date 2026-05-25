
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
    console.log('Test running');
    expect(1).toBe(1);
});

/**
 * Iter-7: Agent Leaderboard E2E Test
 * Verifies that the AgentLeaderboard component renders inside the Agent SlideOver panel
 * when the sidebar-nav-agent button is clicked.
 */
test.describe('Agent Leaderboard panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
  });

  test('leaderboard shows in agent panel', async ({ page }) => {
    // Click the Agent nav icon in the sidebar
    await page.click('[data-testid="sidebar-nav-agent"]');
    await page.waitForTimeout(400);

    // The SlideOver should open and show the leaderboard heading
    await expect(page.locator('text=Agent Leaderboard')).toBeVisible();
    // MDES is the primary provider and should appear
    await expect(page.locator('text=MDES').first()).toBeVisible();
  });

  test('leaderboard filter tabs work', async ({ page }) => {
    await page.click('[data-testid="sidebar-nav-agent"]');
    await page.waitForTimeout(400);

    // All filter tabs should be present
    await expect(page.locator('button', { hasText: /All \(\d+\)/ })).toBeVisible();
    await expect(page.locator('button', { hasText: /Active \(\d+\)/ })).toBeVisible();
    await expect(page.locator('button', { hasText: /Standby \(\d+\)/ })).toBeVisible();
  });

  test('leaderboard shows agent count summary', async ({ page }) => {
    await page.click('[data-testid="sidebar-nav-agent"]');
    await page.waitForTimeout(400);

    // Summary line: "N active · N standby · N total"
    await expect(page.locator('text=/active.*standby.*total/')).toBeVisible();
  });
});
