<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-2 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":89,"completion_tokens":4238,"total_tokens":4327,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2233,"image_tokens":0},"cache_creation_input_tokens":0} | 80s
 generated: 2026-06-12T04:21:53.426Z -->
# Layout Update Guide: ChatPage, Error Boundaries, and Playwright Audits

> **Target File:** `innomcp-next/docs/LAYOUT-UPDATE-GUIDE.md`  
> **Scope:** Next.js App Router, React 18+, Tailwind CSS, Playwright

This guide provides step-by-step instructions for updating the main application layout. It covers the integration of the WebSocket status banner, isolating workspace errors, and verifying the 3-column architecture using Playwright.

---

## Step 1: Integrate `WSStatusBanner` in the ChatPage Layout

The `WSStatusBanner` provides real-time connection feedback to the user. It must be positioned strictly **below the chat header** and **above the chat messages** to ensure it doesn't overlap with interactive elements or obscure the message history.

Update your `ChatPage` component to include the banner and add the necessary `data-testid` attributes for testing.

```tsx
// src/app/chat/page.tsx (or your ChatPage component path)
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { WSStatusBanner } from '@/components/status/WSStatusBanner';

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full w-full" data-testid="chat-column">
      {/* 1. Header at the very top */}
      <ChatHeader data-testid="chat-header" />
      
      {/* 2. WS Status Banner immediately below header */}
      <WSStatusBanner data-testid="ws-status-banner" />
      
      {/* 3. Messages take up remaining flexible space */}
      <div className="flex-1 overflow-y-auto" data-testid="chat-messages">
        <ChatMessages />
      </div>
      
      {/* 4. Input pinned to the bottom */}
      <ChatInput />
    </div>
  );
}
```

---

## Step 2: Wrap `ManusWorkspacePanel` with `PanelErrorBoundary`

The workspace panel executes complex, potentially unstable operations (e.g., code execution, heavy rendering). To prevent a workspace crash from taking down the entire application (and specifically the chat interface), wrap it in a dedicated error boundary.

```tsx
// src/components/workspace/WorkspaceColumn.tsx
import { PanelErrorBoundary } from '@/components/error/PanelErrorBoundary';
import { ManusWorkspacePanel } from './ManusWorkspacePanel';

export function WorkspaceColumn() {
  return (
    <aside 
      className="w-96 border-l border-gray-200 h-full flex flex-col" 
      data-testid="workspace-column"
    >
      <PanelErrorBoundary 
        panelName="Manus Workspace" 
        data-testid="panel-error-boundary"
      >
        <ManusWorkspacePanel data-testid="manus-workspace-panel" />
      </PanelErrorBoundary>
    </aside>
  );
}
```

*Note: Ensure your `PanelErrorBoundary` exposes a fallback UI with `data-testid="panel-error-boundary-fallback"` when an error is caught.*

---

## Step 3: Assemble the 3-Column Layout

Combine the Sidebar, Chat, and Workspace into the root layout. Use Tailwind's flexbox utilities to ensure the columns behave correctly and the layout fills the viewport without triggering unwanted body scrolls.

```tsx
// src/app/layout.tsx (or your main dashboard layout)
import { Sidebar } from '@/components/navigation/Sidebar';
import ChatPage from '@/app/chat/page';
import { WorkspaceColumn } from '@/components/workspace/WorkspaceColumn';

export default function DashboardLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      {/* Column 1: Navigation Sidebar */}
      <aside 
        className="w-64 border-r border-gray-200 h-full flex-shrink-0" 
        data-testid="sidebar-column"
      >
        <Sidebar />
      </aside>

      {/* Column 2: Main Chat Interface (Flexible width) */}
      <main className="flex-1 min-w-0 h-full">
        <ChatPage />
      </main>

      {/* Column 3: Workspace Panel (Fixed width) */}
      <WorkspaceColumn />
    </div>
  );
}
```

---

## Step 4: Verify Layout with Playwright Audit

To guarantee the layout remains stable and the error boundary functions correctly, implement a comprehensive Playwright test suite. 

Because 3-column layouts require significant horizontal space, **you must explicitly set a desktop viewport** to prevent responsive collapsing during the audit.

Create or update your test file at `e2e/layout-audit.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

// Force a wide viewport to ensure the 3-column layout renders fully
test.use({ viewport: { width: 1920, height: 1080 } });

test.describe('3-Column Layout & Component Integration Audit', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the main dashboard/chat route
    await page.goto('/chat');
    // Wait for the main layout container to be visible
    await page.waitForSelector('[data-testid="chat-column"]');
  });

  test('should render all 3 columns side-by-side', async ({ page }) => {
    const sidebar = page.getByTestId('sidebar-column');
    const chat = page.getByTestId('chat-column');
    const workspace = page.getByTestId('workspace-column');

    // Verify visibility
    await expect(sidebar).toBeVisible();
    await expect(chat).toBeVisible();
    await expect(workspace).toBeVisible();

    // Verify horizontal order using bounding boxes
    const sidebarBox = await sidebar.boundingBox();
    const chatBox = await chat.boundingBox();
    const workspaceBox = await workspace.boundingBox();

    // Sidebar should be to the left of Chat
    expect(sidebarBox!.x + sidebarBox!.width).toBeLessThanOrEqual(chatBox!.x + 1);
    // Chat should be to the left of Workspace
    expect(chatBox!.x + chatBox!.width).toBeLessThanOrEqual(workspaceBox!.x + 1);
  });

  test('should position WSStatusBanner correctly in the Chat column', async ({ page }) => {
    const header = page.getByTestId('chat-header');
    const banner = page.getByTestId('ws-status-banner');
    const messages = page.getByTestId('chat-messages');

    await expect(header).toBeVisible();
    await expect(banner).toBeVisible();
    await expect(messages).toBeVisible();

    // Verify vertical stacking order
    const headerBox = await header.boundingBox();
    const bannerBox = await banner.boundingBox();
    const messagesBox = await messages.boundingBox();

    // Header is above Banner
    expect(headerBox!.y + headerBox!.height).toBeLessThanOrEqual(bannerBox!.y + 1);
    // Banner is above Messages
    expect(bannerBox!.y + bannerBox!.height).toBeLessThanOrEqual(messagesBox!.y + 1);
  });

  test('should isolate workspace crashes using PanelErrorBoundary', async ({ page }) => {
    // 1. Inject a failure state into the workspace panel (requires app-side test hook)
    await page.evaluate(() => {
      (window as any).__FORCE_WORKSPACE_CRASH__ = true;
    });
    
    // 2. Reload to trigger the error during render/initialization
    await page.reload();

    // 3. Verify the Error Boundary caught the crash
    await expect(page.getByTestId('manus-workspace-panel')).not.toBeVisible();
    await expect(page.getByTestId('panel-error-boundary-fallback')).toBeVisible();
    await expect(page.getByText(/workspace encountered an error/i)).toBeVisible();

    // 4. CRITICAL: Verify the Chat column and Banner remain completely unaffected
    await expect(page.getByTestId('chat-column')).toBeVisible();
    await expect(page.getByTestId('ws-status-banner')).toBeVisible();
    await expect(page.getByTestId('chat-messages')).toBeVisible();
  });
});
```

### Running the Audit

Execute the Playwright tests to verify the integration:

```bash
# Run the specific layout audit
npx playwright test e2e/layout-audit.spec.ts

# Run with UI mode for visual debugging of the bounding boxes
npx playwright test e2e/layout-audit.spec.ts --ui
```

## Checklist for PR Submission

- [ ] `WSStatusBanner` is imported and placed between `ChatHeader` and `ChatMessages`.
- [ ] `ManusWorkspacePanel` is wrapped in `PanelErrorBoundary`.
- [ ] Root layout uses `flex h-screen` with 3 distinct columns.
- [ ] All components include the specified `data-testid` attributes.
- [ ] `__FORCE_WORKSPACE_CRASH__` test hook is implemented in `ManusWorkspacePanel` for testing purposes.
- [ ] `npx playwright test` passes locally with the 1920x1080 viewport.
