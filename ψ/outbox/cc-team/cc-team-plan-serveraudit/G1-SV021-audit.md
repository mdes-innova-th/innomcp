<!-- cc-team deliverable
 group: G1 (Server-node module audit)
 member: SV021 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":746,"completion_tokens":5000,"total_tokens":5746,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4718,"image_tokens":0},"cache_creation_input_tokens":0} | 66s
 generated: 2026-06-13T11:27:31.575Z -->
| Severity | Location | Issue | Proposed Fix |
|----------|----------|-------|---------------|
| HIGH | `createObjectSchema` & `prop.*` builders | All builders embed the `optional` flag directly in the returned property objects; `createObjectSchema` passes them into the output schema without removal. This leaks a non-standard field into the MCP schema, potentially causing validation failures in strict consumers, and also creates a shared-reference risk (caller can mutate the schema). | Deep-clean properties inside `createObjectSchema`: recursively strip the `optional` field from each property and its nested `items`/`properties`, creating new plain objects to avoid mutation. |
| MED | `createObjectSchema` parameter `properties` | No runtime guard: calling `createObjectSchema(null)` or with a non-object argument throws an unhandled `TypeError` from `Object.entries`. | Add an early check: `if (typeof properties !== 'object' || properties === null) throw new TypeError('properties must be an object');` |
| LOW | `prop.array` / `prop.object` parameter order | The `optional` parameter comes after `description`, making it easy to misplace arguments when calling from JavaScript (e.g., `prop.array(items, true)` stores `true` as `description`). TypeScript callers are protected, but JavaScript
