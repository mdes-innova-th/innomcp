# Phase 10.5 Implementation Plan (Knowledge Engine Setup)

## Objective
Following Phase 10.4 and the addition of the Thai Knowledge DB Schema, proceed to build the inference logic to serve the Thai Knowledge MCP natively connected to GodTierRouter.

## Requirements for Dev (Phase 10.5 Queue)

1. **Routing Integration (GodTierRouter):**
   - Connect the `thaiKnowledgeTool` response logic inside the GodTierRouter path.
   - When users ask about Provinces/Geo topics, redirect to the Thai Knowledge tool over basic LLM.
2. **Confidence Threshold Re-check:**
   - Write a deterministic verifier script specifically for Phase 10.5: `scripts/verify_phase105_thai_knowledge_routing.ts`.
   - Ensure the verifier proves that "low confidence" queries get graceful fallbacks.
3. **Evidence Log Generation:**
   - Execute the verifier and generate an evidence log named: `evidence/phase105-knowledge-routing-YYYYMMDD.log`.

**Definition of Done:**
- [x] GodTier router correctly maps Thai geo/knowledge questions to the new MCP tool.
- [x] Verification script runs with `exitCode=0` under `SMOKE_MODE=1`.
- [x] New implementation is merged and Evidence log is supplied.

**Completed: 2026-03-08**

Evidence: `innomcp-node/evidence/phase105-knowledge-routing-20260308.log` — `RESULT: PASS`

*Note: Proceed to implement these requirements and mark the TODO.md accordingly. After completion, alert SA with a CODE_READY payload.*
