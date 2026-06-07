# Phase 7.5: Release Candidate Gate (RC)

## Target

- **Commit Hash:** `e78845c187b60c6b3db1bb919d8654568ab75945`
- **Target Branch:** `origin/main`

## Commands to Rerun All Gates

If any verifier fails, or if a new commit is pushed, run the following commands sequentially to re-certify the Release Candidate:

1. **Minimal CI Build & Core Verifiers:**
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run_minimal_ci.ps1
   ```
2. **Phase 7.3 Quality Repro (GEO, Weather, Evidence):**
   ```bash
   cd innomcp-node && npx ts-node scripts/verify_phase73_repro_3cases.ts
   ```
3. **Phase 7.4 General Intelligence (25 Cases):**
   ```bash
   cd innomcp-node && npx ts-node scripts/verify_phase74_general_25cases.ts
   ```

## PASS Criteria & Verification Results

- [x] **Minimal CI (`run_minimal_ci.ps1`)**: Completed with `ExitCode 0`. (Evidence: `minimal-ci-20260222-222137.summary.log` -> PASS)
- [x] **Phase 7.3 Repro (`verify_phase73_repro_3cases.ts`)**: Completed 3/3 queries correctly (GEO formatting, WX test mode removed, EVI missing-creds fallback handled). (Evidence: `phase73-20260222-222247.log` -> PASS)
- [x] **Phase 7.4 General (`verify_phase74_general_25cases.ts`)**: Completed 25/25 queries correctly, respecting negative signals and timeout fallback. (Evidence: `phase74-general-20260222-234046.log` -> PASS, 25/25)
- [x] **CROSS Security Scan**: Checked for "test mode", "test_mode", and "โหมดทดสอบ". No remnants leak into production paths. Evaluated code for environment variable secrecy in errors; confirmed no leakage. Confirmed `CHAT_TRACE_QA=1` yields expected format.

## Known Limitations

- The GUI E2E tests are still prone to hanging and require manual `taskkill` sweeps (this is a local environment issue, not a production payload issue).
- Running tests too quickly back-to-back may hit port binding limits or rate limits (HTTP 429), requiring `x-smoke-run` headers to bypass.

## Gate Execution Verdict

- **Verdict:** **PASS_RC**
