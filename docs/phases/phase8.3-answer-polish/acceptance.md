# Phase 8.3: Answer Polish Acceptance Criteria

## 1. Zero Tolerance for Developer Artifacts

- **PASS Rule:** The final output string MUST NOT contain any markdown code fences (` ``` `), raw `{}` JSON structures, or system internal names like `mcpClient`.

## 2. Formatting Enforcement

- **PASS Rule (WX):** Whenever a multi-district query is successfully parsed, the output MUST use the exact requested list format defined in the TWO-TARGET shape.
- **PASS Rule (GEO):** `ERR:GEO_AMBIGUOUS` MUST print the suggestions explicitly as requested ("กรุณาระบุจังหวัดเพิ่มเติม เช่น ...").
- **PASS Rule (EVI):** The ISP dashboard MUST have the `- รวม:` and `- ISP มากที่สุด:` bullets.

## 3. Failure Taxonomy Hygiene

- **PASS Rule:** `ERR:*` strings from the backend must be completely absorbed by the renderer and converted into human-readable Thai. The `ERR:CODE` should never literally print out to the user interface, except optionally for debugging within parentheses `(ERR:CODE)`.
