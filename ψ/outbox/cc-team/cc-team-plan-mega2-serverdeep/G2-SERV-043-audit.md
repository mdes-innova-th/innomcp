<!-- cc-team deliverable
 group: G2 (serverdeep division)
 member: SERV-043 role=audit model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1581,"completion_tokens":5000,"total_tokens":6581,"prompt_tokens_details":{"cached_tokens":59,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 49s
 generated: 2026-06-13T12:22:56.594Z -->
The user wants a deep bug audit of the provided TypeScript MCP server code. I need to look for:

1. Unhandled rejections
2. Missing timeouts
3. Race conditions
4. Resource leaks
5. Error envelope correctness
6. MCP protocol edge cases

Let me analyze the code carefully.

The module is `innomcp-server-node/src/mcp/tools/thaiReligionTool.ts`.

Looking at the code:

1. **Unhandled rejections**: The `execute` function is async but doesn't have a try-catch. If any synchronous or asynchronous error occurs (though mostly synchronous here), it could result in an unhandled rejection. However, since the operations are mostly synchronous array operations, the async keyword is unnecessary but not harmful. But if `args.query` is undefined or null, `args.query.toLowerCase()` will throw. This is a runtime crash.

2. **Missing timeouts**: No timeouts on any operations. Though the operations are local and synchronous, in an MCP context, tools should ideally have execution timeouts or the server should enforce them. But locally, there's no timeout mechanism.

3. **Race conditions**: Not obvious since it's synchronous and stateless. No shared mutable state across concurrent calls (the knowledge base is const). So no race conditions.

4. **Resource leaks**: No resources being opened (files, network, etc.), so no leaks.

5. **Error envelope correctness**: MCP protocol requires specific error formats. If `execute` throws, the SDK might catch it, but the code doesn't explicitly handle errors. The success envelope returns `{ content: [...] }`. However, if an error occurs, it throws a raw Error, not an MCP error object. Also, the return type isn't strictly typed - it returns `any` essentially. The `as const` assertion is used but the overall structure might not match MCP's expected tool result format exactly (though it looks close).

6. **MCP protocol edge cases**:
   - The `inputSchema` is cast `as any` in `registerThaiReligionTool`, bypassing type safety.
   - The `execute` function is cast `as any`.
   - No validation that `args` actually conforms to the schema before accessing `args.query`. The MCP SDK usually validates, but if bypassed or if the schema is wrong, `args.query` could be missing.
   - The `typeMap` has a mapping but if `args.type` is provided but not in the map, it maps to `undefined`, and `item.type !== undefined` will be true for all items, effectively filtering out everything. This is a logic bug.
   - `item.name.includes(query)` - `item.name` is Thai text, `query` is lowercased. Thai text doesn't have case, but if `item.name` contains uppercase English (it doesn't really, but `alt_names` does), the lowercase comparison works for alt_names. But `item.name.includes(query)` where query is lowercase and name might have uppercase English? Actually the names are Thai with some English in alt_names. But `item.name` is Thai so case doesn't matter. However, `item.description.includes(query)` - description is Thai, so fine.
   - If `args.query` is an empty string, everything matches. Is that intended?
   - The return format: MCP tool results should be `{ content: Array<{type: "text", text: string}> }` or `{ content: [...], isError?: boolean }`. The code returns the correct shape for success, but on error it throws instead of returning an error envelope with `isError: true`.
   - No handling for `args.query` being undefined/null.
   - The `typeMap` doesn't handle all possible values from the schema? The schema isn't shown, but `args.type` is used.
   - The `inputSchema` is imported as `ThaiReligionToolInputSchema` but cast to `any`, losing type safety.
   - The `execute` function signature uses `z.infer<typeof ThaiReligionToolInputSchema>` but the actual registration casts it away.

Let me think about specific MCP protocol issues:
- According to MCP spec, tool errors should be returned as tool result with `isError: true`, not thrown exceptions, unless it's a server-level error. Throwing might cause the SDK to return an internal error or crash.
- The content type is `"text"` which is correct.
- The schema registration uses `as any` which is bad practice.

Other issues:
- `args.query.toLowerCase()` will throw if query is not a string.
- `item.description.includes(query)` - if `item.description` is undefined (not in this hardcoded data, but if data changes), it throws.
- `item.attributes?.importance.join(", ")` - if importance exists but is not an array, it throws. But it's hardcoded.
- The `typeMap` lookup: `typeMap[args.type]` could be undefined. Then `item.type !== undefined` is true for all items, so everything is filtered out. This is a bug. If an invalid type is passed (or a type not in the map), no results. But if `args.type` is valid but the map is incomplete, same issue.

Wait, looking at the input schema types: `"place" | "person" | "concept" | "calendar"`. The map has these. But what if the schema allows other values? Or what if `args.type` is provided but not a key in `typeMap`? Then `typeMap[args.type]` is `undefined`, and the comparison `item.type !== undefined` will filter out every item because `item.type` is always defined (TEMPLE, TRADITION, etc.). So everything gets filtered out. This is a logic bug.

Actually, if `args.type` is provided but invalid, the MCP SDK should have already validated it against the schema. So maybe not a bug if the schema is correct. But if the schema is `z.string().optional()` instead of a union, then it's a bug.

Let me reconsider the error envelope. In MCP, when a tool execution fails, the result should be:
```json
{
  "content": [...],
  "isError": true
}
```
Or the server can return an error response. But typically for tool execution, you return content with `isError: true`. If the `execute` function throws, the SDK's `callTool` method should catch it and return an error. But depending on the SDK version, unhandled exceptions in tools might crash the server or be returned as internal errors.

Actually, looking at the MCP SDK for server-node, if a tool handler throws, it should be caught by the SDK and returned as an error result. But the issue is that the error won't be a proper MCP error object.

Let me structure the findings:

**Critical/High:**
1. **Unhandled exception / Error envelope**: `execute` is async without try-catch. `args.query.toLowerCase()` can throw if query is missing/invalid. This results in an unhandled rejection (since async) or thrown error. The MCP protocol expects tool errors to be returned as `{content: [...], isError: true}` or handled gracefully. Throwing raw errors bypasses proper error envelopes.
   - Fix: Wrap in try-catch, return `{content: [{type: "text", text: errorMessage}], isError: true}`.

2. **Missing input validation / Type safety**: `args.query` accessed without null-check. The `as any` casts bypass schema validation at the TypeScript level.
   - Fix: Remove `as any` casts, validate inputs.

**Medium:**
3. **Logic bug in type mapping**: If `args.type` is not a key in `typeMap` (or if schema allows values not in map), `typeMap[args.type]` is `undefined`, causing all items to be filtered out. Also, the mapping is incomplete (e.g., "calendar" maps to TRADITION, but what about other types?).
   - Fix: Add explicit undefined check or exhaustive mapping with validation.

4. **Missing timeout**: Tool execution has no timeout. If the knowledge base were large or if IO were added later, it could hang. In MCP, long-running tools should respect timeouts or cancellation tokens.
   - Fix: Add timeout wrapper or check for cancellation signals if SDK supports it.

5. **Case sensitivity in description matching**: `item.description.includes(query)` uses lowercased query, but description might contain uppercase English terms. However, since descriptions are mostly Thai, this is minor. But `item.name.includes(query)` - names are Thai, but alt_names have English. The query is lowercased, but `item.name` might contain uppercase English? Not really in this dataset.
   - Actually, `item.name` is Thai. `item.alt_names` has English. `alt_names?.some(n => n.toLowerCase().includes(query))` correctly lowercases alt names. But `item.name.includes(query)` does NOT lowercase `item.name`. If `item.name` had English uppercase, it would fail. But it doesn't. Still, inconsistent handling.
   - Fix: Normalize both sides to lowercase.

**Low/Info:**
6. **Resource leak / Memory**: Not applicable currently, but the `results` array holds references. Not a leak.
7. **Race condition**: Not applicable since no shared mutable state.
8. **MCP Protocol edge case - Content type**: The `as const` is used but the return type is inferred. Should explicitly type as `CallToolResult` or similar.
9. **MCP Protocol edge case - Empty query**: Empty string matches everything. Should validate minimum length.
10. **Hardcoded data**: Not a bug per se, but no error handling if knowledge base entries are malformed.

Wait, I need to be careful about "Unhandled rejections". Since `execute` is async, if it throws synchronously (like `args.query.toLowerCase()` when query is undefined), it actually returns a rejected promise. The MCP SDK should handle rejected promises from tool handlers. But if the SDK doesn't catch it properly, it's an unhandled rejection. However, the SDK likely does catch it. Still, it's better to handle it and return a proper error envelope.

Let me check the MCP SDK behavior. In the Model Context Protocol SDK for TypeScript, the `server.registerTool` handler is expected to return a promise that resolves to the result. If it rejects, the SDK should catch it and send an error response. But the specific error envelope might not be correct from the protocol perspective.

Actually, looking at the MCP specification: Tool execution errors should be returned as a result with `isError: true`, not as JSON-RPC errors. JSON-RPC errors are for protocol-level issues (invalid params, method not found, etc.). Application-level errors (like "no results found") should be returned as successful tool results with explanatory text. Wait, but "no results found" isn't really an error - the code handles that correctly.

But if `args.query` is missing, that's an invalid invocation. The SDK should validate the schema before calling execute. So `args.query` should always be present if the schema is correct. But because of the `as any` cast, schema validation might be bypassed or incorrectly typed.

Let me reconsider the severity levels.

**Severity: Critical**
- If the tool throws, and the SDK doesn't catch it, the server crashes. But assuming SDK catches it, it's High not Critical. Let's say High.

**Severity: High**
- Error envelope correctness: Throwing instead of returning `isError: true` violates MCP best practices for tool execution errors. The spec says: "If a tool encounters an error, it should return a result with `isError: true` and an error message in the content."
- Input validation: `args.query.toLowerCase()` assumes query exists. Even if Zod validates, the `as any` cast is dangerous.

**Severity: Medium**
- Type mapping logic bug: `typeMap[args.type]` can be undefined, causing incorrect filtering.
- Missing timeout: No timeout mechanism on tool execution.

**Severity: Low**
- Case sensitivity inconsistency.
- `as any` casts reducing type safety.
- No explicit return type on `execute`.

Let me draft the table:

| severity | location | issue | fix |
|---|---|---|---|
| High | `execute` body | Unhandled exceptions (e.g., `args.query.toLowerCase()` on undefined) produce raw throws instead of MCP-compliant error envelopes. The async function lacks try/catch, risking unhandled rejections if the SDK doesn't perfectly catch handler throws. | Wrap execution in `try/catch`; return `{content:[{type:"text",text:err}], isError:true}` for application errors. |
| High | `registerThaiReligionTool` | `inputSchema` and `execute` are cast `as any`, bypassing compile-time validation and risking runtime schema/argument mismatches that crash the tool. | Remove `as any`; ensure `ThaiReligionToolInputSchema` and handler are typed to `z.infer` and MCP SDK types. |
| Medium | `typeMap` lookup | If `args.type` is not a key in `typeMap` (or schema drifts), lookup returns `undefined`; comparison `item.type !== undefined` silently filters out every result, causing empty results for valid queries. | Validate `args.type` against schema enum; add explicit check `if (mappedType === undefined) return {content:[...], isError:true}` or use exhaustive switch. |
| Medium | `execute` signature | No execution timeout or cancellation token handling. If knowledge base I/O blocks (future-proofing) or a slow path is added, the tool hangs indefinitely. | Add a `Promise.race` with a timeout or respect an `AbortSignal` if provided by the MCP SDK context. |
| Low | `item.name.includes(query)` | `query` is lowercased but `item.name` is not normalized, causing missed matches if names ever contain Latin characters with mixed case. | Normalize both sides: `item.name.toLowerCase().includes(query)` and `item.description.toLowerCase().includes(query)`. |
| Low | `execute` return | Success return lacks explicit `CallToolResult` typing; missing `isError: false` (optional but explicit is safer). | Add explicit return type `Promise<CallToolResult>` and include `isError: false` on success paths. |

Wait, I should check if there are any actual race conditions. The knowledge base is a const array. The `results` array is local. No shared state mutation. So no race condition.

Resource leaks? None.

MCP protocol edge cases:
- The tool returns text content. That's fine.
- The schema is passed as JSON Schema. The `ThaiReligionToolInputSchema` is a Zod schema. The registration expects JSON Schema? Wait, `server.registerTool` from `@modelcontextprotocol/sdk/server/mcp.js` - I need to check what the second argument expects. In the MCP SDK, `registerTool` usually takes `name`, `metadata` (including inputSchema as JSON Schema), and `handler`. If `ThaiReligionToolInputSchema` is a Zod schema object, passing it directly as `inputSchema` might not work unless it's converted to JSON Schema. The user imports it from `../knowledge/types/religion`. It might already be a JSON schema object, or it might be a Zod schema. The code casts `as any`, which hides a potential type mismatch. If it's a Zod schema, the MCP SDK expects a JSON Schema object. This is a significant issue!

Let me reconsider. The import is `ThaiReligionToolInputSchema` from a types file. The file uses `z` from zod. So it's likely a Zod schema. But `server.registerTool` in the MCP SDK expects the schema to be a JSON Schema object (or ZodType? I need to recall). Actually, the MCP SDK server might accept Zod schemas directly in some versions, but typically it expects JSON Schema. If it's a Zod schema and the SDK tries to serialize it or use it as JSON Schema, it could fail or behave unexpectedly. The `as any` cast suppresses this.

Actually, looking at the MCP TypeScript SDK, `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` is the high-level server. It might indeed accept Zod schemas. Let me think. The SDK has two levels: low-level `Server` and high-level `McpServer`. The high-level one might have `registerTool` that accepts Zod. But the code still casts `as any`, which is suspicious.

If the SDK expects JSON Schema and gets a Zod schema, the tool registration might fail or the schema might not be correctly reported to the client. This is an MCP protocol edge case.

Another edge case: The tool description and title are passed correctly.

Another issue: The `execute` function is async but does no await. This is fine but unnecessary.

Another issue: `item.attributes?.location?.province` - if `item.attributes` exists but `location` doesn't, it's fine due to optional chaining. But if `item.attributes` is undefined for a TRADITION type, `item.attributes?.location?.province` is undefined, and `args.province !== undefined` will skip it. That's correct.

But wait: `args.province && item.attributes?.location?.province !== args.province`. If `args.province` is provided, and the item is a TRADITION (which has no location), `item.attributes?.location?.province` is undefined, so `undefined !== args.province` is true, and it continues (skips). This means searching by province filters out non-place items. Is that intended? Probably yes.

Let me think about the `typeMap` again. The input schema types are "place", "person", "concept", "calendar". The internal types are TEMPLE, MONK, TRADITION. The map handles "place" -> TEMPLE, "person" -> MONK, "concept" -> TRADITION, "calendar" -> TRADITION. But what if the knowledge base contains a MONK? There are no monks in the hardcoded data, but the tool claims to support "Monks". If a user searches with `type: "person"`, it maps to MONK, but there are no MONK entries, so it returns empty. That's data incompleteness, not a code bug.

What if `args.type` is provided but is not in the map? With Zod validation, this shouldn't happen. But the `as any` cast makes it possible.

Let me refine the table to be very specific and actionable.

I should also mention that `results` is typed as `any[]`, losing type safety.

And the return value is not strictly typed.

Let me check for "Unhandled rejections" specifically. The function is `async`. If `args.query` is null, `args.query.toLowerCase()` throws a TypeError. Since it's the first line in an async function, it becomes a rejected promise. The MCP SDK's tool handler caller should catch this. But if there's any other async operation that fails... there are none. So the only unhandled rejection path is if the SDK doesn't catch it. However, the prompt asks to look for unhandled rejections. The lack of try-catch in an async function is a valid finding.

Actually, another issue: `item.alt_names?.some(n => n.toLowerCase().includes(query))`. If `item.alt_names` exists but contains a non-string, `n.toLowerCase()` throws. But data is hardcoded, so unlikely.

Another MCP protocol issue: The tool result should ideally not contain markdown (`## `) unless the client expects it, but that's not a bug.

Let me structure the final table. I'll aim for 6-7 rows covering the most important issues.

Row 1: High - Error envelope / Unhandled rejection - execute lacks try-catch and doesn't return `isError: true`.
Row 2: High - Type safety / Protocol - `as any` casts on schema and handler bypass validation.
Row 3: Medium - Logic bug - `typeMap` can return undefined, causing total filter failure.
Row 4: Medium - Timeout - No timeout on tool execution.
Row 5: Low - Case sensitivity - `item.name` and `item.description` not lowercased.
Row 6: Low - Typing - `results: any[]` and implicit return type.

Wait, is there a resource leak? No. Race condition? No. But I should mention that there are none if relevant, or just omit them.

The user asked specifically for: unhandled rejections, missing timeouts, race conditions, resource leaks, error envelope correctness, MCP protocol edge cases.

So I need to make sure I cover:
- Unhandled rejections: Yes (Row 1)
- Missing timeouts: Yes (Row 4)
- Race conditions: None found in this module (I can note that in a summary or omit from table since none)
- Resource leaks: None found (same)
- Error envelope correctness: Yes (Row 1)
- MCP protocol edge cases: Yes (Row 2, and maybe Row 3 is a protocol edge case? No, it's logic. But the schema casting is an edge case.)

Let me add a row for MCP protocol edge case regarding the schema format (Zod vs JSON Schema).

Actually, looking at the import: `import { ThaiReligionToolInputSchema } from "../knowledge/types/religion";`. And the file imports `z` from "zod". So `ThaiReligionToolInputSchema` is definitely a Zod schema. The `McpServer.registerTool` likely expects a JSON Schema for the `inputSchema` field in the metadata object. If the SDK's high-level server accepts Zod schemas, then it's fine. But the `as any` suggests the developer had to force it. This is a protocol edge case because if the schema isn't correctly serialized, the client will receive an invalid tool schema.

Let me verify: In the MCP SDK, `McpServer` (high-level) might indeed support Zod. But the low-level `Server.setRequestHandler` for `tools/list` returns JSON Schema. The `McpServer` wrapper likely converts Zod to JSON Schema. But passing `as any` is still bad practice.

I'll include it as a High severity issue because incorrect schema registration is an MCP protocol compliance issue.

Let me also consider: The `execute` function returns `{ content: [...] }`. According to MCP, the result should be an object with a `content` array. That's correct. But for errors, per the spec: "If a tool encounters an error, it should return a result with `isError: true` and an error message in the content." So throwing is wrong.

Another edge case: The tool doesn't handle the case where `args.query` is an empty string. It would match everything. This isn't necessarily a bug, but it's an edge case. I can mention it as Low.

Let me finalize the table:

| severity | location | issue | fix |
|---|---|---|---|
| High | `execute` (top-level) | **Unhandled rejection / incorrect error envelope**: Async handler has no `try/catch`. Synchronous throws (e.g., `args.query.toLowerCase()` if undefined) become rejected promises instead of MCP-compliant tool results. MCP requires application errors to be returned as `{ content: [...], isError: true }`, not thrown exceptions. | Wrap logic in `try/catch`. Return `{ content: [{ type: "text", text: errorMsg }], isError: true }` on failure. Validate `args.query` exists before use. |
| High | `registerThaiReligionTool` | **MCP protocol / type safety**: `inputSchema` and `execute` are
