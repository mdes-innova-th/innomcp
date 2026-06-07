# Phase 8.2: Robustness Gate (Typo & Near-Miss Handling)

## 1. Robustness Policy

The system must gracefully handle misspelled words, colloquial district names, and ambiguous queries without Hallucinating missing data.

- The deterministic fallback must map common typos to correct targets (e.g., "ลักสี่" -> "หลักสี่").
- If the typo is too severe, the system must trigger a polite clarification sequence, rather than falling back to GeneralGate or hallucinating an answer.

## 2. Component Level Rules

### GEO & WX Alias Resolution

- **Rule:** Before returning `PROVINCE_MISSING` or `GEO_NOT_FOUND`, the string must pass through an alias matcher.
- **Constraints:** Do NOT guess arbitrarily. Only use predefined alias maps or fuzzy match thresholds. If below threshold, reject cleanly.

### Multi-District Parsing (Bangkok)

- **Rule:** Support variations of district queries naturally.
- **Example Handling:** "กทม บางรัก และปทุมวัน" must reliably extract `["บางรัก", "ปทุมวัน"]` using robust regex, safely stripping out "กทม" wrappers.
- **Output Constraint:** Must dynamically render the exact names requested by the user even if they provided an alias (e.g., if they asked for "กทม", use "กรุงเทพมหานคร").

### EVI Intent Mapping

- **Rule:** Colloquial evidence intents like "วันนี้พังเท่าไหร่" or "nip วันนี้กี่อัน" must be accurately bucketed into the core intent handlers (`evidence_records_today`).

## 3. Graceful Degradation

- **Rule:** If ambiguity remains (e.g., finding exactly two locations named "บ้านใหม่" with identical confidence), respond with `ERR:GEO_AMBIGUOUS` and suggest the options. Do NOT pick one at random.
