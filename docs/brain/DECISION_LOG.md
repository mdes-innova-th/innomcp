# Phase C Decision Log

> Append-only record of design decisions. Each entry: date, decision, alternatives considered, rationale.

---

## 2026-05-03 — Recovery branch named `phase-c-living-agent-chat-opus-recovery`

**Decision:** Rebuild Phase C on a new branch off `1654370` (clean baseline) rather than reusing the empty `phase-c-living-agent-chat` branch.

**Alternatives considered:**
- (a) Force-push the empty `phase-c-living-agent-chat` branch with new work — rejected: would silently overwrite the original branch name that Codex's log referenced, breaking traceability.
- (b) Reset `phase-c-living-agent-chat` to a known good baseline — rejected: same traceability concern.
- (c) Wait until Codex's branch is found — rejected: PowerShell + WSL + git reflog + remote `not our ref` errors all confirm the work is unreachable from this machine.

**Rationale:** A new differently-named branch makes the recovery transparent. The dead Codex alias remains a known dead alias.

---

## 2026-05-03 — Innova-bot mother coordinator: partial probe only

**Decision:** Record Innova-bot integration as a **future-work blocker**, proceed with local evidence only.

**Findings:**
- `localhost:7010` is listening (PID 14524), MCP SSE transport (`/sse` returns 200, `/messages` returns 307)
- Tool list could not be fetched via plain curl (requires SSE handshake + sessionId on `/messages`)
- The standard mother tools `what_should_i_do_next`, `update_project_state`, `transmit_telepathy` are NOT in the local `innomcp-server-node` MCP registry and only get referenced from `TODO.md` historically
- A proper MCP SSE client would unlock these but is out of scope for this recovery turn

**Rationale:** Per the recovery brief, "If Innova-bot MCP is unavailable, record blocker and proceed with local evidence." The Phase C work doesn't depend on Innova-bot at runtime — it depends on the local agent contract + provider broker being correct.

**Blocker filed:** `Innova-bot MCP SSE handshake not implemented in this session; mother orchestration tools unverified.`

---

## 2026-05-03 — Stream transport: SSE (not WebSocket)

**Decision:** Use Server-Sent Events for the multi-agent workstream + draft delta.

**Alternatives considered:**
- WebSocket — already used elsewhere in the project (`ws://localhost:3011/chat`). Bidirectional, but overkill for one-way streaming.
- Long-poll — rejected, poor UX.
- HTTP/2 streaming with `application/x-ndjson` — viable but less common; SSE is well-supported and trivially testable.

**Rationale:** SSE is one-way (server → client), which matches the workstream + draft-delta model exactly. It works with `EventSource` in the browser, has automatic reconnect, and is trivial to log/inspect. The chat client only needs to **read** events and POST a new request to start a new run.

---

## 2026-05-03 — Public-safe schema validator approach

**Decision:** Implement public-safe checking as a **pre-write substring scan** on the serialized JSON of every `AgentEvent`, blocking emission if any forbidden key name is found.

**Alternatives considered:**
- TypeScript type-only safety — rejected: types can be bypassed at runtime (e.g., dynamic property assignment).
- Zod schema validation per-event — would catch shape but not necessarily new key names. Will use it in addition.
- AJV deep-walk with deny-list — equivalent to substring scan but heavier.

**Rationale:** A simple `JSON.stringify(event).includes('chainOfThought')` style check is bulletproof against accidental field leaks via spread operators or untyped JS interop. Combined with Zod for shape validation. Fast, easy to test.

---

## 2026-05-03 — `phase-c-living-agent-chat` branch (empty, no Codex work)

**Decision:** Leave `phase-c-living-agent-chat` and `origin/phase-c-living-agent-chat` alone. Do not delete, do not rename, do not force-push.

**Rationale:** The user's recovery brief explicitly said "Do not delete or overwrite anything." The branch points to `1654370` (just the baseline) — keeping it doesn't cost anything and preserves the history of the failed handoff.

---

## 2026-05-03 — Build Phase C alongside existing chat, not replacing it

**Decision:** Add `/api/chat/stream` as a NEW endpoint. Leave `/api/chat` (current websocket-driven flow) untouched until E2E proves the streaming path is robust.

**Alternatives considered:**
- Replace `/api/chat` with the streaming version directly — rejected: high regression risk on the gates we just proved green at 59/59 + 61/61.

**Rationale:** Two endpoints is acceptable for now. The signoff suite continues to exercise the existing path, while `living-agent-chat.spec.ts` exercises the new path. Once the new path is stable, a future ADR can deprecate the old.

---

## 2026-05-03 — Provider registry: in-memory + DB-backed (additive)

**Decision:** Provider registry lives in a typed in-memory map at boot, hydrated from a new `ai_provider` table in MariaDB on first read. CRUD endpoints write through to DB.

**Alternatives considered:**
- Pure-config (hardcoded JSON) — rejected: user must be able to add providers at runtime.
- Pure-DB on every read — works but adds latency to every chat turn. Cache + invalidate is fine.

**Rationale:** Boot-time hydration + write-through is the simplest pattern. Migration for `ai_provider` table is part of C-2.
