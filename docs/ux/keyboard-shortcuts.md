# Keyboard Shortcuts UX Spec – innomcp

## Problem
Power users and fast typists on `/living-chat` waste time reaching for mouse/touch to perform frequent actions (send, switch model, open panels). No discoverable help leads to underutilized shortcuts.

## Proposed Solution
Implement a global keyboard-shortcut map, with a `?` overlay for discovery. All shortcuts work across `/living-chat` and modals. Localized labels in Thai & English.

## Shortcut Map

| Action                    | Key(s)               | Context               |
|---------------------------|----------------------|-----------------------|
| Send message              | `Enter` (or `Ctrl+Enter` for newline) | Chat input focused |
| Toggle theme              | `Ctrl+Shift+T`       | Anywhere (exists)     |
| Focus chat input          | `/`                  | Anywhere (except input) |
| Open help overlay         | `?`                  | Anywhere              |
| Close modal / overlay     | `Esc`               | Modal open            |
| Switch model (next/prev)  | `Ctrl+↑` / `Ctrl+↓` | Chat window focused   |
| Open panel (sidebar/tabs) | `Ctrl+1..4`         | Anywhere              |

- `Enter` sends; `Shift+Enter` inserts newline.
- `/` focuses input; if already focused, `/` typed as literal.
- `Ctrl+↑/↓` cycles through available models (dropdown).
- `Ctrl+1..4` toggles panels: 1=history, 2=settings, 3=files, 4=users.

## Component-Level Changes
All files under `innomcp-next/src/app/components/chat/`:

- **`ChatInput.tsx`** – Add `onKeyDown` handler for `Enter` vs `Ctrl+Enter`, and suppress default `/` behavior.
- **`ChatWindow.tsx`** – Listen for global `Ctrl+↑/↓` to dispatch model-switch.
- **`ChatLayout.tsx`** – Hook global listeners for `?` to toggle `ShortcutsOverlay`, `Esc` to close modals, `Ctrl+1..4` to open panels.
- **`ShortcutsOverlay.tsx`** – New component: semi-transparent overlay listing all shortcuts with Thai & English labels. Triggered by `?`.
- **`ThemeToggle.tsx`** – Already uses `Ctrl+Shift+T`; no change.
- **`OnboardingModal.tsx`** – Ensure `Esc` dismisses it (overrides `ข้าม` button).

## Acceptance Criteria
1. Pressing `Enter` on empty input does not send (minimises accidental sends).
2. `?` overlay appears and lists all shortcuts in both languages; pressing `?` again or `Esc` closes it.
3. `/` focuses chat input from any non-input element; typing `/` in input inserts `/`.
4. Model switching loops through available models.
5. Theme toggle works as before.
6. Modals (onboarding, settings) close via `Esc`.
7. Panels open/close correctly with `Ctrl+1..4`.
8. No conflicts with browser defaults (e.g., `/` search).

## Edge Cases
- **Input-focused**: If user is typing in a form field outside chat, `/` should not steal focus (scope to chat area).
- **Multiple modals**: Only topmost modal closes with `Esc`.
- **Accessibility**: Shortcuts must be announced to screen readers via ARIA live region when overlay opens.
- **Theme toggle already bound**: No duplication.
- **Thai keyboard**: `/` and `?` remain on same physical keys; should work.
- **Touch devices**: Shortcuts ignored when no physical keyboard detected (MediaQuery `(hover: hover) and (pointer: fine)`).
