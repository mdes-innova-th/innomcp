<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-29 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":84,"completion_tokens":1071,"total_tokens":1155,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":368,"image_tokens":0},"cache_creation_input_tokens":0} | 15s
 generated: 2026-06-12T03:51:54.082Z -->
## [0.2.0] - 2025-01-27

### Fixed

- **Phase 1 (Infrastructure Recovery):** Rebuilt database connection pool after detecting a silent failure in pool provisioning. Restored primary API gateway routes that were incorrectly deregistered during the incident. Rolled back an incomplete migration on the `sessions` table that had left stale constraints.
- **Phase 2 (Authentication & Authorization):** Fixed a token validation bug where expired JWT tokens were incorrectly accepted under high latency. Corrected a permission escalation issue in the role-based access middleware. Re-enabled OAuth2 callback validation that had been bypassed due to a misconfigured environment variable.
- **Phase 3 (Data Integrity):** Reintroduced file system integrity checks on startup—previously the checks were skipped because of a faulty watchdog timer. Repaired corrupted JSON parsing in the configuration loader by adding fallback deserialization and schema validation. Restored missing index entries in the local metadata cache.
- **Phase 4 (Connectivity & State):** Rewrote the WebSocket reconnection logic to use exponential backoff with jitter, preventing reconnection storms. Added heartbeat timeout detection for long‑lived connections and repaired the state machine that tracks connection readiness. Re‑enabled the periodic health probe that had been accidentally silenced.
- **Phase 5 (Observability & Resilience):** Recovered the structured logging subsystem by replacing the corrupted log writer with a new file‑based sink. Re‑implemented error context propagation in the error handling middleware—previously stack traces were lost. Restored the metrics endpoint (`/metrics`) and fixed the Prometheus exposition format to avoid parsing failures.

### Added

- **Routes:** `GET /health` (detailed system health check), `GET /recovery/status` (current phase completion and any pending actions).
- **Hooks:** `useRecoveryState` for front‑end components to display recovery progress; `useSystemHealth` for real‑time health aggregation.
- **Components:** `<RecoveryBanner>` to notify users during ongoing recovery; `<CorruptedFileIndicator>` to flag files that cannot be loaded.
- **Scripts:** `run-safety-check.sh` (pre‑start validation); `quarantine-restore.sh` (restore files from the quarantine directory after review).
- **Documentation:** `RECOVERY_PROCEDURES.md` (step‑by‑step recovery guide) and `SYSTEM_RECOVERY.md` (architecture and rollback strategies).

### Removed

- **Quarantined corrupt files:** Several files that were identified as unrecoverable have been moved to the `quarantine/` directory and removed from the active codebase. These include:
  - `config/database.bak` (malformed connection string)
  - `logs/crash_20250120.dat` (binary corruption)
  - `plugins/old_integration.so` (invalid symbol table)
  - `cache/metadata_v2.db` (irreparable index corruption)
  - `tmp/recovery_snapshot_20250119.bak` (inconsistent checksum)
  - `docs/api/legacy_v1.swagger` (yaml parse error)
  - Two extraneous test fixtures (`test/fixtures/malformed_*.json`) that were created by the incident.
