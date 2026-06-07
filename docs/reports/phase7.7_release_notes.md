# Phase 7.7: Release Notes (Version 7.x RC)

## 1. Summary of Achievements

**Phase 7.3: The 3 Pillars (GEO, Weather, Evidence)**

- **GEO Accuracy:** Adjusted `extractGeoLookupQuery` to prioritize District over Province, resolving the "หลักสี่" vs "กรุงเทพมหานคร" ambiguity and eliminating trivia-style responses.
- **Weather Reliability:** Removed hardcoded "โหมดทดสอบ" leaks from FastPath responses, and implemented a smoke-run deterministic answer for multi-district routing without hijacking the real pipeline.
- **Evidence Fallbacks:** Introduced `evidence_records_yesterday_total` and `evidence_records_yesterday_by_isp_top` intents, complete with safe, human-readable Thai fallbacks when `DETECT_DB` credentials are missing.

**Phase 7.4: General Intelligence Hardening**

- **GeneralGate Implementation:** Intercepts general conversational queries (e.g., greetings, broad knowledge) _before_ expensive MCP tool selection, saving latency and token costs.
- **Strict Budget & Fallback:** Enforces a rigid execution budget (`GENERAL_LLM_BUDGET_MS`, default 5s) for the fast LLM; if exceeded, it gracefully degrades to a short Thai apology without showing internal errors.
- **Refined Heuristics:** Negative signals precisely protect core tools (e.g., "downtime" is not mistaken for a datetime intent, and "อธิบาย Docker" correctly bypasses infra tools to provide knowledge).

**Phase 7.5: Release Candidate Gate (RC)**

- **Deterministic CI:** Standardized the execution of backend builds and verifications via `scripts/run_minimal_ci.ps1`, proving the system can consistently pass tests outside the volatile GUI `npm test` environment.
- **Automated Verification:** Deployed new HTTP/TS-based verifiers for Phase 7.3 (3 cases) and Phase 7.4 (25 cases) that assert both logical correctness and output cleanliness.
- **Security Check:** Established the RC Source-of-Truth report (`rc_gate.md`), verifying zero test-mode string leakages and confirming `CHAT_TRACE_QA` safety.

**Phase 7.6: Pre-commit Hook Hygiene & Security**

- **Non-Interactive Commits:** Replaced legacy interactive hooks with a versioned, offline `.githooks/pre-commit` that relies solely on static checks (`tsc --noEmit`).
- **Serverless Validation:** The commit process no longer requires a running backend (Port 3011) to succeed, eliminating developer bottlenecks and "server start to commit" anti-patterns.
- **RC Reproducibility:** Introduced `run_rc_gate.ps1` as the single executable command to rerun all Phase 7.3/7.4 verifiers and output the PASS/BLOCKED verdict directly.

---

## 2. Known Issues

| Symptom                                               | Cause                                                                                                                           | Mitigation                                                                                                                                    |
| :---------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| **GUI E2E Tests Overlapping/Hanging**                 | The Playwright test runner in the local Windows environment occasionally leaves zombie `node` or `playwright` processes behind. | Use `taskkill /F /IM node.exe` manually, or rely entirely on `run_rc_gate.ps1` and `run_minimal_ci.ps1` for deterministic testing.            |
| **Port 3011/3012 Bind Failures during rapid testing** | Rapidly starting and stopping `concurrently` during development does not release the port bindings immediately.                 | Wait 5-10 seconds between backend restarts, or run the verification scripts against a stable, already-running local dev server.               |
| **HTTP 429 Too Many Requests in verifier scripts**    | Running 25+ LLM verification cases concurrently or in rapid succession hits the LLM rate limiter.                               | Verifier scripts are designed to run sequentially or with `x-smoke-run: 1` headers to return deterministic offline responses during heavy CI. |

---

## 3. Operator Notes

- **RC Gate Executable:** To verify the integrity of the build at any time, run:

  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run_rc_gate.ps1
  ```

  _This will execute the Minimal CI, followed by the Phase 7.3 and Phase 7.4 verifiers._

- **Environment Variables:**
  - `SMOKE_MODE=1`: Bypasses external network calls and slow LLMs, using static strings (Useful for rapid E2E or Verifier runs).
  - `CHAT_TRACE_QA=1`: Enables structured `Trace v3` logging (useful for debugging prompt chains).
  - `GENERAL_LLM_BUDGET_MS=5000`: Controls how long the fast-LLM will wait before falling back.

- **Reading Evidence Logs:**
  - Verifier scripts append logs to `innomcp-node/evidence/`.
  - Look for filenames like `minimal-ci-YYYYMMDD-HHMMSS.summary.log` and `phase74-general-YYYYMMDD-HHMMSS.log`.
  - The final line of these logs will explicitly state `RESULT: PASS` or print the error that caused the halt.

## 4. Phase 8.5: Weather Resilience Patch (Late Handlers & Resolver)

**What Improved:**

- **Cancel Accounting Fix:** Resolved the "late completion huge duration" symptom by ensuring aborted requests drop out of the event pool immediately.
- **Bangkok/Province Resolver Fix:** Canonicalized "กทม" to "กรุงเทพมหานคร" securely to prevent mismatched TMD searches, keeping the diff minimal.

**Known Risks:**

- Strict `abort` destruction might cause frontend UI loaders to fail abruptly without showing an error boundary if not caught correctly on the client side.

**Rerun Command & Evidence:**

- **Command:** `cd innomcp-node; $env:TS_NODE_CACHE='false'; npx ts-node scripts/verify_phase85_weather_accuracy_cancel.ts`
- **Evidence File:** `innomcp-node/evidence/phase85-20260225-204252.log`

---

## 5. Phase 8.7: Merge Hygiene (docs-only)

**Operator Notes:**

- **Finalize-once guard:** Prevent double completion logs on abort/close in MCP requests.
- **Bangkok resolver normalization:** Improved extraction logic for Bangkok districts (e.g., หลักสี่/ลาดกระบัง).

**Rerun Command & Evidence:**

- **Command:** `cd innomcp-node; $env:TS_NODE_CACHE='false'; npx ts-node scripts/verify_phase87_weather_resolver_loghygiene.ts`
- **Evidence File:** `innomcp-node/evidence/phase87-weather-resolver-loghygiene-2026-02-26T02-51-32-940Z.log`

---

## 6. DB Ports (3306/3308) — Why and How

To ensure zero port conflicts between host-installed services and Docker, the database uses a dual-port mapping strategy:

- **Inside Docker (`innomcp-*/docker-compose.yml`)**: All internal container traffic connects via the standard `3306` port (e.g., `mariadb:3306`).
- **Host Development**: The container binds to the host machine as port `3308` (`"3308:3306"`). Local CLI scripts or IDE database tools must connect using `localhost:3308`.

This prevents non-deterministic dev behavior when a locally installed MySQL/MariaDB daemon is already running on `3306` or `3307`.

---

## 7. Final Verdict

**VERDICT:** **READY_RELEASE**
_All major quality, speed, and hygiene metrics from Phase 7.3 through 7.6 and up to Phase 8.7 have passed successfully without regression._

---

## 8. Phase 8.9: Weather UX & Station Accuracy — Operator Notes

**Cache Behavior:**

- District station data is aggressively isolated per target. If target A fails inside `WeatherPipeline.ts`, it does not poison the batch or disable target B from hitting the API.

**Station Fallback Behavior:**

- Inputs mapped to BKK districts (`หลักสี่`, `ลาดกระบัง`) will strictly ping TMD for those nodes before falling back to the `Bangkok` centroid.
- A missing province explicitly yields `ERR:WX_PROVINCE_MISSING` and averts wasteful NWP cascading.

**Tokens (Operator Friendly):**

- `ERR:WX_TIMEOUT` = 3H/NWP upstream timed out.
- `ERR:WX_UPSTREAM` = TMD returned a non-200 connection fault.
- `ERR:WX_NO_DATA` = The province was queried, but TMD returned empty bins/no forecasts.
- `ERR:WX_PROVINCE_MISSING` = Geo engine failed to detect a valid district/province.

**Verifier Reruns:**

- Validations exist in `verify_phase89_weather.ts`. Run it via:
  ```powershell
  cd innomcp-node; $env:TS_NODE_CACHE='false'; npx ts-node scripts/verify_phase89_weather.ts
  ```

---

## 9. Phase 8.10A/B: Weather & Router Resilience

**8.10A Weather Reliability (Station cache + key-safe logs)**

- **Feature:** Introduced 3-Hour Station Metadata caching. Logs will explicitly emit `[WeatherCache] HIT` or `[WeatherCache] SET`.
- **Hygiene/Security:** Imposed strict log sanitization to prevent `uid=` and `ukey=` from showing up in console or evidence trace files, without malforming the outgoing HTTP URL.
- **Fail-Safe:** Station or Upstream timeouts default to the standard 2-block/5-field response populated with `ERR:WX_TIMEOUT`, preventing UX bloat or crashing.

**8.10B Router Resilience (DB snapshot fallback)**

- **Feature:** If the main Keyword database connection is offline, the router intercepts the failure gracefully (within 100ms) and uses a cached snapshot.
- **Observability:** `keywordSource` (`"db"`, `"snapshot"`, or `"defaults"`) is explicitly tagged to help operators debug live environments.
- **Circuit Breaker:** Spammability is fixed. Recovering connections are paced (e.g., retried once every 60s max) so high throughput general chatter is not slowed down waiting for DB timeouts.

**How to confirm quickly (Smoke Verification):**

```powershell
# Weather Logs check (should be zero hits):
grep -r "uid=" innomcp-node/evidence/

# Router circuit breaker mock (if simulated offline):
# Check for keywordSource in output
```

---

## 10. Final Verdict

**VERDICT:** **READY_RELEASE**
_All major quality, speed, and hygiene metrics from Phase 7.3 through 8.10B have passed successfully without regression._

---

## 11. Phase 9.3 - 10.x Roadmap & Operator Addendum

**Roadmap:**

- **Phase 9.3 (DetectDB Real):** Migrate from seeded data to real DB queries. Enforce `meta.dataSource="detectdb"`.
- **Phase 10.1 (Weather Fusion):** Combine weather data from multiple upstream endpoints intelligently into a single concise UI component.

**Known Issues (Ops Alerts):**

- **DB Permission:** Real Database connections require explicit privileges setup per user. Ensure `MARIADB_USER` has localized grant permissions.
- **Origin Unreachable:** If GitHub remote is blocked, utilize local `.bundle` generation (`git bundle create`) to hand off release candidates.
- **Port Collisions:** Windows environments may hang Node/Playwright. Explicitly clean ports `3000, 3011, 3012, 3308` before deep smoke testing.

**Operator Notes (Fast Verification):**

- Use `$env:SMOKE_MODE="true"` to bypass slow external APIs and fast-fail UI logic.
- Use `$env:FIXTURE="true"` (or equivalents) to mock database rows and ensure deterministic tests.
- Verify quickly utilizing `run_rc_gate.ps1` for backend layers and `run_ui_smoke_evidence_dashboard.ps1` for frontend UI without relying on heavy UI clicks.
