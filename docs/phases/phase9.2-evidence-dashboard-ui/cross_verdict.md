# Phase 9.2: CROSS Verdict Template

**CROSS Verifier:** You must execute the "3 layers" of inspection for the frontend before rendering a verdict.

## 1. Grep Sweeps

- [ ] **Color Hardcode Sweep:** `grep -ri "#[0-9a-fA-F]" innomcp-next/src/app/components/evidence/` (Ensure Tailwind semantic classes are used instead of hardcoded hex values to protect theme switching).
- [ ] **Data Computation Sweep:** `grep -ri "reduce(" innomcp-next/src/app/components/evidence/` (Ensure the UI is purely rendering, NOT calculating aggregates).

## 2. Logic Integrity Review

**You MUST strictly read the code of the following files:**

- [ ] `EvidenceDashboard.tsx` and sub-components -> Verify the green accent is implemented via Tailwind. Verify optional chaining exists to prevent crashes on malformed `structuredContent`.
- [ ] Chat UI Renderer -> Verify the component is securely hydrated and doesn't rely on `dangerouslySetInnerHTML` for the `structuredContent`.

## 3. Evidence-Format Sweeps

- [ ] Verify `console.log` is completely stripped from the production build of these components to prevent bleeding DB payloads into browser logs.

## Handshake Requirement

To pass the gate, CROSS must output the standard Handshake block with the following mandatory citations:

```markdown
[CROSS_VERDICT]
Status: PASS/REQUEST_CHANGES
Reason: <Short 1-line reason>

Citations:

- Spec Ref: <Mention specific Spec headings like "Section 2. Component Spec" or "TC_92_02: Dark/Light Mode Validation">
- Verifier Script: `Manual UI Inspection`
- Renderer Function: `EvidenceDashboard` / `KpiCard`
```
