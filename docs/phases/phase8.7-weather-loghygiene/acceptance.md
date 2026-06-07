# Phase 8.7: Weather Log Hygiene Acceptance Criteria

## 1. Resolver Correctness

- **PASS:** Queries using Bangkok districts or common abbreviations ("กทม", "กรุงเทพฯ", "จ.ภูเก็ต") appropriately resolve to canonical valid provinces. "No resolver empty province for Bangkok districts".
- **FAIL:** The resolver returns an empty province list (`[]`) for a known Bangkok district, forcing a fallback to a generic national summary or a "PROVINCE_MISSING" error.

## 2. Accurate Lifecycle Accounting

- **PASS:** "No duplicate completion logs". The execution duration recorded for MCP requests matches the actual processing time. Network closure events do not trigger anomalous >60s completion logs.
- **FAIL:** A single request UUID logs "completed" multiple times, or logs an exaggerated duration minutes after the real response was sent, obscuring actual performance metrics.

## 3. Strict Source Hygiene

- **PASS:** Output logs and code contain zero testing placeholders ("โหมดทดสอบ") and do not leak environment variables.
- **FAIL:** `process.env` structures are present in final exported JSON objects or trace lines.
