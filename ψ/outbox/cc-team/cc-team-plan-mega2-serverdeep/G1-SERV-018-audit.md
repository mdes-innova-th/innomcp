<!-- cc-team deliverable
 group: G1 (serverdeep division)
 member: SERV-018 role=audit model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1887,"completion_tokens":5000,"total_tokens":6887,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 78s
 generated: 2026-06-13T12:14:19.666Z -->
The user wants a deep bug audit of the provided TypeScript code (`dataAnalysisTool.ts`) focusing on specific categories:
1. Unhandled rejections
2. Missing timeouts
3. Race conditions
4. Resource leaks
5. Error envelope correctness
6. MCP protocol edge cases

I need to output a table with columns: | severity | location | issue | fix |

Let me analyze the code carefully.

**Code Overview:**
- It's an MCP tool for analyzing CSV/JSON data.
- Uses `csv-parse/sync` (synchronous parsing).
- Has Zod schema but the `execute` wrapper uses `args: any`.
- Returns JSON strings as text content.
- No explicit timeouts.
- No resource management (streams, etc.).
- Error handling is try/catch around parsing only.

**Detailed Analysis:**

1. **Unhandled rejections / Async issues:**
   - `execute` is async but doesn't do anything async except `JSON.stringify` and parsing (csv-parse/sync is sync, JSON.parse is sync). So the async function is unnecessary but not harmful per se. However, if `parseCsv` or `JSON.parse` throw, they are caught. But wait - `parseCsv` is sync, so it's fine.
   - The `execute` function in the tool object is async. If `execute(args)` throws synchronously (which it shouldn't since it's async), but actually `execute` is declared as `async function execute`. The inner `parseRows` calls `parseCsv` which is synchronous. No unhandled rejections from async operations because there are none.

2. **Missing timeouts:**
   - `parseCsv` on very large strings can block the event loop. Since it's synchronous parsing, there's no timeout mechanism. This is a DoS vector. The code checks `MAX_ROWS` *after* parsing, so a huge CSV/JSON string could cause the process to hang or run out of memory before reaching the row limit check.
   - No timeout on the tool execution itself. MCP servers should ideally have timeouts for tool execution to prevent hanging clients.

3. **Race conditions:**
   - Not obvious race conditions in this single-threaded code, but the synchronous parsing blocks the event loop. If multiple requests come in, they queue up. Not exactly a race condition but concurrency hazard.
   - The `MAX_ROWS` enforcement happens after parsing, so memory exhaustion race against other requests.

4. **Resource leaks:**
   - `parseCsv` creates internal buffers. For extremely large inputs, memory isn't released until after the function returns. No explicit resource cleanup.
   - No streams are used, so no stream leaks. But large strings stay in memory.

5. **Error envelope correctness:**
   - The tool returns `JSON.stringify({ ok: false, error: "..." })` as text content. This is not standard MCP error handling.
   - MCP protocol expects errors to be returned via the `isError` flag in the tool result or by throwing an error that the SDK catches and converts to a JSON-RPC error.
   - The code returns `{ content: [{ type: "text", text: resultText }] }` with no `isError: true` when parsing fails. This means the MCP client sees a successful tool call with text content containing an error JSON, rather than a proper tool error. This violates MCP protocol semantics.
   - Also, if `execute` throws an unexpected error (not caught), the SDK might handle it, but the wrapper `execute` in the tool object doesn't have a try/catch. If `execute(args)` throws (e.g., `args` is null/undefined and `String(args.data)` throws? Actually `String(args.data ?? "")` is safe. But if `args` is null, `args.data` would throw before `??`. Wait: `args.data` - if args is null, this throws TypeError. But Zod should validate before. However, the tool wrapper uses `args: any` and passes to `execute` which does `String(args.data ?? "")`. If `args` is undefined, `args.data` throws. This would be an unhandled exception in the async function, causing a rejected promise. The MCP SDK might handle it, but it's not ideal.

6. **MCP protocol edge cases:**
   - **Error reporting**: As mentioned, returning error details in `content` without `isError: true` is wrong. Should return `isError: true` and optionally put error text in content, or let the SDK handle thrown errors.
   - **Schema validation**: The `inputSchema` is Zod, but `registerTool` is called with `(server.registerTool as any)` which bypasses type safety. The SDK might expect a JSON Schema object, not a Zod schema. If the SDK doesn't convert Zod to JSON Schema automatically, this could fail or produce invalid schema. The `as any` is suspicious.
   - **Content type**: Only returns `text`. If the result is huge (near limits), it might exceed MCP transport limits. No size check on the output.
   - **Tool name/description**: The `title` includes Thai characters. Not a bug, but an edge case for encoding.
   - **JSON parsing**: `JSON.parse(input.data)` on untrusted input. If `input.data` is a huge string, it can block the event loop or cause OOM.
   - **CSV injection**: Not really an MCP protocol issue, but returning CSV/JSON data as text without sanitization could be an issue if the client renders it. But that's client-side.
   - **Missing `isError`**: When `ok: false`, the tool result should have `isError: true`.
   - **Zod schema not converted**: The `inputSchema` passed to `registerTool` is a Zod object. The MCP SDK server typically expects a JSON Schema shape (ZodType or raw JSON schema). If using `@modelcontextprotocol/sdk`, the `registerTool` might expect a JSON schema object. Passing a Zod schema directly might work if the SDK supports it, but it's risky. Actually, looking at the SDK, `registerTool` usually takes a JSON schema object. If a Zod schema is passed, it might not serialize correctly for the client. This is an MCP protocol edge case because the client receives an invalid tool schema.

Let me look more carefully at the `registerTool` call:
```typescript
(server.registerTool as any)(
    dataAnalysisTool.name,
    {
      title: "Data Analysis Tool - วิเคราะห์ข้อมูล CSV/JSON",
      description: dataAnalysisTool.description,
      inputSchema: dataAnalysisTool.inputSchema,
    },
    dataAnalysisTool.execute,
  );
```
The MCP SDK's `registerTool` signature is typically `registerTool(name, schema, handler)` or similar. Here an object with `title`, `description`, `inputSchema` is passed as the second argument. This looks like it might be the correct shape for some versions of the SDK (e.g., the object represents the tool definition). But passing a Zod schema as `inputSchema` inside that object - if the SDK doesn't automatically convert Zod to JSON Schema, the `initialize` or `tools/list` response will contain an invalid schema. This is a protocol issue.

Wait, in the newer MCP SDK for TypeScript, `server.registerTool` might accept a Zod schema directly if using the high-level API. But the cast to `any` suggests the types don't match. This is suspicious.

**Specific issues to list:**

1. **Severity: High** - Missing timeout / blocking event loop. `parseCsv` and `JSON.parse` are synchronous and unbounded. Input size limit is only checked after parsing (row count), not byte size. A huge payload can cause DoS/hang.
   - Location: `parseRows` function, `execute` function.
   - Issue: Synchronous parsing of unbounded input without byte-size limits or timeouts. `MAX_ROWS` is enforced post-hoc on array length, but parsing a multi-gigabyte string blocks the event loop and exhausts memory.
   - Fix: Add a pre-parse byte-size limit (e.g., 1MB). Use streaming CSV parser for large inputs, or offload to a worker thread. Add an execution timeout wrapper.

2. **Severity: High** - MCP protocol error envelope violation.
   - Location: `execute` function return values, `dataAnalysisTool.execute` wrapper.
   - Issue: Errors (parse failures, empty data) are returned as `text` content with `ok: false` JSON instead of setting `isError: true` in the tool result. The MCP client sees a successful tool execution containing an error payload, violating protocol semantics.
   - Fix: Return `{ content: [...], isError: true }` for error cases. Or throw an error and let the SDK map it to a JSON-RPC error. Ensure error messages are in `content` but `isError` is set.

3. **Severity: Medium** - Invalid tool schema for MCP protocol.
   - Location: `registerDataAnalysisTool`, `dataAnalysisTool.inputSchema`.
   - Issue: `inputSchema` is a Zod object. The MCP SDK `registerTool` expects a JSON Schema object. Passing a Zod schema may serialize incorrectly over the wire (e.g., as empty object or with Zod-specific symbols), causing client-side validation failures or broken tool discovery.
   - Fix: Convert the Zod schema to JSON Schema using `zod-to-json-schema` before registration, or use the SDK's native Zod support if available (remove `as any` and verify types).

4. **Severity: Medium** - Unhandled exception on null/undefined args.
   - Location: `execute` function signature `args: DataAnalysisInput`, called from wrapper with `args: any`.
   - Issue: If the MCP SDK passes `undefined` or `null` args (edge case, schema bypass), `args.data` throws a synchronous TypeError before `String()` coercion. Since `execute` is async, this creates a rejected promise. If the wrapper doesn't catch it, it becomes an unhandled rejection or crashes the SDK handler.
   - Fix: Defensive coding: `const rawData = String(args?.data ?? "").trim();` and `const format = args?.format ?? "csv"`.

5. **Severity: Medium** - Output size unbounded / MCP transport limits.
   - Location: `execute` return, `JSON.stringify({ ok: true, data: result })`.
   - Issue: The result object contains `stats`, `kpis`, `table`, and `sample`. For wide CSVs (many columns), `stats` and `table` can be very large. `JSON.stringify` can exceed MCP message size limits or buffer limits, causing transport failures or silent truncation.
   - Fix: Add output size limits (e.g., max columns, max string length per cell). Truncate or paginate table output. Check serialized size before returning.

6. **Severity: Medium** - CSV parse options unsafe (`relax_quotes: true`).
   - Location: `parseRows` CSV branch.
   - Issue: `relax_quotes: true` can allow quote escaping issues that might cause parser misbehavior or infinite loops on malicious input in some versions of `csv-parse`. Combined with unbounded input, this is risky.
   - Fix: Remove `relax_quotes` unless strictly necessary, or validate input structure before parsing.

7. **Severity: Low** - `MAX_ROWS` truncation without warning.
   - Location: `execute` function.
   - Issue: Data is silently truncated to 500 rows. The user/client is not informed that the analysis is incomplete. This can lead to incorrect conclusions.
   - Fix: Include a `truncated: true` flag and `total_rows: allRows.length` in the result when truncation occurs.

8. **Severity: Low** - Type inference bug: `isNaN` on empty string after trim.
   - Location: `inferType`, `toNumber`.
   - Issue: `isNaN(Number(v as string))` - `Number("")` is `0`, not `NaN`. But `v.trim() !== ""` is checked in `toNumber`. In `inferType`, the check is `(v as string).trim() !== "" && !isNaN(Number(v as string))`. This is actually okay because empty string is filtered. However, `Number(" ")` is `0`, and `isNaN(Number(" "))` is false. But `trim()` is checked first. What about strings like `"0x10"`? `Number("0x10")` is 16, `isNaN` is false. Hex strings treated as numbers. Also `Infinity`, `-Infinity`, `1e309` (becomes Infinity). `isNaN` is false for Infinity. `Math.min/max` with Infinity might be okay but skews stats. `mean` calculation with Infinity becomes Infinity.
   - Fix: Use `Number.isFinite()` instead of `!isNaN()` to exclude `Infinity`, `-Infinity`, and ensure strict decimal/float parsing.

9. **Severity: Low** - Missing cleanup / resource leak potential.
   - Location: N/A (general).
   - Issue: While no explicit streams are opened, the synchronous CSV parser allocates large internal arrays for records. In a long-running server under heavy load, repeated large-parse requests can cause memory fragmentation. Not a leak per se, but no `try/finally` or explicit memory management.
   - Fix: Not critical, but ensure `records` variable goes out of scope (it does). Use streaming for large inputs.

10. **Severity: Medium** - Race condition / Reentrancy on shared state? No shared state found. The module is stateless. So no race condition on shared mutable state. But the event loop blocking is a concurrency hazard.

Let me reconsider the "Unhandled rejections" category. The prompt specifically asks for unhandled rejections.
- If `execute` throws, the promise rejects. The wrapper `dataAnalysisTool.execute` is `async (args: any) => { ... }`. If `execute(args)` rejects, the wrapper's promise rejects. The MCP SDK should catch this. But if the SDK doesn't catch it properly, it's an unhandled rejection. However, the bigger issue is that the code doesn't handle the case where `args` is not an object.

Actually, looking at the wrapper:
```typescript
execute: async (args: any) => {
    const resultText = await execute(args as DataAnalysisInput);
    return {
      content: [{ type: "text" as const, text: resultText }],
    };
  },
```
If `execute` throws synchronously (which it can't because it's async), but if `args` is null, `execute` will throw synchronously when entering the function? No, `execute` is declared as `async function execute`. Accessing `args.data` when `args` is null will throw a TypeError. Since it's inside an async function, the exception is caught by the async machinery and turns into a rejected promise. So `await execute(...)` will reject. The wrapper doesn't have try/catch, so the wrapper's returned promise rejects. The SDK's `registerTool` handler should catch this. But if the SDK expects errors to be thrown, that's fine. However, the prompt asks about unhandled rejections. If the SDK doesn't catch it, it's unhandled. But more importantly, the *tool result* doesn't set `isError`.

Wait, is there any other unhandled rejection? `parseCsv` is sync. `JSON.parse` is sync. No other async operations. So the only rejection path is through exceptions in the async function.

What about the `registerTool` call? `(server.registerTool as any)` - if `registerTool` is not a function or undefined, this throws synchronously. But that's at startup, not during request handling.

Let's think about MCP protocol edge cases more deeply.
- **Tool result shape**: MCP requires `content` array. The code returns that. Good.
- **Error handling**: The MCP spec says tool errors should be returned with `isError: true`. The code does not do this. This is a protocol edge case / correctness issue.
- **Schema**: The `inputSchema` being Zod is likely wrong for the wire format unless the SDK explicitly handles conversion. If the SDK uses the Zod schema for validation but sends a JSON Schema derived from it to the client, that's fine. But if it sends the Zod object, the client gets garbage. Given the `as any`, it's likely bypassing type checks that would enforce JSON Schema. This is a protocol issue.
- **Timeouts**: MCP protocol doesn't mandate server-side timeouts, but missing them is a server-node issue.

Let me structure the table. I need to be thorough but concise.

| severity | location | issue | fix |

Rows:
1. **Critical/High**: Blocking parse + no timeout. `parseRows`, `execute`. Synchronous `parseCsv`/`JSON.parse` on unbounded input with no byte limit or timeout; `MAX_ROWS` enforced only after full materialization. Event loop blocking / OOM / DoS. Add byte-size check before parsing; use streaming CSV; wrap in `setTimeout` or worker; enforce `MAX_ROWS` during parse if possible.
2. **High**: MCP error envelope. `dataAnalysisTool.execute`, `execute` returns. Errors returned as `text` content with `ok:false` JSON but missing `isError:true`, violating MCP protocol semantics. Return `{ content: [{type:"text", text:...}], isError: true }` for failures; or throw and let SDK handle.
3. **Medium**: Invalid schema type. `registerDataAnalysisTool`, `inputSchema`. `inputSchema` is a Zod object passed to MCP SDK which expects JSON Schema; `as any` hides type mismatch. Client receives invalid schema in `tools/list`. Convert Zod to JSON Schema via `zod-to-json-schema` or use SDK-native Zod API correctly.
4. **Medium**: Unhandled rejection on malformed args. `execute` parameter access. If `args` is `null`/`undefined` (bypassed schema), `args.data` throws TypeError → rejected promise; wrapper has no catch. Defensively access `args?.data ?? ""` and `args?.format`.
5. **Medium**: Unbounded output / transport limits. `execute` return. Result can exceed MCP message size (many columns/wide rows) causing transport failure or silent truncation. Limit columns processed, truncate cell strings, cap output size, or paginate.
6. **Medium**: Unsafe numeric coercion. `inferType`, `toNumber`. `!isNaN(Number(v))` accepts `Infinity`, hex, scientific notation; `Number(" ")` is `0` but trimmed. Use `Number.isFinite()` after regex/strict parse; reject non-decimal formats.
7. **Low**: Silent data truncation. `execute` row slice. Rows truncated to `MAX_ROWS` without notifying client, leading to silent incomplete analysis. Include `truncated: true` and `total_rows: allRows.length` in result.
8. **Low**: CSV parse injection/malformation. `parseRows` CSV. `relax_quotes: true` can mask malformed CSV and in some versions cause parser hangs on edge-case quote patterns. Remove unless required; pre-validate quotes or use strict parsing.

Are there any race conditions? The code is stateless. No shared mutable state. So no classic race conditions. However, event loop blocking creates a concurrency hazard where subsequent requests race to get event loop time. I'll mention this as a concurrency issue rather than a race condition, or skip if not applicable. The prompt asks for race conditions. I should be careful. If there's no true race condition, I shouldn't invent one. But "event loop blocking causing request starvation" is not a race condition. I'll skip race conditions unless I find one.

Wait, is there a race condition in the error handling? No.

Resource leaks? No streams or handles opened. Memory is allocated but released when function returns. Not a leak. But the prompt asks for resource leaks. I could mention that large sync parsing holds memory longer than necessary, but that's not a leak. I'll skip or frame as "memory pressure" not leak.

Let me double check the `parseCsv` options. `relax_quotes: true` - this is indeed a risky option. In `csv-parse`, `relax_quotes` allows quotes inside unquoted fields. It can lead to weird behavior.

What about `JSON.parse`? It can throw on circular references? No, `JSON.parse` doesn't throw on circular, it throws on invalid syntax. But `input.data` is a string. If it's huge, it blocks.

Another issue: `records = parseCsv(...)` returns an array. The type assertion `as Record<string, unknown>[]` is unsafe. If `columns: true` and the CSV has no header row, `csv-parse` might return arrays instead of objects, or empty objects. Actually, `columns: true` uses the first line as headers. If the first line is empty or has issues, it might return arrays. The type assertion hides this. Then `Object.keys(rows[0] ?? {})` might fail or produce wrong headers if rows[0] is an array. This is a bug.

Location: `parseRows` CSV branch.
Issue: `parseCsv` with `columns: true` can return array-of-arrays if the data has no header line or is malformed, but the code asserts `Record<string, unknown>[]`. Subsequent `Object.keys(rows[0])` on an array yields numeric indices, not column names.
Fix: Validate that every row is a plain object, not an array. Or use `columns: (header) => header.map(...)` and validate.

Actually, `csv-parse/sync` with `columns: true` returns objects if the first row is a valid header. If the input is empty (but `skip_empty_lines: true`), and there are no records, it returns `[]`. But if the first row is data without headers, it still uses the first row as headers. However, if `columns: true` and the input has zero lines, it returns `[]`. If input has one line, it returns `[]` because the line is consumed as header? Actually, I think with `columns: true`, if there's only one line, it returns `[]` (no data rows). But if the first row is empty, behavior varies. The type assertion is still risky.

Let's add this:
Severity: Medium. Location: `parseRows` CSV return. Issue: Unsafe type assertion `as Record<string, unknown>[]` on `parseCsv` result; if parser returns arrays (e.g., malformed CSV, missing headers), downstream logic breaks. Fix: Validate row shape at runtime; ensure each element is a plain object before casting.

Another issue: `MAX_ROWS` is 500. But `allRows` is the full parsed array. If input is 10 million rows, `allRows` is huge. The slice happens after. This is the blocking/oom issue I already covered.

Another issue: `buildKpis` uses `s.unique === 2` for boolean-like detection. But `unique` is `new Set(values.map((v) => String(v ?? ""))).size`. For booleans, `String(true)` is `"true"`, `String(false)` is `"false"`. So unique count is 2. But for strings with only two distinct values, it's also 2. The logic pushes KPI for `s.type === "string" || s.type === "boolean"` when unique is 2. This seems intentional (categorical). Not a bug.

Another issue: `question_note` is spread into result. If `question` contains malicious text? It's just echoed. Not a bug.

Another issue: `z.object({...})` schema
