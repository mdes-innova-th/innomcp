# Phase 8.9 Acceptance Criteria

_Strict DoD (Definition of Done) for Vit's Implementation._

### Functional Requirements

- **2-Block Formatting:** Multi-location weather results must cleanly render in distinct block structures without bleeding logic across outputs.
- **5-Field Completeness:** Weather responses must contain valid descriptors for Temp, Rain %, Wind, Humidity, and General Description.
- **Wasted NWP Guards:** Confirm that missing provinces (`PROVINCE_MISSING`) do not invoke the heavy NWP API pipeline. Fallback happens at the engine layer immediately.

### Security / Redaction Requirements

- NO placeholder string leaks (`โหมดทดสอบ`, `30°C`, etc.).
- NO LLM hallucinated weather locations (Deterministic fallback to `ERR:WX_*` tokens).
- ZERO leaks of `uid=`, `ukey=`, `Authorization: Bearer`, or `requestInfo.headers` in raw `Trace v3` outputs.
