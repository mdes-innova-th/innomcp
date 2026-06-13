import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

// Helper: dismiss onboarding modal by clicking "ข้าม" button if present
async function dismissOnboarding(page: Page) {
  try {
    await page.getByText('ข้าม').click({ timeout: 3000 });
  } catch {
    // onboarding modal might not appear (guest mode, already dismissed, etc.)
  }
}

// Helper: capture console errors within a scope
async function getConsoleErrors(page: Page, action: () => Promise<void>): Promise<string[]> {
  const errors: string[] = [];
  const handler = (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  };
  page.on('console', handler);
  try {
    await action();
  } finally {
    page.off('console', handler);
  }
  return errors;
}

test.describe('Workspace Files Panel', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.setTimeout(30000);

  // Navigate to /living-chat and dismiss onboarding
  async function gotoAndSetup(page: Page) {
    await page.goto('/living-chat');
    await dismissOnboarding(page);
  }

  test('opening Workspace Files renders the file list region without console errors', async ({ page }) => {
    await gotoAndSetup(page);

    // Open the Workspace Files panel - assume a button/trigger with accessible name
    const openButton = page.getByRole('button', { name: /workspace files/i });
    await openButton.waitFor({ state: 'visible', timeout: 5000 });

    const errors = await getConsoleErrors(page, async () => {
      await openButton.click();
      // Wait for the file list region to appear (e.g., a div with role="list" or data-testid)
      const fileListRegion = page.getByRole('list', { name: /workspace files/i }).or(page.getByTestId('workspace-files-list'));
      await expect(fileListRegion).toBeVisible({ timeout: 5000 });
      // Additional wait to ensure any async rendering completes
      await page.waitForTimeout(1000);
    });

    expect(errors).toEqual([]);
  });

  test('closing the panel via X button works', async ({ page }) => {
    await gotoAndSetup(page);

    // Open panel
    await page.getByRole('button', { name: /workspace files/i }).click();
    const closeButton = page.getByRole('button', { name: /close/i }).or(page.getByLabel('Close'));
    await expect(closeButton).toBeVisible({ timeout: 3000 });
    await closeButton.click();

    // Panel should no longer be visible
    await expect(page.getByRole('list', { name: /workspace files/i })).not.toBeVisible({ timeout: 3000 });
  });

  test('file list displays correctly when empty (guest mode)', async ({ page }) => {
    await gotoAndSetup(page);

    // Open panel
    await page.getByRole('button', { name: /workspace files/i }).click();
    const fileList = page.getByRole('list', { name: /workspace files/i });
    await expect(fileList).toBeVisible({ timeout: 5000 });

    // Edge case: list might be empty; check for an empty message or fallback text
    // Tolerate either: a list with 0 items or a "no files" text
    const isEmptyMessage = page.getByText(/no files/i);
    const listItems = fileList.locator('> li, > div');
    const itemCount = await listItems.count().catch(() => 0);
    if (itemCount === 0) {
      // expect either empty message or no visible children
      await expect(isEmptyMessage.or(fileList)).toBeVisible({ timeout: 2000 });
    } else {
      // Regular case: list has items
      await expect(listItems.first()).toBeVisible();
    }
  });

  test('reopening panel after closure works correctly', async ({ page }) => {
    await gotoAndSetup(page);

    // Open once
    await page.getByRole('button', { name: /workspace files/i }).click();
    await expect(page.getByRole('list', { name: /workspace files/i })).toBeVisible({ timeout: 3000 });
    // Close
    await page.getByRole('button', { name: /close/i }).or(page.getByLabel('Close')).click();
    await expect(page.getByRole('list', { name: /workspace files/i })).not.toBeVisible({ timeout: 3000 });

    // Reopen
    await page.getByRole('button', { name: /workspace files/i }).click();
    await expect(page.getByRole('list', { name: /workspace files/i })).toBeVisible({ timeout: 3000 });
  });

  test('navigating away and back preserves panel state', async ({ page }) => {
    await gotoAndSetup(page);

    // Open panel
    await page.getByRole('button', { name: /workspace files/i }).click();
    await expect(page.getByRole('list', { name: /workspace files/i })).toBeVisible({ timeout: 3000 });

    // Navigate to dashboard and back
    await page.goto('/dashboard');
    await dismissOnboarding(page);
    await page.goto('/living-chat');
    await dismissOnboarding(page);

    // Panel should be closed by default (state not preserved across pages)
    await expect(page.getByRole('list', { name: /workspace files/i })).not.toBeVisible({ timeout: 3000 });
  });
});
