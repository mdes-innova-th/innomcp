# Phase 7.5: Release Candidate Gate (RC)

**Source-of-Truth:** This document is the canonical spec for RC Gate reruns.

## Target

- **Commit Hash:** `f09ff83` (latest on `origin/main` at time of audit)
- **Target Branch:** `origin/main`
- **RC Verdict:** **PASS_RC**

## 1. Commands to Rerun All Gates

If you need to re-certify the Release Candidate, run these exactly:

Recommended (reproducible wrapper; runs A+B+C and prints PASS/BLOCKED):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run_rc_gate.ps1
```

**A) Minimal CI Build & Core Verifiers**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run_minimal_ci.ps1
```

**B) Phase 7.3 Repro (GEO, Weather, Evidence)**

```bash
cd innomcp-node && npx ts-node scripts/verify_phase73_repro_3cases.ts
```

Note: This verifier is serverless; it boots the app on an ephemeral port and does NOT require you to start the backend on 3011.

**C) Phase 7.4 General Intelligence (25 Cases)**

```bash
cd innomcp-node && npx ts-node scripts/verify_phase74_general_25cases.ts
```

Note: This verifier is serverless; it boots the app on an ephemeral port and does NOT require you to start the backend on 3011.

## 2. Required Environment Variables

To ensure verifiers run correctly and deterministically:

- `SMOKE_MODE=1`: Forces deterministic fallbacks (disables variable timeouts/LLM responses).
- `CHAT_TRACE_QA=1`: Enables strict Trace v3 logging.
- `LOG_DEBUG=1` (Optional): For verbose pipeline logging during manual review.
- Provide `DETECT_DB_*` credentials to verify Evidence DB fallback success.

## 3. Expected Outputs & Evidence Types

- Minimal CI output will result in `minimal-ci-YYYYMMDD-HHMMSS.summary.log`. Expected: `RESULT: PASS`.
- Phase 7.3 Repro output will result in `phase73-YYYYMMDD-HHMMSS.log`. Expected: `RESULT: PASS` for all 3 cases.
- Phase 7.4 General output will result in `phase74-general-YYYYMMDD-HHMMSS.log`. Expected: `RESULT: PASS` (25/25 correctly routed).

## 4. Criteria

**PASS_RC Criteria:**

- All 3 scripts must exit with `0` (Success).
- Security sweeps confirm NO "test mode" / "โหมดทดสอบ" leakages in response paths.
- Error pathways must NOT leak internal tokens/hashes or `.env` variable names to the user.
- Trace logs generated under `CHAT_TRACE_QA=1` MUST follow Trace v3 format strictly (no raw JSON arrays or PII bloat).

**BLOCKED Criteria:**

- Any of the scripts throw unhandled exceptions or exit `> 0`.
- Any output reveals leaked internal `.env` properties or stack traces in `structuredContent`.
