<!-- cc-team deliverable
 group: G2 (Server-node module audit)
 member: SV030 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2846,"completion_tokens":3604,"total_tokens":6450,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3157,"image_tokens":0},"cache_creation_input_tokens":0} | 49s
 generated: 2026-06-13T11:31:49.268Z -->
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `MariaDbHistoryDb.search` – catch block (lines ~60-65) | Original error swallowed without logging; fallback query not wrapped in try/catch, so if it fails the rejection propagates without context of the initial fault. | Log the original error before attempting fallback; wrap fallback query in a try/catch and throw a descriptive error if it also fails. |
| HIGH | `safeJsonParse` – early return when `typeof value === "object"` (line ~150) | Returns the original mutable object reference (e.g., arrays, attributes) instead of a copy, allowing cross-request mutation of shared in-memory data. | Deep-clone the value before returning, or use `structuredClone(value)` to prevent unintended mutation. |
| HIGH | `InMemoryHistoryDb` – constructor stores reference to input array; `search` returns entity objects directly (lines ~75, 90) | No cloning of stored entities or returned results; mutation by any consumer permanently corrupts the in-memory database. | Clone the entities array on construction and return cloned copies from search (or freeze/seal if immutability is intended). |
| MEDIUM | `MariaDbHistoryDb.search` – try block around both queries (lines ~55-65) | If LIKE query fails inside the try, the catch block re-executes the same LIKE query again, masking the real error and potentially creating confusing duplicate log entries. | Separate error handling: run fulltext and like queries with independent try/catch, or use a flag to avoid retrying the same fallback. |
| LOW | `MariaDbHistoryDb.search` – parameter `limit` (line ~45) | No validation that limit is a positive integer; zero or negative values could produce database errors or unintended infinite-like behavior (LIMIT 0). | Validate `limit` is an integer ≥ 1 and use a default if invalid. |

**Risk verdict:** High risk from silent error suppression and mutable reference sharing leading to undebuggable failures and data corruption across concurrent operations.
