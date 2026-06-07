# Phase 2: Thai History Knowledge - Definition of Done (DoD)

1.  **Architecture**: `THAI_KNOWLEDGE_DB.md` updated with `HISTORY` domain attributes (Era, Person, Event).
2.  **Schema**: `THAI_KNOWLEDGE_SCHEMA.json` updated to validate History entities.
3.  **Tool Impl**: `thai_history_tool.ts` implemented matching `MCP_TOOL_INTERFACE`.
4.  **Integration**: `thai_history_tool` registered in `mcp-server` and `godTierRouter`.
5.  **Data (Seed)**: 4 Major Eras (Sukhothai, Ayutthaya, Thonburi, Rattanakosin) populated.
6.  **Data (Seed)**: At least 10 Key Monarchs (e.g., Ramkhamhaeng, Naresuan, Taksin, Chulalongkorn) populated.
7.  **Unit Tests**: `thai_history_tool.spec.ts` passes with >80% coverage.
8.  **E2E Validation**: `get_thai_history({ query: "Ayutthaya" })` returns correct era info.
9.  **E2E Validation**: `get_thai_history({ query: "King Naresuan" })` returns correct monarch info.
10. **Performance**: Static lookup latency < 500ms.
11. **Safety**: Returns `confidence < 0.6` for unknown/hallucinated history queries.
