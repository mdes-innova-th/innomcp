# Phase 9.1: Patch-Pack

_This document outlines the explicit locations VIT must modify during implementation._

## 1. Target Files for Implementation (VIT)

- `innomcp-server-node/src/utils/dbDetect.ts` OR `innomcp-node/src/utils/db/evidenceConnection.ts`
  - _Action:_ Implement 2-mode connections, SQL policies, and Error Taxonomy catching.
- `innomcp-node/src/utils/mcp/tools/evidenceTool.ts`
  - _Action:_ Update tool schema to return `structuredContent` and enforce the Renderer-Only LLM instruction.
- `innomcp-node/src/routes/chat.ts` (or equivalent tool router)
  - _Action:_ Ensure proper tool call parsing and routing to `evidenceTool` without mutating data formats.
- `innomcp-node/scripts/verify_phase91_detectdb_v1.ts` (NEW)
  - _Action:_ Create verifier script to validate functionalities.

## 2. Risk Matrix

| Risk Element   | Description & Mitigation                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| **DB Creds**   | Hardcoded creds could leak. _Mitigation:_ Explicit `.env` parsing, fail-fast on missing vars.                 |
| **PII Leak**   | Queries might accidentally fetch real identifiers. _Mitigation:_ Aggregation-only SQL policy.                 |
| **Perf**       | Massive aggregations block the event loop. _Mitigation:_ Set SQL timeout configs, index targets.              |
| **Retry Spam** | LLM stuck in loop when DB is down. _Mitigation:_ Distinct `ERR:EVI_DB_DOWN` signals the LLM to STOP retrying. |

## 3. Operator Notes

**Fast checking commands:**

1. Check DB Mode:
   `npm run cli -- inspect-db-config`
2. Run Verifier Script:
   `npx ts-node innomcp-node/scripts/verify_phase91_detectdb_v1.ts`
3. Audit Logs:
   `grep -i "ERR:EVI_" innomcp-node/trace_evidence.txt`
