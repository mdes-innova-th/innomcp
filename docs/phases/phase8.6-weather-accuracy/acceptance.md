# Phase 8.6: Weather Accuracy Acceptance Criteria

## 1. Zero Hallucination (Renderer-Only)

- **PASS:** In all cases where the TMD API is down, returns an array of `r.type === "error"`, the text response maps securely to `ERR:WX_*`.
- **FAIL:** The system apologizes using a generic LLM conversational string and "guesses" the weather using training data (e.g. "อุณหภูมิ 30°C").

## 2. Strict Taxonomy Mapping

- **PASS:** Any error strings leaving the `classifyErrorCode` logic map exclusively to `TIMEOUT`, `UPSTREAM`, or `NO_DATA`.
- **FAIL:** Raw SQL errors, HTTP 503 texts, or internal stack traces leak into the user message.

## 3. Hygiene & Artifacts

- **PASS:** Trace v3 logs contain clean strings with exactly 0 occurrences of "โหมดทดสอบ", "เพื่อการทดสอบระบบ", or `process.env`.
- **FAIL:** Developer artifacts or JSON fences (`"```json"`) are visible in the `.text` outputs.

## 4. Multi-District Resolution

- **PASS:** A query with two valid Bangkok districts (e.g., "บางแคและมีนบุรี") renders two distinct `พื้นที่: ...` blocks in the contract answer.
- **FAIL:** The query aborts as `PROVINCE_MISSING` or only renders one district.

## 5. Execution Efficiency

- **PASS:** If 3-hour station data API succeeds but filters 0 results (Station not found), the pipeline immediately returns `STATION_NOT_FOUND` without wasting upstream calls on the 07am fallback or NWP fallback.
- **FAIL:** The system performs unnecessary upstream API calls when it already explicitly knows the target is missing in the primary dataset.
