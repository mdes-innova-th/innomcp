---
status: investigating
trigger: "Calculator E2E tests failing: C1 (125*17+43=2168), C5 ((10+5)*20-50=250), OP5 (1+1=2), PERF-CALC (2^16=65536) all fail all retries"
created: 2026-05-23
updated: 2026-05-23
---

## Symptoms
- expected: The calculator tool returns correct arithmetic results
- actual: Tests expect specific numeric outputs (/2168/, /250/, /\b2\b/, /65536/) but regex never matches
- errors:
  - C1: `expect(text).toMatch(/2168/)` fails (125*17+43=2168)
  - C5: `expect(text).toMatch(/250/)` fails ((10+5)*20-50=250)
  - OP5: `expect(text).toMatch(/\b2\b/)` fails (1+1=2)
  - PERF-CALC: `expect(text).toMatch(/65536/)` fails (2^16=65536)
- timeline: Current session; previous session all passing; spec files were edited (multiagent-panel + acceptance) but no calc changes visible
- reproduction: `npx playwright test e2e/acceptance.spec.ts -g "C1|C5|OP5|PERF-CALC" --workers=1`

## Additional Failures
- PS2-A1: 'คุณชื่ออะไร' expected "Innova-bot" substring not found
- ID1: กรุงเทพมีเขตอะไรบ้าง - district names not matching `/พระนคร|บางรัก|ปทุมวัน|สาทร|จตุจักร/`

## Current Focus
hypothesis: "The Playwright failures are caused by a backend startup crash, not by calculator arithmetic logic. The backend workspace route uses legacy wildcard syntax incompatible with path-to-regexp v8."
test: Restart the backend after fixing the route, confirm /api/chat/stream is reachable, then rerun the targeted acceptance tests.
expecting: The backend starts cleanly and the frontend chat input is reachable; calculator tests should then exercise the tool logic.
next_action: "Stop the old backend on port 3011, start the patched backend, and rerun the calculator acceptance test cases."

## Evidence
- timestamp: 2026-05-23T00:00:00Z
  note: "C1/C5/OP5/PERF-CALC all fail 3 retries each → systematic failure, not flakiness"
  finding: "The pattern is exclusively calculator tests + one identity + one district test"
- timestamp: 2026-05-23T00:45:00Z
  note: "Backend crash logs show PathError from /api/workspace/files route" 
  finding: "Current route syntax is incompatible with path-to-regexp@8.4.2 used by router@2.2.0"
- timestamp: 2026-05-23T00:55:00Z
  note: "Patch applied to innomcp-node/src/routes/api/workspace/index.ts using new wildcard syntax '/files{/*path}'"
  finding: "Backend now starts cleanly on port 3011 once existing process is stopped"

## Eliminated
- hypothesis: "calculator tool itself is broken due arithmetic logic"
  reason: "The backend was crashing before the calculator flow could be tested, so startup failure is the first root cause to fix"

## Resolution
root_cause: "Backend startup crash in workspace route handler due to legacy Express-like wildcard route syntax (/files/*) not compatible with path-to-regexp@8.4.2. This prevented the backend from running correctly and likely caused the Playwright failures.
"
fix: "Change the workspace file read route in innomcp-node/src/routes/api/workspace/index.ts from legacy wildcard syntax to path-to-regexp v8 wildcard syntax: router.get('/files{/*path}', ...) and read req.params.path."
verification: "Stop the current node process on port 3011, restart the backend, and rerun the targeted Playwright acceptance tests for calculator cases. Confirm the app launches and the chat input appears before validating calculator output."
files_changed: ["innomcp-node/src/routes/api/workspace/index.ts"]
