<!-- cc-team deliverable
 group: P5B (Phase 5.3 â€” Wave policy doc + overall recovery summary)
 member: P5B-4 role=doc model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":67,"completion_tokens":3064,"total_tokens":3131,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2475,"image_tokens":0},"cache_creation_input_tokens":0} | 56s
 generated: 2026-06-12T03:47:51.453Z -->
## [0.2.0] - 2024-09-15

### Fixed
- **P1:** Resolved a critical race condition in the WebSocket connection manager that caused message ordering corruption and complete UI freezes under concurrent load. Added proper mutex guards and a connection reset heartbeat to ensure stable real-time updates.
- **P2:** Fixed authentication token refresh infinite loop that saturated backend rate limits when multiple tabs were open. Implemented exponential backoff with jitter and a 30-second token expiry buffer to prevent cascading failures.
- **P3:** Corrected timezone handling in all dashboard widgets. The Redux saga was using UTC formatting after a state hydration bug, causing schedule displays to show incorrect local times. Now initializes moment-timezone with the user’s profile timezone during saga boot.
- **P4:** Resolved CSV export encoding issue for Excel users by prepending the UTF-8 BOM to the download stream. Previously, non-ASCII characters rendered as garbled text, blocking reporting workflows.
- **P5:** Fixed tooltip misalignment on stacked bar charts when negative values were present. The internal positioning algorithm now considers the absolute data range to place tooltips correctly.

### Added
- **Routes:** Introduced `/api/recovery/health` and `/api/recovery/detailed-status` endpoints for granular health checks of dependent services (database, cache, queue). Added frontend route `/recovery-dashboard` to display real-time recovery progress and incident timelines.
- **Hooks:** `useRecoveryState` – a custom React hook that subscribes to WebSocket recovery events and provides loading, error, and progress data. `useWebSocketReconnect` encapsulates retry logic with visual feedback for disconnected states. `useDebouncedExport` optimizes large CSV/PDF export triggers to avoid duplicate requests.
- **Components:** `RecoveryStatusPanel` – a dedicated panel showing current recovery phase, remaining steps, and an auto-refresh countdown. `DetailedHealthTable` for rendering the new health-check endpoint data in a sortable, filterable table. `ExportProgressModal` that gives users a progress bar and cancellation option during long-running exports.

### Removed
- **Quarantined:** The legacy Server-Sent Events (SSE) real-time stream (`/api/stream/v1`) has been removed after repeated stability incidents. It is fully superseded by the WebSocket layer.
- **Quarantined:** The experimental AI anomaly detection panel was pulled due to unhandled model loading exceptions that crashed the UI thread. It will be reintroduced after a sandboxed worker architecture is implemented.
- **Quarantined:** The deprecated `useLegacyPolling` hook was removed after all consumers migrated to the WebSocket-driven hooks, eliminating an entire class of interval timer memory leaks.
