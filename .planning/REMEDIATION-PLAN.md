# REMEDIATION PLAN — innomcp cc-army hardening

> For the mother-Sonnet orchestrator. Prioritized, deduplicated, clustered.
> Source: TRIAGE-{security,improve,serveraudit,spec,mega-archmap}.md
> Inputs cross-checked against FIX2-APPLIED-* and FIXWAVE-APPLIED-* (what already landed) and spot-verified against live source.
> Generated 2026-06-13. provider=0 audit consolidation.

---

## 0. How to read this plan

- **CONFIRMED-actionable** = finding survived dedup + (where feasible) source spot-check.
- **Already-landed** items from `FIX2-APPLIED-*` are explicitly excluded from the top-25 to avoid rework. See §6.
- **Likely false-positive / truncation artifact** items are quarantined in §7 — do NOT spend effort there without re-reading full source first.
- Effort: **S** ≤ 30 min / 1 file · **M** ~ half-day / few files · **L** multi-day / cross-cutting.
- Severity reflects **real risk = impact × exploitability/likelihood**, not the raw auditor label.

A note on input quality: the CommandCode workers audited **truncated** source (visible in trailing `…` and "truncated" notes). Several HIGH claims are artifacts of not seeing the whole file. One was proven false during this pass (see §7, FP-1). Treat single-model HIGH claims on truncated files as *hypotheses to verify*, not facts.

---

## 1. Executive systemic risks (the 5 that matter)

1. **SSRF + credential exfiltration via unvalidated `baseUrl`/endpoint** — same bug class in ≥7 modules (providerHealthProbe, providerManager, providerAdapter, modelLoadBalancer, webhookService, systemInventory, imageGenService). User/env-controlled URLs flow straight into `fetch`, several with `Authorization: Bearer <key>` attached. A working SSRF guard already exists in `services/webFetchTool.ts` — promote it to a shared util and gate every outbound fetch through it. **Single highest-leverage fix.**
2. **Missing authorization / IDOR across every stateful service** — artifactService, auditLogger, sessionStore, sessionMemory, memoryRagHook, notificationService, webhookService, motherExportService, toolExecutor, wsEnhancer all key off a caller-supplied `sessionId`/`taskId`/`clientId` with zero ownership check. Same class, ~10 modules. Fix at the middleware/identity boundary, not per-method.
3. **No outbound sanitization of secrets & external content** — error bodies (provider 4xx, health checks, gateway) and tool results are emitted to clients/logs/LLM verbatim. Two sub-classes: (a) **secret leakage** in error strings (agentLoop, providerAdapter, healthAggregator, imageGenService), (b) **prompt injection** from untrusted tool/memory content fed into LLM context (hotRetriever, sessionMemory, thaiGovtTools, thaiIntentRouter).
4. **Unbounded resource consumption (DoS) — no limits anywhere** — in-memory Maps with no eviction/TTL (contextManager, sessionMemory, wsEnhancer), full-file reads before size check (audioTranscribeTool, dataAnalysisTool), `fetch` without timeout in ~12 server-node tools, ReDoS-prone regexes on raw user input (retrievalOrchestrator, fastPathHandler).
5. **Silent failure / fail-open logic** — broken circuit-breaker cooldown (providerFailover), race conditions on lazy-init and unloaded stores (orchestrator, pipeline, vectorStore, dbDetect), swallowed errors masking outages (vectorStore.save, thaiLawTool, keywordTool missing `isError`), and `||`-vs-`??` defaults that discard legitimate `0`/`""` values. Erodes trust in every answer.

---

## 2. Theme clusters (dedup map)

| Cluster | Finding IDs (cross-file) | Modules | Leverage |
|---|---|---|---|
| **SSRF / endpoint validation** | SEC08, SEC12, SEC14, SEC17, SEC19, SEC20, SEC25, SEC29, ARC-009 | providerHealthProbe, providerManager, providerAdapter, modelLoadBalancer, webhookService, systemInventory, imageGenService, fastPathHandler | ★★★★★ |
| **AuthZ / IDOR** | SEC03, SEC04, SEC13, SEC15, SEC16, SEC23, SEC24, SEC28, SEC29, SEC30 | artifactService, auditLogger, memoryRagHook, motherExportService, notificationService, sessionMemory, sessionStore, toolExecutor, webhookService, wsEnhancer | ★★★★★ |
| **Path traversal** | SEC03, SEC06, SEC07, SEC08, SEC24, SV010 | artifactService, coldRetriever, dataAnalysisTool, fastPathHandler, sessionStore, audioTranscribeTool | ★★★★ |
| **Secret leakage in errors/logs** | SEC01, SEC10, SEC12, SEC17, SEC18 | agentLoop, healthAggregator, imageGenService, providerAdapter, providerFailover | ★★★★ |
| **Prompt injection (untrusted→LLM)** | SEC11, SEC23, SEC26, SEC27 | hotRetriever, sessionMemory, thaiGovtTools, thaiIntentRouter | ★★★ |
| **Resource/DoS (unbounded mem, no timeout, ReDoS)** | SEC21, SEC23, SEC30, AUD-20, SV010, SV012, many SV0xx fetch-no-timeout | contextManager, sessionMemory, wsEnhancer, audioTranscribeTool, dataAnalysisTool, ~12 server tools | ★★★★ |
| **Races / fail-open / lazy-init** | AUD-03, AUD-04, AUD-12, SV003, SV039, SV044 | orchestrator, motherDispatch, providerFailover, pipeline, vectorStore, dbDetect | ★★★ |
| **Error-handling / silent swallow** | AUD-01, AUD-06, SV009, SV020, SV030, SV032, SV039, SV045 | conductor, eventGuard, archiveTool, keywordTool, thaiHistoryTool, thaiLawTool, vectorStore, mcpLogger | ★★★ |
| **Type-safety (z.custom no-validate, bad schema)** | SV006, SV007, SV013, SV015 | law.ts, religion.ts, dateTimeTool, echartsTool | ★★ |
| **CSV / SVG / XSS injection** | SEC04, SEC07, SEC15, SEC25, AUD-09 | auditLogger, dataAnalysisTool, motherExportService, systemInventory, responseFormatter | ★★ |
| **`||` vs `??` (drops 0/"" )** | AUD-14, SV017, SV025 | fastPathHandler, fileReaderTool, nwpHourlyTool | ★★ |
| **Non-functional / dead / incomplete** | SV019, SV024, SV035, SV041, ARC-029 | imageGeneratorTool, nwpDailyTool, weatherTool, registerExtraTools, mcpClient | ★★★ (correctness) |
| **Route-layer test coverage gap** | S042–S084 (spec) | routes/api/* | ★★ (deliverable: tests, not fixes) |

---

## 3. TOP 25 — ranked by real-risk × ease-of-fix

| # | Sev | File : location | Issue (1 line) | Concrete fix (1 line) | Eff |
|---|-----|-----------------|----------------|------------------------|-----|
| 1 | CRIT | services/providerHealthProbe.ts : `buildProbeTargets()`/probe | env `*_BASE_URL` → fetch w/ `Authorization: Bearer <key>` = SSRF + key exfil on startup | Route through new shared `assertSafeUrl()`; block private/link-local + metadata IPs | M |
| 2 | CRIT | services/providerManager.ts : `checkHealth()` | `new URL('/health', provider.baseUrl)` + Bearer key → SSRF/cred leak | Same `assertSafeUrl()` guard before fetch; omit Authorization for user-supplied hosts | S |
| 3 | CRIT | services/webhookService.ts : `fireWebhook()`, `listWebhooks()`/`getWebhook()` | SSRF on arbitrary webhook URL **and** returns `secret` field to callers | `assertSafeUrl()` on url; strip `secret` from all read responses | M |
| 4 | HIGH | services/providerAdapter.ts : call/stream OpenAI+Anthropic | fetch on unvalidated `provider.baseUrl`; raw `errorText` (may hold `sk-…`) surfaced | `assertSafeUrl()` + redact key patterns from error bodies before throw/emit | M |
| 5 | HIGH | services/modelLoadBalancer.ts : `addModel()`→`probeModel()` | user-supplied `endpoint` probed unvalidated → SSRF | Validate endpoint via `assertSafeUrl()` at `addModel()` time | S |
| 6 | HIGH | services/systemInventory.ts : `fetchMcpServerTools`/`fetchCommandCodeModels` | `options.mcpServerUrl`/`commandCodeBaseUrl` → fetch unvalidated → SSRF | `assertSafeUrl()` allowlist before fetch; generic error string | S |
| 7 | HIGH | services/sessionStore.ts : `save/load/delete` | `session.id` interpolated into file path → path traversal (write/read/delete anywhere) | Whitelist id `[A-Za-z0-9_-]+`; resolve + assert `startsWith(SESSIONS_DIR)` | S |
| 8 | HIGH | services/artifactService.ts : `getArtifact/listArtifacts` | no authz (IDOR) + `taskId`/`name` may build FS path → traversal | Reject `..`/sep in name; verify caller owns `taskId` | M |
| 9 | HIGH | services/wsEnhancer.ts : `registerClient`/`joinRoom` | any client claims any `clientId`; joins any room (incl. private) | Require signed token per clientId; enforce room ACL before join | M |
| 10 | HIGH | server-node/utils/db.ts : module global | no `pool.end()`/shutdown → leaked handles; `Number(undefined)`→NaN port | Add `closePool()` on SIGTERM/SIGINT; validate DB_* env w/ defaults | S |
| 11 | HIGH | server-node/utils/dbDetect.ts : `getPoolDetect()` | unguarded lazy init → concurrent calls create duplicate pools (conn exhaustion) | Promise-memoized singleton (`poolDetectPromise ??= …`) | S |
| 12 | HIGH | server-node/memory/vectorStore.ts : `save()`/`load()`+`add()` | save errors swallowed (silent data loss); load races add() and overwrites items | Rethrow save errors; gate searches on a ready flag; load once before serve | M |
| 13 | HIGH | server-node/utils/mcpLogger.ts : `mcpLog()` + top-level mkdir | `JSON.stringify` on circular data and `mkdirSync` at import can crash process | try/catch around stringify (fallback `String`) and mkdir; warn-and-continue | S |
| 14 | HIGH | server-node/mcp/tools/audioTranscribeTool.ts : `loadAudioBytes` | full file/base64 read before size check (DoS) + path traversal on `audioPath` | `fs.stat` size-gate before read; confine path under WORKSPACE_ROOT via realpath | M |
| 15 | HIGH | services/agentLoop.ts : catch blocks | raw tool/JSON-parse errors (may carry secrets) emitted + stored in history → fed to LLM | Replace with generic message; never echo raw args string *(note: FIX2 landed 3 edits here — verify scope)* | S |
| 16 | HIGH | services/healthAggregator.ts : `runCheckerWithTimeout` catch | echoes raw checker error (DB creds/paths) in public health response | Log full error server-side; return generic Thai failure string | S |
| 17 | HIGH | services/hotRetriever.ts : `composeFactSummary`/normalizers | untrusted tool data concatenated into LLM context → prompt injection | Wrap tool data in explicit delimited/XML block; strip `###`/`User:`/`Assistant:` markers | M |
| 18 | HIGH | services/retrievalOrchestrator.ts : `planRetrieval` regexes | greedy `.*` alternations on raw query → ReDoS (event-loop stall) | Enforce input length cap (≤500) before match; replace `.*` patterns w/ `includes`/token scan | M |
| 19 | HIGH | agents/orchestrator.ts : `executeCycle` | concurrent same-`taskId` calls interleave-mutate task (status/results corruption) | Per-task lock: reject if status≠pending, or sequential promise chain keyed by taskId | M |
| 20 | HIGH | services/providerFailover.ts : `checkProvider` + `selectProvider`/`getStats` | cooldown only skipped when healthy (breaker fails open); custom primary/backup IDs → TypeError crash | `if(!shouldAttemptCheck) return status.healthy;`; store ctor IDs as instance fields *(FIXWAVE: needs-manual)* | M |
| 21 | HIGH | server-node/mcp/tools/weatherTool.ts : module | zero `export`s + no `hourly` handler → tool non-functional / registration fails | Export all handlers; add `fetchHourlyForecast` + type dispatcher | M |
| 22 | HIGH | server-node/mcp/tools/nwpDailyTool.ts : `execute` | builds params then returns nothing; 2 declared tools unimplemented → silent failure | Complete axios call w/ `DEFAULT_TIMEOUT`; implement or stop exporting missing tools | M |
| 23 | HIGH | server-node/mcp/tools/imageGeneratorTool.ts : `drawChart`/`createCanvas` | truncated/incomplete `drawChart` (crash) + unbounded canvas size (mem DoS) + double-draw | Complete fn; `z.number().int().min(1).max(8000)` on w/h; remove duplicate draw calls | M |
| 24 | HIGH | server-node/tools/registerExtraTools.ts : body | no-op stub (all registrations commented) → extra tools silently absent | Uncomment/implement registrations or throw explicit "missing modules" error | S |
| 25 | HIGH | server-node/mcp/tools/thaiHistoryTool.ts : `InMemoryHistoryDb`/`safeJsonParse` | returns shared mutable refs → cross-request data corruption | `structuredClone()` stored entities + returned results | S |

**Runner-ups (HIGH/MED, do in same sweep, low marginal cost):**
SV009/SV022/SV023/SV034/SV035/SV036/SV018 (add `AbortSignal.timeout()` to every tool `fetch` — batch S);
SV020 (keywordTool: add `isError:true` — S);
SEC04/SEC15 (CSV formula-injection: prefix `=+-@` cells — S);
SEC07/SEC25 (SVG/desc XSS: HTML-escape interpolated strings — S);
AUD-12 SSRF-adjacent + SEC23 sessionMemory authz/size-cap (M);
AUD-20 contextManager memory leak + naive token count (M);
SV013 dateTimeTool broken Zod schema + Thai time (S).

---

## 4. Suggested execution waves (for the orchestrator)

- **Wave A (cross-cutting, do first):** Create `src/utils/safeFetch.ts` exporting `assertSafeUrl(url)` + `safeFetch()` by **lifting the existing SSRF guard from `services/webFetchTool.ts`** (already blocks private/loopback/link-local). Then sweep items #1–6, runner-up timeouts. One util kills the #1 systemic risk across 7 modules.
- **Wave B (authz boundary):** Introduce a caller-identity/ownership check (middleware + a `requireOwnership(principal, resourceKey)` helper). Apply to #3,#7,#8,#9 and SEC04/13/15/16/23/28. Avoid per-method copy-paste.
- **Wave C (resilience):** DB/pool lifecycle, races, breaker (#10,#11,#12,#19,#20), fetch timeouts.
- **Wave D (correctness/dead code):** #21,#22,#23,#24,#25 + type-safety + `||`→`??`.
- **Wave E (output hygiene):** secret redaction + prompt-injection delimiters + CSV/SVG escaping (#15,#16,#17, runner-ups).
- **Deliverable wave (parallel):** TRIAGE-spec S042–S084 are **generated contract tests for the route layer** (currently untested) — land them as the regression net once Waves A/B touch those routes.

---

## 5. Systemic patterns (highest leverage — fix the class, not the instance)

1. **One `safeFetch` util** retrofitted everywhere ⇒ closes SSRF (cluster ★★★★★) AND adds the missing timeouts (cluster ★★★★) in one motion. ~12+ call sites.
2. **One ownership/identity gate at the boundary** ⇒ closes IDOR across ~10 services without editing 10 method signatures inconsistently.
3. **One error-redaction helper** (`redactSecrets(msg)` matching `sk-…`, bearer tokens, internal URLs) wrapped at the emit/log boundary ⇒ closes secret-leak cluster.
4. **`z.custom<T>()` with no validator** appears in law.ts, religion.ts (and likely peers) — grep the whole `types/` tree for `z.custom<` and replace each with a real Zod object schema; it silently disables runtime validation everywhere it appears.
5. **Global singletons + module-load env reads** (mega-archmap: analyticsService, cacheManager, eventBus, registry, contextManager, sessionMemory) — shared mutable state is the root of the race/leak/test-isolation findings. Not a quick fix, but the architectural note for the next refactor: prefer DI + per-request state.
6. **`fetch(...)` with no timeout** is the single most repeated tool defect in server-node (SV009/010/018/022/023/034/035/036…) — fold into the `safeFetch` util default.

---

## 6. Already landed (exclude from new work — verify, don't redo)

Per `FIX2-APPLIED-fix2-security.md` (branch cc-army-2026-06-13), these **landed green**: agentLoop.ts, auditLogger.ts (1 of several), imageGenService.ts, notificationService.ts, retrievalOrchestrator.ts, wsEnhancer.ts.
Per `FIX2-APPLIED-fix2-improve.md`: motherDispatch.ts, intentClassifier.ts, responseComposer.ts, providerManager.ts (partial), fastPathHandler.ts, answerContract.ts, contextManager.ts.

**Caution — partial fixes:** auditLogger (5 edits skipped), providerManager (2 skipped), fastPathHandler (4 skipped) landed only *some* edits — the SSRF/authz cores for these may still be open. **Re-read these files before assuming the top-25 item is done.**
**Reverted (tsc red) — still open, need careful re-fix:** artifactService, fastPathHandler (security set), hotRetriever, responseFormatter.
**no-exact-match (auditor patch was stale) — still open:** coldRetriever, healthAggregator, memoryRagHook, modelLoadBalancer, motherExportService, sessionMemory, sessionStore, systemInventory, thaiGovtTools, thaiIntentRouter, toolExecutor, webhookService, riskDetector, generalGate, toolDispatch, eventGuard, providerFailover. These need fresh, source-accurate edits (most are in the top-25).

---

## 7. Likely false-positives / truncation artifacts (quarantine — verify before acting)

- **FP-1 (CONFIRMED FALSE):** AUD-05 HIGH "`extractThaiProvince` not defined → ReferenceError" in toolDispatch.ts. **Verified false** — it is a hoisted `function extractThaiProvince` at line 271 of the same module. Auditor saw a truncated head. The MED calculator-arg point in AUD-05 may still hold.
- **FP-2 (suspect):** AUD-08, AUD-13, AUD-18 are raw chain-of-thought dumps ("Let me analyze…"), not finalized tables — the model never produced a verdict row. Mine them only if the underlying file (responseComposer/providerManager/generalGate) shows the described code on re-read; otherwise discard.
- **FP-3 (suspect):** Several SV findings end mid-sentence on "(truncated)" files (SV001, SV015 fallback, SV025, SV035 forEach-empty-map, imageGeneratorTool incompleteness). The *incompleteness* claims (SV019/SV024/SV035) are plausible but MUST be confirmed by reading the full file — a worker that only saw 200 lines cannot know a function is unclosed.
- **FP-4 (low value):** ARC-* (mega-archmap) are `/learn` architecture notes, **not defects** — no remediation rows. Use only as context for §5 systemic patterns (singletons, env coupling, hardcoded Thai locale).
- **FP-5 (speculative authz):** Many IDOR findings (SEC13/16/23/24/30) assume the service is "exposed over a network API without authz." Real risk depends on whether the route layer already authenticates. Confirm against `routes/api/*` (the spec tests cover these) before rating CRITICAL — the *defense-in-depth* fix is still worthwhile but may be MED not HIGH.
- **Speculative prompt-injection mitigations** (SEC26 thaiGovtTools "strip 'ignore'/'system'") risk over-blocking legitimate Thai content — prefer structural delimiting (XML/JSON boundaries) over keyword blocklists.

---

## 8. Coverage notes

- TRIAGE-spec (80 findings) is **contract-test source code**, not defect findings — it is the regression-net deliverable. It uniquely covers the **`routes/api/*` layer** that no other audit touched; that layer is the place to confirm the §7 FP-5 authz assumptions.
- TRIAGE-mega-archmap (30) is architecture documentation, folded into §5.
- TRIAGE-improve (27) + TRIAGE-security (30) + TRIAGE-serveraudit (43) are the actionable defect corpus; after dedup → ~75 unique actionable issues, top-25 above.
- Two server-node modules and a few improve entries were marked "missing" by the consolidator (SV011, SV028, AUD-19, S049/S064/S074/S079 gaps) — not lost data, just numbering gaps in the worker output.
