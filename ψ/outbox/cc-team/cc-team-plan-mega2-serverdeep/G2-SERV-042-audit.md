<!-- cc-team deliverable
 group: G2 (serverdeep division)
 member: SERV-042 role=audit model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1978,"completion_tokens":4933,"total_tokens":6911,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4041,"image_tokens":0},"cache_creation_input_tokens":0} | 92s
 generated: 2026-06-13T12:22:34.340Z -->
### Deep Bug Audit: `thaiLawTool.ts`

| severity | location | issue | fix |
|---|---|---|---|
| **High** | `execute` (L1) | **Unhandled Rejection (Crash):** `args.query.toLowerCase()` throws `TypeError` if `args.query` is undefined, null, or non-string (e.g., if schema validation is bypassed or loose), crashing the MCP tool handler. | Change to `const query = String(args.query ?? "").toLowerCase();` and ensure `query` is strictly validated as a required string in `ThaiLawToolInputSchema`. |
| **High** | `dbQuery` call | **Missing Timeout / Resource Leak:** The database query lacks a timeout. A stalled DB connection or locked table will hang the MCP request indefinitely, violating MCP server timeouts and leaking DB pool connections. | Wrap `dbQuery` in `Promise.race` with a timeout (e.g., 5000ms) or pass a `timeout` configuration to the underlying DB driver. |
| **High** | `execute` (catch) | **Swallowed Errors & SQL Edge Cases:** Empty `catch {}` hides DB failures. Additionally, MySQL `MATCH AGAINST` throws SQL errors on empty strings, very short words (<3 chars), or stopwords, causing valid queries to silently fail and return "not found". | Log the error to stderr. Add a pre-check for query length/stopwords before `MATCH AGAINST`, or fallback to `LIKE '%query%'` for short/stopword queries. |
| **Medium** | `execute` (root) | **Error Envelope Correctness:** Unhandled exceptions inside `execute` (like the TypeErrors below) bubble up, causing the MCP SDK to return a generic protocol error instead of a structured tool error response. | Wrap the entire `execute` body in a `try...catch` and return `{ content: [{ type: "text", text: "Internal error: " + err.message }], isError: true }` on failure. |
| **Medium** | Keyword Search loop | **TypeError on Undefined Props:** `s.content.toLowerCase()` throws if `s.content` is missing. `law.short_name` in template literals outputs the literal string `"undefined"` if the property is missing. | Use `(s.content ?? "").toLowerCase()`. Use `${law.short_name ?? law.name}` in all template literals to ensure graceful fallbacks. |
| **Low** | `results` formatting | **MCP Edge Case (Empty Content):** If `results` contains items but `s.content` is undefined, `formattedText` will contain the literal string `"undefined"`, degrading LLM context and wasting tokens. | Fallback to a default string: `s.content ?? "ไม่มีเนื้อหา"` and ensure the final `text` payload is never an empty string. |
| **Low** | `THAI_LAW_SEED` map | **Data Integrity / Type Safety:** `aliases` filter assumes `short_name` is a string, but if external JSON/DB injects a non-string type, `.trim()` will throw at module initialization. | Use `String(x).trim().length > 0` or strictly validate the seed data against a Zod schema before mapping. |

### Additional Recommendations:
1. **Case-Sensitivity in Filters**: `args.law_name_filter` is compared using `.includes()` against the original casing of `law.name`. If the filter contains English characters, it will fail to match case-insensitively. Consider lowercasing both sides for the filter check.
2. **MCP `isError` Flag**: The MCP protocol highly recommends using `isError: true` when a tool fails to execute its core logic (e.g., DB down, invalid args). The current implementation only returns "not found" text, which the LLM might interpret as a successful search that yielded zero results rather than a system failure.
3. **Pagination/Limits**: The in-memory search pushes all matched sections into `results`. If the knowledge base grows, this could result in massive text payloads that exceed the LLM's context window or MCP message size limits. Add a `results.slice(0, 10)` limit before formatting.
