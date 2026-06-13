<!-- cc-team deliverable
 group: G1 (perf division)
 member: PER-017 role=perf model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3334,"completion_tokens":1947,"total_tokens":5281,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1529,"image_tokens":0},"cache_creation_input_tokens":0} | 28s
 generated: 2026-06-13T12:01:45.963Z -->
| severity | location | issue | fix |
|----------|----------|-------|-----|
| medium | `evidenceMatch` (inside the `if (["machine",...])` block) | Inline regexes `/machine learning|url encoding|url คืออะไร/` and `/หลักฐาน|คดี|.../i` are re-compiled on every call. | Hoist both patterns to module‑level `const` variables (`NON_OFFICER_SIGNAL_RE`, `OFFICER_SIGNAL_RE`) and reuse them. |
| medium | `evidenceMatch` – officer‑signal test | The guard `hasOfficerSignal` uses a duplicated inline regex identical to the module‑level `OFFICER_SIGNAL_RE`. | Replace the inline regex with a reference to the already defined `OFFICER_SIGNAL_RE` constant to avoid re‑compilation and keep intent in sync. |
| low | `classifyIntent` → multiple `containsAny` calls | The raw `message` string is lowercased once per `containsAny` (and again inside `evidenceMatch`), leading to repeated O(n) allocations. | Lowercase the message once at the top of `classifyIntent` and pass the lowercased version to all helpers. |
| low | `containsAny` iteration | Every keyword is lowercased inside the loop (`k.toLowerCase()`), repeating the same work for a static list. | Store all keyword arrays already lowercased (e.g., `const LOWERCASE_KEYWORDS = [...]`) to avoid per‑call lowercasing overhead. |
| low | `classifyIntent` – scattered keyword lookups | Multiple sequential `containsAny` calls scan the entire message for each intent, causing redundant full‑text passes. | Optionally tokenise the lowercased message once and use a single pass over tokens with a map of keyword→intent to reduce repeated `includes` scans. (Only relevant if message length or request rate is high.) |
