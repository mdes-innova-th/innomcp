# Product Sign-Off Evidence — 2026-04-18

## Verdict: SHIP WITH KNOWN LIMITATIONS

---

## Gap Closure Summary

| Gap | Requirement | Status | Evidence |
|-----|-------------|--------|----------|
| 1 | Zero failing tests or quarantine | ✅ CLOSED | 99/99 unit tests pass; W06 quarantined with justification |
| 2 | Browser E2E screenshots + trace | ✅ CLOSED | 50 screenshots in `innomcp-next/e2e/screenshots/signoff/` |
| 3 | Wider acceptance matrix | ✅ CLOSED | 57-test signoff suite: auth, AI modes, evidence, weather (26), knowledge, tools, truth contract |
| 4 | Proof: local/remote/fallback/degraded | ✅ CLOSED | S2-03 LOCAL, S2-04 local real answer, S2-05 REMOTE, S2-06 HYBRID, S7-03 upstream-down honest error |
| 5 | Final clean release evidence | ✅ CLOSED | This document |

---

## Test Results

### Playwright signoff.spec.ts — 56 passed, 1 skipped, 0 failed (4.6m)

| Section | Tests | Pass | Skip | Fail |
|---------|-------|------|------|------|
| S1: Auth + User Flow | 5 | 5 | 0 | 0 |
| S2: AI Mode UI Flow | 6 | 6 | 0 | 0 |
| S3: Evidence / DetectDB | 5 | 5 | 0 | 0 |
| S4: Weather Noisy Prompts | 26 | 25 | 1 | 0 |
| S5: Thai Knowledge Multi-Turn | 4 | 4 | 0 | 0 |
| S6: General Tool Flow | 4 | 4 | 0 | 0 |
| S7: Weather Truth Contract | 7 | 7 | 0 | 0 |
| **Total** | **57** | **56** | **1** | **0** |

### Unit Tests — 99/99 passed

| Suite | Count |
|-------|-------|
| Jest (innomcp-node) | 82 |
| GeoTool (innomcp-server-node) | 7 |
| KnowledgeTool (innomcp-server-node) | 3 |
| evidenceTool (innomcp-server-node) | 7 |

---

## Quarantined Test

### S4-W06: "สรุปพยากรณ์ 7 วันทุกภาครวมทั้งประเทศ"

- **Reason**: Local LLM (qwen2.5-coder:7b) misroutes this overly-broad nationwide summary query as "general" instead of "weather"
- **Impact**: 25/26 weather prompts route correctly = 96.2% accuracy
- **Classification**: Model quality issue, not infrastructure
- **Mitigation**: `test.skip` with comment in `WEATHER_PROMPTS` array
- **Remediation path**: Improve prompt routing with larger model or fine-tuned classifier

---

## Mode Proof Matrix

| Mode | Test | Evidence |
|------|------|----------|
| LOCAL | S2-03 | Switched via API, verified mode=local |
| LOCAL (real answer) | S2-04 | Sent "สวัสดี" to local Ollama, got real Thai response |
| REMOTE | S2-05 | Switched via API, verified mode=remote |
| HYBRID | S2-06 | Switched via API, verified mode=hybrid |
| Fallback (upstream down) | S7-03 | No confident forecast when upstream fails — honest error |
| Degraded (nationwide) | S7-04 | Nationwide returns honest error, not fake data |
| Truth contract | S7-05 | ERR:WX_UPSTREAM never mixed with confident ranked data |
| Smoke bypass off | S7-06 | mode=local, smoke=false confirmed |

---

## Configuration

- **SMOKE_MODE**: 0 (production path)
- **Budget cap**: 60,000ms
- **Ollama local**: qwen2.5-coder:7b @ 127.0.0.1:11434
- **Ollama remote**: gemma3:12b @ ollama.mdes-innova.online
- **Auth**: JWT (userId:999, roleId:0) + API key + CSRF
- **Playwright**: workers=1, timeout=120s, screenshots=on, trace=retain-on-failure

---

## Artifacts (local, gitignored)

- `innomcp-next/e2e/screenshots/signoff/` — 50 PNG screenshots
- `innomcp-next/e2e/screenshots/signoff/RESULTS_SUMMARY.md` — tabular results (second batch)
- `innomcp-next/test-results/` — Playwright trace for W06 failure
