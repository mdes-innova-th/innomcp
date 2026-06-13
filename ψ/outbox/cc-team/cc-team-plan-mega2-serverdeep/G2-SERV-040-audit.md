<!-- cc-team deliverable
 group: G2 (serverdeep division)
 member: SERV-040 role=audit model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":486,"completion_tokens":1750,"total_tokens":2236,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 43s
 generated: 2026-06-13T12:21:02.782Z -->
# Deep Bug Audit: thaiKnowledge.types.ts

This module is a **pure type/constant definition file** with no runtime behavior, so most bug categories don't apply. I'll flag what's actually present and mark inapplicable categories explicitly.

| # | Severity | Location | Issue | Fix |
|---|----------|----------|-------|-----|
| 1 | 🟡 **Low** | `ThaiKnowledgeEntity.confidence` (line ~28) | **Unvalidated semantic range** — type is `number` with a comment `// 0..1`, but TypeScript only enforces structural type, not value range. Downstream code may trust the comment and skip validation; corrupted/malicious payloads (`confidence: 1e308` or `NaN`) propagate. | Add a branded type or runtime validator: `confidence: number & { readonly __brand: 'Confidence' }` plus a Zod/io-ts refinement `z.number().min(0).max(1).finite()`. Reject `NaN`/`Infinity` explicitly. |
| 2 | 🟡 **Low** | `ThaiKnowledgeEntity.version` (line ~29) | **Unvalidated semver** — typed as plain `string`; a malformed version string (`"v1"`, `"1"`, `""`, `"../etc/passwd"`) is accepted. If `version` is ever used for cache keys, comparisons, or filesystem paths this is exploitable. | Type as `\`${number}.${number}.${number}\`` template literal or validate with `semver` package. Reject anything not matching `/^\d+\.\d+\.\d+(?:[-+][\w.]+)?$/`. |
| 3 | 🟡 **Low** | `ThaiKnowledgeEntity.updated_at` (line ~30) | **Unvalidated ISO-8601** — typed as `string`; `"not-a-date"` or `""` passes. Sorting/filtering by recency will silently misbehave. | Use a branded type `type Iso8601 = string & { readonly __brand: 'Iso8601' }` and validate with `z.string().datetime({ offset: true })` or `Date.parse(s).toString() !== 'Invalid Date'`. |
| 4 | 🟡 **Low** | `ThaiKnowledgeEntity.attributes` (line ~25) | **Permissive `Record<string, unknown>`** — schema-less bag invites injection if any attribute is later rendered, persisted, or forwarded to a downstream LLM/tool. No max size, no allowlist. | If shape is known, replace with a `Zod` schema. If open-ended, cap depth/size (e.g. ≤32 keys, ≤1KB serialized) and forbid function/symbol values. |
| 5 | 🟡 **Low** | `ThaiKnowledgeLookupRequest.limit` (line ~36) | **Unbounded limit** — `limit?: number` has no `min`/`max`. A client requesting `limit: 1e9` triggers OOM / DoS in the lookup handler. | Add `limit?: number` → `limit?: number & { readonly __brand: 'BoundedInt' }`; validate `Number.isInteger(limit) && limit >= 1 && limit <= 100` at the trust boundary. |
| 6 | 🟡 **Low** | `ThaiKnowledgeLookupRequest.query` (line ~35) | **Unbounded query length** — no `maxLength`. A 10MB query string bloats memory before regex/index lookup. | Add a runtime `maxLength: 1024` (or appropriate) check at the trust boundary. |
| 7 | 🟢 **Info** | `THAI_KNOWLEDGE_DOMAINS` (line 1) | **`as const` is correct** — produces a strict tuple/literal union, preventing typo-based injection of a bogus domain via JSON-RPC `params`. ✅ No fix. | None needed; just ensure **every** downstream `domain` acceptance path re-narrows with a runtime check (`THAI_KNOWLEDGE_DOMAINS.includes(x)`) — TypeScript narrowing is erased at runtime. |
| 8 | 🟢 **Info** | `ThaiKnowledgeSource.url` (line ~12) | **Unvalidated URL** — optional `url` has no scheme allowlist. An attacker-supplied `javascript:`, `data:`, or `file:///etc/passwd` URL could exfiltrate data or XSS if ever rendered. | If rendered as a link, allowlist `https:` only. Validate with `z.string().url().refine(u => new URL(u).protocol === 'https:')`. |
| 9 | 🟢 **Info** | `ThaiKnowledgeEntity.aliases` (line ~21) | **Unbounded array** — `aliases?: string[]` with no max length / no element-length cap. Lookup indices can blow up. | Cap to e.g. ≤32 entries, each ≤256 chars. |
| 10 | 🟢 **Info** | `ThaiKnowledgeEntity.relations` (line ~26) | **Self-referential without cycle protection** — `target_id: string` allows arbitrary graph depth. If traversal is depth-first without visited-set, a 2-node cycle = infinite loop / stack overflow. | Not strictly a *type* bug, but document here: in the resolver, maintain a `visited: Set<string>` and a `maxDepth: number` (e.g. 8). |
| 11 | 🟢 **Info** | `ThaiKnowledgeLookupResponse.matched` (line ~41) | **No max-size guarantee at type level** — the array is `ThaiKnowledgeEntity[]`; cap must be enforced by the producer (paired with finding #5). | Producer must clamp: `matched = matched.slice(0, request.limit ?? defaultLimit)`. |
| 12 | 🟢 **Info** | `ThaiKnowledgeLookupResponse.meta.mode` (line ~44) | **No `"error"` variant** — fine for success, but if a partial/fallback result is ever returned (e.g. DB down, stub served), the caller cannot distinguish degraded service from success. | Consider `mode: "db" | "stub" | "db-error-fallback"` or add a sibling `warnings?: string[]`. |
| 13 | ⚪ **N/A** | Whole file | **Unhandled rejections** — no async code, no rejection surface. | N/A |
| 14 | ⚪ **N/A** | Whole file | **Missing timeouts** — no I/O performed here. | N/A |
| 15 | ⚪ **N/A** | Whole file | **Race conditions** — no shared mutable state. | N/A |
| 16 | ⚪ **N/A** | Whole file | **Resource leaks** — no resource acquisition. | N/A |
| 17 | ⚪ **N/A** | Whole file | **Error envelope correctness** — no error path defined; ensure companion `thaiKnowledge.errors.ts` (if any) uses MCP-compliant `code` + `message` + optional `data`. | Verify in the handler file. |
| 18 | ⚪ **N/A** | Whole file | **MCP protocol edge cases** — types don't encode protocol-level concerns (request id, progress tokens, cancellation). N/A here. | N/A |

## Summary

- **Critical / High:** 0
- **Medium:** 0
- **Low:** 6 (all value-range / input-validation gaps exposed by permissive primitive types at the MCP trust boundary)
- **Info:** 6 (hygiene / defense-in-depth)
- **N/A:** 5 categories don't apply to a type-only module

**Architectural recommendation:** introduce a sibling `thaiKnowledge.schema.ts` exporting Zod (or your validator of choice) schemas, and have a single `parseThaiKnowledgeLookupRequest(input: unknown): ThaiKnowledgeLookupRequest` adapter at the JSON-RPC boundary. The TS types stay as the *static* contract; the Zod schemas enforce the *value* contract. This single chokepoint eliminates findings #1, #2, #3, #5, #6, #8, #9 and shrinks the audit surface of the handler module to near-zero.
