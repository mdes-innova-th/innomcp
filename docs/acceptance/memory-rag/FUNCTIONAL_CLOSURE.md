# Memory + RAG Functional Closure Report

**Date:** 2026-02-XX  
**Base commit:** `1bd2d91` (Memory+RAG browser acceptance — 8/8 scenarios pass)  
**Closure commit:** `TBD`

## Gap Status

### G1: Cold RAG Prompt Injection ✅ CLOSED

**Problem:** `queryColdRag()` existed and returned formatted text, but was NEVER called from any route handler. Cold RAG text was tracked as metadata only — never injected into LLM prompts.

**Fix:**
1. `answerGeneralWithFastModel()` now accepts optional `ragContext` parameter
2. WS GeneralGate calls `queryColdRag(messageWithFile)` before LLM call and passes `ragContext`
3. HTTP GeneralGate calls `queryColdRag(routingMessage)` before LLM call and passes `ragContext`
4. When RAG context is provided, the system prompt instructs the LLM to use reference data
5. Cold RAG doc count and sources are exposed in `generalGate.coldRagDocs` / `generalGate.coldRagSources`
6. `recordTurnAndGetMeta()` now returns `coldContext` string alongside `coldDocHits`
7. `enrichGroundedContract()` now sets `coldContextInjected: boolean` in metadata

**Files changed:**
- `innomcp-node/src/routes/api/chat.ts`: WS GeneralGate (L4275-4285), HTTP GeneralGate (L6610-6620), `answerGeneralWithFastModel()` signature + prompt composition
- `innomcp-node/src/services/memoryRagHook.ts`: `MemoryRagMeta.coldContext`, `enrichGroundedContract()`

### G2: Session-Aware Routing ✅ CLOSED

**Problem:** When the God-Tier Router returned low confidence or ambiguous results, the system cleared the category and fell through to MCP. Session memory entities (ISP, province, domain) were never consulted for disambiguation.

**Fix:**
1. Added `disambiguateWithSessionMemory()` in `memoryRagHook.ts`
2. Consults session memory snapshot (activeDomain, live entities) when routing is uncertain
3. Three disambiguation cases:
   - ISP follow-up → route to evidence domain
   - Province follow-up → keep active domain (weather/geo/evidence)
   - Generic follow-up → continue with active domain
4. Applied in WS God-Tier Router path (ambiguous + low-confidence)
5. Applied in HTTP God-Tier Router path (low-confidence)
6. Only activates when confidence < 0.8 or `isAmbiguous=true`

**Files changed:**
- `innomcp-node/src/services/memoryRagHook.ts`: `disambiguateWithSessionMemory()`
- `innomcp-node/src/routes/api/chat.ts`: WS router (L4375-4390, L4400-4415), HTTP router (L6095-6108)

### G3: HTTP Session Scope ✅ CLOSED (by design)

**Status:** HTTP stateless calls without session cookies/headers inherently cannot have session memory. This is correct behavior, not a bug.

**Evidence:**
- HTTP path extracts session ID from `cookie.sessionId` or `x-session-id` header
- Memory + RAG hooks are guarded: `if (httpSessionId) { ... }`
- Session-aware disambiguation is also guarded: `httpSessionId ? disambiguateWithSessionMemory(...) : null`
- Frontend WebSocket connections always have session context
- HTTP API callers can opt-in by providing `x-session-id` header

### G5: Factual Edge Hardening ✅ CLOSED (via G1)

**Problem:** LLM answers on definitional/explanatory queries were ungrounded — no corpus text to anchor responses.

**Fix:** Addressed by G1. Queries routed to GeneralGate now get cold RAG corpus text injected into the LLM prompt. The system prompt instructs: "ให้ใช้ข้อมูลอ้างอิงข้างต้นเป็นหลักในการตอบ ห้ามแต่งเติมสิ่งที่ไม่มีในข้อมูล"

Knowledge-type queries that can't be locally resolved by ThaiKnowledgeGate fall through to GeneralGate, which now benefits from cold RAG injection.

## Test Results

| Suite | Count | Pass | Fail |
|-------|-------|------|------|
| innomcp-node unit tests | 121 | 121 | 0 |
| thaiGeoTool | 7 | 7 | 0 |
| thaiKnowledgeTool | 3 | 3 | 0 |
| TypeScript compilation | - | ✅ | - |

## Architecture After Closure

```
Query → FastPath → GeneralGate → [queryColdRag] → answerGeneralWithFastModel(text, budget, ragContext)
                                                      ↓
                    God-Tier Router → [disambiguateWithSessionMemory] → Route selection
                                                      ↓
                    recordTurnAndGetMeta() → coldContext + metadata → enrichGroundedContract()
```

**Data flow (cold RAG):**
1. `queryColdRag(query)` → TF-IDF search → top 3 chunks with `[Title] Content` format
2. Injected as reference context in LLM user prompt
3. System prompt updated to instruct grounded answering
4. Metadata tracks `coldRagDocs`, `coldRagSources`, `coldContextInjected`

**Data flow (session disambiguation):**
1. God-Tier Router returns category + confidence + isAmbiguous
2. If uncertain, `disambiguateWithSessionMemory()` checks:
   - `snapshot.activeDomain` (last turn's domain)
   - `snapshot.entities` (live/recent entities by type)
   - Follow-up patterns (แล้ว, ถ้า, งั้น, etc.)
3. Returns disambiguated category or null (no interference)
