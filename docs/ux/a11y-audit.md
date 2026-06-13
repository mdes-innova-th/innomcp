# Accessibility Audit: Chat UI (innomcp-next)

## Problem
The chat UI (`/living-chat`) lacks systematic accessibility. Users relying on keyboard navigation or screen readers face barriers: missing focus traps in modals/SlideOver, unlabeled icon buttons, insufficient color contrast in dark mode, and no accessible labels for the leaderboard table. Onboarding modal (“ข้าม”/skip) lacks focus management. Thai+English labels inconsistent.

## Proposed Solution

Conduct an accessibility audit and implement fixes per WCAG 2.1 AA, focusing on:

- **Keyboard navigation** – logical tab order, visible focus indicators, focus traps in modals/SlideOver.
- **ARIA** – labels on icon buttons, leaderboard table via `caption`/`aria-label`, dynamic announcements.
- **Color contrast** – Ensure 4.5:1 ratio in dark mode (text/background, border/background).
- **Onboarding modal** – Focus first dismissible element, trap focus, return focus to trigger (“ข้าม”/skip).
- **Language** – All labels and alt-text available in both Thai and English (via `react-i18next` or locale props).

## Component-Level Changes

Files under `innomcp-next/src/app/components/chat/`:

| Component | Change(s) |
|-----------|-----------|
| `ChatInput.tsx` | Add `aria-label` on submit button (send icon). Link label to input via `aria-controls` for voiceover. |
| `ChatMessage.tsx` | Add `role="listitem"` on each message, `aria-label` containing speaker name + timestamp. |
| `LeaderboardTable.tsx` | Add `<caption>` or `aria-label="ตารางคะแนนสูงสุด / Leaderboard"`. Ensure sortable headers have `aria-sort`. |
| `OnboardingModal.tsx` | Use `focus-trap-react` or manual focus management. Auto-focus the “ข้าม”/Skip button (`aria-label`=”ข้าม / Skip”). Return focus to skip trigger on close. |
| `SlideOver.tsx` | Trap focus inside panel. Add `aria-modal="true"`, `role="dialog"`. Close button with `aria-label`. |
| `UserAvatar.tsx` | Add accessible name via `alt` or `aria-label` (e.g. “ผู้ใช้ / User”). |
| `ChatHeader.tsx` | Ensure theme toggle (`aria-pressed`), drawer toggle (`aria-expanded`). |

## Acceptance Criteria

1. Tab order flows: chat input → send → message list → leaderboard → footer. No focus trap outside modals.
2. All icon buttons (`<button>`) have `aria-label` or `aria-labelledby` (e.g., “ส่ง / Send”, “ข้าม / Skip”).
3. Dark mode text on backgrounds meets 4.5:1 contrast (verified via axe DevTools).
4. Leaderboard table announced as “Leaderboard - ตารางคะแนนสูงสุด” by screen reader.
5. Onboarding modal: focus lands on “ข้าม”/Skip button; Trapped; Escape closes and returns focus to trigger.
6. Thai+English labels present in HTML (e.g., `data-lang` or `lang` attribute switch).
7. Playwright e2e tests (`tests/e2e/tests/`) include keyboard navigation flows and ARIA checks.

## Edge Cases

- **Dynamic content** – New messages announced via `role="status"` with `aria-live="polite"` (not `assertive`).
- **Long leaderboard** – Virtualized rows must maintain `role="row"` and `tabindex`.
- **Modal resizing** – Focus order does not break when viewport changes or zoom applied.
- **Skip button “ข้าม”** – Must be keyboard accessible even if modal auto‑closes.
- **Mixed language** – Ensure `lang` attribute on elements changes appropriately when Thai/English toggle.
- **Mobile keyboard** – Chat input not hidden behind virtual keyboard; avoid focus trap in SlideOver on mobile.
