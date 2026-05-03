# Phase 10 Release Gate

Updated: 2026-04-28T16:50:00+07:00

## Current Gate Status (2026-04-28)

| Check | Result | Evidence |
| :---- | :----- | :------- |
| Focused regression after P1/P2 fixes | PASS | `innomcp-node/tests/unit/__tests__/fastpathIdentity.test.ts` |
| Full system strict gate | PASS (59/59) | `logs/full_system_test_20260428-164416.log` |
| Browser signoff suite | PASS (61/61) | `logs/signoff_suite_20260428-164519.log` |
| Overall verdict | PUBLIC-READY | `docs/reports/SIGNOFF_EVIDENCE_2026-04-28.md` |

### 2026-04-28 Closure Notes

- MCP readiness now reports true remote readiness separately from local-only fallback (`remote=52`, `local=4`, `total=56`).
- `ModeStatusBar` and evidence degraded-state UI now communicate limited/unavailable states honestly.
- Deterministic general-knowledge answers for ML, TCP/IP, and Python vs JavaScript are now Thai-led.
- Browser signoff now asserts that `S6-03` and `S8-01` do not start with English, closing the previous production-gate blind spot.

## Historical Phase Evidence Summary

| Phase             | Result | Verifier / Log File |
| :---------------- | :----- | :------------------ |
| **Phase 10.2**    | PASS   | `innomcp-node/evidence/phase102-chat-iq-20260304-075908.log` |
| **Phase 10.3**    | PASS   | `innomcp-node/evidence/phase103-20260304-045615.log` |
| **Phase 10.4**    | PASS   | `innomcp-node/evidence/phase104-20260304-072031.log` |
| **Phase 10.5**    | PASS   | `innomcp-node/evidence/phase105-knowledge-routing-20260317.log` |
| **Phase 10.7**    | PASS   | `innomcp-node/evidence/phase107-tool-transparency-20260317-235548.log` |
| **Phase 10.1A**   | PASS   | `innomcp-node/evidence/phase101a-20260317-235840.log` |
| **Phase 10.1B**   | PASS   | `innomcp-node/evidence/phase101b-20260317-174349.log` |
| **Phase 10.9**    | PASS   | `innomcp-node/evidence/phase109-tmd-nwp-endpoints-20260317-165803.log` |

## QA Checks

- [x] **Phase 10.2–10.4 Verifiers:** PASS (`verify_phase102_chat_iq_gate`, `verify_phase103_records_retrieval`, `verify_phase104_records_quality_gate`)
- [x] **Phase 10.5 Thai Knowledge Routing:** PASS (`verify_phase105_thai_knowledge_routing` × 3 rounds)
- [x] **Phase 10.7 Tool Transparency:** PASS (`verify_phase107_tool_transparency` × 3 rounds)
- [x] **Phase 10.1A Weather Contract:** PASS (`verify_phase101a_weather_contract` × 3 rounds, fixture mode)
- [x] **Phase 10.1B Weather Map:** PASS (`verify_phase101b_weather_map` × 2 rounds, fixture mode)
- [x] **Phase 10.9 TMD+NWP Endpoint Coverage:** PASS 68/68 checks × 3 rounds (`verify_phase109_tmd_nwp_endpoints`)
- [x] **tmdApiConfig.ts:** 17-tool endpoint→tier map + `getTmdCredsForTier()` + `checkNwpScopes()` + `decodeNwpJwtScopes()`
- [x] **NWP Scope Hard-Block:** `NWP_JWT_EMPTY_SCOPES` thrown immediately when JWT `scopes=[]` (no wasted API call)
- [x] **Weather Map Guard:** `hasRealWeatherData()` blocks placeholder-only payloads; fallback notice shown
- [x] **TMD Tier Split:** `TMD_UID_API`/`TMD_UKEY_API` (api) + `TMD_UID_DEMO`/`TMD_UKEY_DEMO` (demo) in `.env`
- [x] **Health Endpoint:** `/api/health/keys` shows `tmd_api` + `tmd_demo` separately with `required_for_online` flags
- [x] **Git Hygiene:** `innomcp-next/src.zip` (195MB) removed from history; `git push --force` succeeded
- [x] **TypeScript:** `tsc --noEmit` PASS on both `innomcp-node` and `innomcp-server-node`

## Open Blockers (credential-only, code complete)

| Blocker | Root Cause | Action Required |
| :------ | :--------- | :-------------- |
| TMD API auth fail | `TMD_UID_API=api` / `TMD_UKEY_API=api12345` (placeholder) | สมัคร registered credentials ที่ https://data.tmd.go.th/ → ตั้ง `TMD_UID_API` + `TMD_UKEY_API` |
| NWP 401 Unauthorized | `NWP_API_KEY` JWT มี `scopes:[]` | ขอ token ใหม่จาก https://data.tmd.go.th/nwpapi/ พร้อม 4 scopes |
| TMD demo 5 endpoints | `TMD_UID_DEMO=demo` / `TMD_UKEY_DEMO=demokey` | ทดสอบด้วย demo/demo (public; อาจใช้ได้โดยไม่ต้องสมัคร) |

## Phase 10.11 UI Improvements (2026-03-18)

- [x] **ChatInput.tsx:** Placeholder updated → "พิมพ์ถามสภาพอากาศ หรือข้อมูลอื่น ๆ..."
- [x] **ChatPage.tsx:** Typing balloon dots are stage-aware (blue=thinking/tool phase, amber=processing/LLM phase)
- [x] **ChatMessage.tsx:** Weather unavailable notice improved with errTaxonomy-specific messages
  - `upstream > 0` → credentials / API key error
  - `timeout > 0` → connection timeout
  - `noData > 0` → station/area no data
  - default → offline/credentials
- [x] **ModeStatusBar:** New component wired into layout — shows `INNOMCP_MODE` + readiness status
- [x] **`/api/health` (Next.js):** Proxies to `innomcp-node /api/health/keys` → returns `mode`, `mode_ready`, `missing_keys`
- [x] **Playwright E2E:** `innomcp-next/e2e/chat.spec.ts` — 5 scenarios (weather, fallback notice, Phuket, Thai knowledge, mode bar)
- [x] **Phase 10.7 Verifier:** PASS × 3 rounds post-UI changes

### Follow-up Hardening (2026-04-28)

- [x] **Health contract:** `/api/health` and `/api/health/keys` now expose `mcp_status`, `remoteReady`, and local/remote/total tool counts.
- [x] **ModeStatusBar:** renders truthful limited-online state when only local tools are available.
- [x] **EvidenceDashboard:** degraded evidence path renders a distinct unavailable panel instead of a healthy-looking zero state.
- [x] **General knowledge answers:** ML/TCP/IP/Python-vs-JavaScript deterministic responses now lead in Thai and satisfy strict naturalness checks.
- [x] **Signoff gate:** `innomcp-next/e2e/signoff.spec.ts` now fails `S6-03` and `S8-01` if responses start with English.

### E2E Test Commands

```bash
# Requires: all 3 services running
cd innomcp-next
npm run e2e         # headless
npm run e2e:ui      # interactive
```

## Phase 10.10 Online Test (pending credentials)

When real credentials are available, run:

```bash
# TMD + NWP full online test
INNOMCP_MODE=online npx tsx innomcp-server-node/scripts/test_all_tmd_nwp.ts

# Weather contract verifier (real data, no fixture)
INNOMCP_MODE=online WEATHER_FIXTURE_W1=0 npx ts-node innomcp-node/scripts/verify_phase101a_weather_contract.ts

# Decode current NWP JWT scopes
node -e "const j=process.env.NWP_API_KEY||''; const p=j.split('.')[1]; console.log(JSON.parse(Buffer.from(p,'base64').toString()).scopes)"
```

## Rerun Commands (Offline Verifiers)

```bash
# Run all offline verifiers (WEATHER_FIXTURE_W1=1 SMOKE_MODE=1)
cd innomcp-node
WEATHER_FIXTURE_W1=1 SMOKE_MODE=1 npx ts-node scripts/verify_phase101a_weather_contract.ts
WEATHER_FIXTURE_W1=1 SMOKE_MODE=1 npx ts-node scripts/verify_phase105_thai_knowledge_routing.ts
WEATHER_FIXTURE_W1=1 SMOKE_MODE=1 npx ts-node scripts/verify_phase107_tool_transparency.ts
WEATHER_FIXTURE_W1=1 SMOKE_MODE=1 npx ts-node scripts/verify_phase109_tmd_nwp_endpoints.ts
```
