<!-- cc-team deliverable
 group: P4D (Phase 4.4 â€” Layout QA vs manus.im (3-column, header, responsive))
 member: P4D-4 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":122,"completion_tokens":2489,"total_tokens":2611,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1730,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 35s
 generated: 2026-06-12T03:45:23.636Z -->
```markdown
# Phase 4 Exit Criteria Verification Checklist

**Location:** `innomcp-next/docs/PHASE4-EXIT-CRITERIA.md`  
**Purpose:** Verify that the Phase 4 build meets stability, resilience, streaming, and responsive layout requirements before exiting the phase.

---

## 1. Playwright Audit: 0 Console Errors, 3 Columns Detected

| Item | Details |
|------|---------|
| **Test Command** | `npx playwright test tests/e2e/phase4-exit/audit.spec.ts --project=chromium` |
| **Expected Result** | 1. Playwright report shows **0** console `error` logs (allow-listed external warnings are exempt). <br>2. Selector `[data-testid="layout-column"]` resolves to exactly **3** visible columns. <br>3. Test status: **passed**. |

---

## 2. Error Boundaries: Force Panel Error → Boundary Shows, Not Blank Page

| Item | Details |
|------|---------|
| **Test Command** | `npx playwright test tests/e2e/phase4-exit/error-boundary.spec.ts` |
| **Expected Result** | 1. Injecting `window.__FORCE_PANEL_ERROR__ = true` before rendering causes the target panel to throw. <br>2. The nearest React Error Boundary renders a fallback UI (error message and/or retry button) **inside** the panel slot. <br>3. The overall page remains interactive; the URL does not change and the screen is **not** a blank white page. <br>4. Test status: **passed**. |

---

## 3. AgentStepsView: Steps Stream During Chat

| Item | Details |
|------|---------|
| **Test Command** | `npx playwright test tests/e2e/phase4-exit/agent-steps-stream.spec.ts` |
| **Expected Result** | 1. During an active chat session, the `AgentStepsView` component receives step data progressively. <br>2. DOM query `[data-testid="agent-step-item"]` count increases from 0 to **> 1** while the stream is active. <br>3. Steps are visible before the final chat message completes; no full-page reload occurs between steps. <br>4. Test status: **passed**. |

---

## 4. Layout at 1440px / 768px / 375px: Header Visible, Columns Present

| Item | Details |
|------|---------|
| **Test Command** | `npx playwright test tests/e2e/phase4-exit/responsive-layout.spec.ts` |
| **Expected Result** | 1. **1440px** viewport: `[data-testid="app-header"]` is visible; exactly **3** layout columns are detected. <br>2. **768px** viewport: `[data-testid="app-header"]` is visible; **2** layout columns are detected. <br>3. **375px** viewport: `[data-testid="app-header"]` is visible; **1** layout column is detected with no horizontal overflow. <br>4. Test status: **passed** for all three breakpoints. |

---

## Sign-off

| Criterion | Verified By | Date | Result |
|-----------|-------------|------|--------|
| 1. Playwright Audit | | | [ ] Pass / [ ] Fail |
| 2. Error Boundaries | | | [ ] Pass / [ ] Fail |
| 3. AgentStepsView Streaming | | | [ ] Pass / [ ] Fail |
| 4. Responsive Layout | | | [ ] Pass / [ ] Fail |

**Phase 4 Exit Approved:** [ ] Yes &nbsp;&nbsp; [ ] No (blockers documented)
```
