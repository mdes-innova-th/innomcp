<!-- cc-team deliverable
 group: G1 (serverdeep division)
 member: SERV-019 role=audit model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1409,"completion_tokens":2486,"total_tokens":3895,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1498,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 28s
 generated: 2026-06-13T12:13:44.185Z -->
## Deep Bug Audit: `dateTimeTool.ts`

| severity | location | issue | fix |
|---|---|---|---|
| **HIGH** | error catch block | **Missing `isError: true` on error response** — MCP spec requires `isError: true` flag so clients distinguish errors from normal results. Without it, clients parse the Thai error string as a successful datetime. | Add `isError: true` to the returned object in the `catch` block. |
| **HIGH** | response object (both branches) | **`structuredContent` without matching `content` semantics** — If the client is on an older MCP version that doesn't support `structuredContent`, the extra field is ignored or causes a schema violation. On newer versions, returning `{ datetime: "", format: "error" }` in `structuredContent` on error is ambiguous; the `isError` flag only lives on the top-level response, not inside structured data. | Gate `structuredContent` behind protocol version negotiation, or at minimum ensure the error branch's `structuredContent` contains an `error` field, not a falsy `datetime: ""`. |
| **MEDIUM** | `inputSchema` declaration | **`as any` cast on `inputSchema`** — Suppresses compile-time schema correctness checks. If the Zod shape drifts from `DateTimeInput`, the compiler won't catch it. | Remove `as any`; type the schema as `z.ZodType<DateTimeInput>` or let the SDK infer it. |
| **MEDIUM** | `format` Zod schema | **`z.string().optional()` accepts any string** — Values like `"THAI"`, `"ISO"`, `"foo"` all pass validation. The `switch` falls to `default` and silently returns `now.toString()` instead of signaling an invalid input, contradicting the description's own "400 (invalid format)" claim. | Use `z.enum(["thai", "iso", "timestamp"]).optional()` so invalid values are rejected at the schema layer with a proper MCP `InvalidParams` error. |
| **MEDIUM** | `catch` block | **Internal error leakage** — `String(error)` can expose stack traces, locale implementation details, or Node internals to the client. | Return a generic user-facing message (`"เกิดข้อผิดพลาดภายใน กรุณาลองใหม่"`); keep `String(error)` only in `logBoth`. |
| **MEDIUM** | `args: any` handler param | **Untyped args bypasses Zod guarantees** — If the SDK ever passes `null`/`undefined` args (e.g., on a protocol decode failure before validation), `input.format` throws a `TypeError` that's caught but produces a confusing error message. | Type as `args: Record<string, unknown>` and add a null-guard: `if (!args) return { content: […], isError: true }`. |
| **LOW** | `format.toLowerCase()` | **Case-normalisation not documented** — `"THAI"`, `"Thai"` all work but this isn't in the description, and if `format` were a non-string (possible because `args: any`), `.toLowerCase()` throws before the `switch`. | Move `.toLowerCase()` after a type guard, or let Zod `.transform()` handle normalisation. |
| **LOW** | tool description | **Claims "400 (invalid format)" error** but no code path ever returns a 400 or any error for bad format values — the `default` branch silently succeeds. | Either implement an explicit error return for unknown formats, or remove the "400" claim from the description. |
| **LOW** | entire handler | **No execution timeout** — `Date` APIs are fast, but as a defensive pattern every tool handler should have a timeout wrapper to prevent hangs if the runtime stalls or a future refactor adds I/O. | Wrap in `Promise.race([handler(), timeout(5000)])` or add middleware-level timeout. |
| **INFO** | `structuredContent` success branch | **`format` echoes unvalidated user input** into structured output — if `format` contained unexpected values (pre-Zod-enum fix), it would be reflected back verbatim. | After fixing schema to `z.enum`, this is moot; otherwise, map only known values. |
| **INFO** | `registerTool` call | **No tool name collision guard** — If `registerDateTimeTool` is called twice (e.g., hot-reload), the SDK may register duplicate tools without warning. | Add a registration guard or use a `Set<string>` tracker at the server level. |

### Key Remediation Priority

1. **Add `isError: true`** to the `catch` block — this is a protocol-level correctness bug that causes clients to misinterpret failures as successful results.
2. **Tighten the Zod schema** to `z.enum(["thai", "iso", "timestamp"]).optional()` — eliminates the silent-fallback `default` branch and produces proper MCP `InvalidParams` errors for bad input.
3. **Remove `as any`** on `inputSchema` — restores type safety so future schema drift is caught at compile time.
4. **Stop leaking `String(error)`** to clients — replace with a generic message; log the real error server-side only.
