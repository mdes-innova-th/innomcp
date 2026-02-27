# Phase 9.2: Patch-Pack

_This document outlines the explicit locations VIT must modify during frontend implementation._

## 1. Target Files for Implementation (VIT)

- `innomcp-next/src/app/components/evidence/EvidenceDashboard.tsx` (NEW)
  - _Action:_ Main container component accepting `structuredContent`.
- `innomcp-next/src/app/components/evidence/KpiCard.tsx` (NEW)
- `innomcp-next/src/app/components/evidence/EvidenceChart.tsx` (NEW)
- `innomcp-next/src/app/components/evidence/EvidenceTable.tsx` (NEW)
- `innomcp-next/src/app/components/chat/ChatToolRenderer.tsx` (or equivalent)
  - _Action:_ Wire the new `EvidenceDashboard` to render when the evidence tool returns `structuredContent`.

## 2. Risk Matrix

| Risk Element   | Description & Mitigation                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Theme Bug**  | Hardcoding colors causes invisible text. _Mitigation:_ Exclusively use Tailwind `dark:` variants and CSS variables.                          |
| **A11y Crash** | Green accent fails contrast checker. _Mitigation:_ Use verified emerald shades (e.g., `text-emerald-700` light / `text-emerald-400` dark).   |
| **Data Fault** | Payload missing nodes breaks React tree. _Mitigation:_ Implement strict Optional Chaining (`?.`) and fallback UI placeholders.               |
| **Logic Leak** | UI recalculates values. _Mitigation:_ Strict Code Review ban on `reduce`, `map` for math, and formatting manipulations inside the component. |

## 3. UI Smoke Runner Specification (Phase 9.2.1)

**File:** `innomcp-next/scripts/run_smoke.ps1` (NEW)
**Description:** A deterministic E2E runner for the UI that does not hang on Windows.
**Requirements:**

1. Start background services (Next.js, Node) explicitly injecting `SMOKE_MODE=true`.
2. Wait for services to become responsive (e.g. `Invoke-WebRequest -UseBasicParsing` or localhost health).
3. Run `npx playwright test tests/e2e/smoke.spec.ts`.
4. Gracefully and aggressively tear down processes (`taskkill /F /IM node.exe /T` or capturing background PIDs and `Stop-Process`).
5. Final stdout MUST be either strictly `PASS` or `BLOCKED` in **1 line** at the bottom of the log (using `cmd /c exitcode` or similar).

## 4. Operator Notes

**Fast checking commands:**

1. Boot Frontend UI:
   `cd innomcp-next && npm run dev`
2. Toggle OS Dark/Light mode to verify Theme switch.
3. Run standard linter against UI components:
   `npm run lint -- src/app/components/evidence/`
