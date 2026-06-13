<!-- cc-team deliverable
 group: G1 (archmap division)
 member: ARC-015 role=learn model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1837,"completion_tokens":308,"total_tokens":2145,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 10s
 generated: 2026-06-13T11:59:29.368Z -->
**Responsibility:** Append-only JSONL audit trail of security-relevant events (login, message_sent, file_access, data_export, etc.) with daily file rotation under `./logs/`.

**Exported API:** `auditLogger` singleton with `log(entry)`, `getEntries(filter)`, `exportCSV()`, `exportJSON()`, `clear(beforeTimestamp?)`, and `setAuthorizer(fn)`. Types: `AuditAction`, `AuditEntry`, `AuditFilter`.

**Pipeline role:** Cross-cutting observability — called from auth flows, message dispatch, provider switches, admin/export handlers. Sits *beside* the chat/agent core, not inside it.

**Dependencies:** `fs`, `path`, `crypto.randomUUID`; writes to filesystem under `process.cwd()`. No DB, no network, no other module imports.

**Surprising coupling:**
- **Global state via `process.cwd()`** — rotation breaks if cwd changes between calls.
- **In-memory `lastDate` cache** — race-prone; concurrent writers could clobber/rename each other's active file.
- **`setAuthorizer` is defined but never invoked** in this file — the authorization gate is dead code, suggesting an unwired RBAC hook.
- **Synchronous I/O** on the request path (`appendFileSync`) — couples audit cost directly to caller latency.
- **Read-modify-write in `clear()`** — not concurrency-safe, and silently discards `removedCount` per-file semantics.
