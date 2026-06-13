<!-- cc-team deliverable
 group: G1 (apicontract division)
 member: APIC-023 role=contract model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1065,"completion_tokens":5000,"total_tokens":6065,"prompt_tokens_details":{"cached_tokens":57,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 48s
 generated: 2026-06-13T12:13:19.831Z -->
The user wants an API contract audit of the provided Express route handler. I need to analyze the code for:

1. Missing input validation
2. Inconsistent response shapes
3. Status-code correctness
4. Missing error responses
5. Undocumented params
6. Breaking-change risks

Then output a table with columns: | severity | endpoint | issue | fix |

Let me go through the code carefully.

**POST /api/model-settings/test**

Issues I can identify:

1. **No validation on `provider` field**: The interface says `provider: string` and it's destructured from body, but never validated or used in the logic. It's accepted but ignored. This is an undocumented/misleading param.

2. **No URL validation on `baseUrl`**: It just checks if it's truthy. Could be any string, not a valid URL. Could lead to SSRF or weird fetch behavior.

3. **No validation on `apiKey` type or length**: Just checks if truthy.

4. **No validation on `modelName`**: Just checks if truthy. Could be empty string, number, etc.

5. **Inconsistent response shapes / Status code correctness**:
   - On success: returns 200 (implicit) with `{ success: true, latencyMs, model, sample }`
   - On HTTP error from upstream: returns 200 (implicit via `res.json`) with `{ success: false, latencyMs, error }`. This is wrong - the endpoint itself succeeded in testing, but the upstream failed. However, returning 200 for a failed test is debatable. Actually, in this design pattern (test endpoint), returning 200 with success:false is a common pattern because the test itself completed. But wait - is it? The issue is that the status code is always 200 even when the upstream returns 4xx/5xx. But that's probably intentional for a "test" endpoint. However, looking at the catch block, it also returns 200 with success:false. This is actually a design choice, but could be considered "status-code correctness" if we expect the endpoint to reflect the test outcome. But more importantly...
   - Wait, in the `!r.ok` block, it returns `res.json(result)` without a status code. That's 200. But the upstream API returned an error. Is this correct? For a test endpoint, yes, the test completed successfully (the connection was made), so 200 is appropriate. But I should flag it as a potential issue if clients expect HTTP error codes.
   - Actually, looking more carefully: the catch block catches network errors (fetch failures, aborts) and returns 200 with success:false. That's fine for a test endpoint.
   - But what about the `if (!baseUrl || !modelName)` block? It returns 400. That's correct.

6. **Missing error responses**: The OpenAPI/contract likely doesn't document what happens for:
   - Missing fields (400 is returned but not fully specified)
   - Upstream HTTP errors (returns 200 with success:false shape)
   - Network timeouts (AbortController) - returns 200 with success:false but error message truncated
   - Invalid JSON from upstream? If `r.json()` fails, it goes to catch block. That's handled but returns 200.

7. **Undocumented params**: `provider` is in the interface/body but never used in the implementation. It's accepted but ignored. This is a contract mismatch.

8. **Breaking-change risks**:
   - Adding `provider` now but not using it means if they later start using it to route to different logic, it could break clients who were sending garbage.
   - The `TestResult` interface includes optional fields. If clients depend on `error` being present only on failure, that's fine, but the shape changes based on success/failure. `model` and `sample` only on success, `error` only on failure. This is somewhat inconsistent but common. However, it's not fully inconsistent because `success` boolean discriminates it.
   - Actually, looking at the response shape: success=true has `success, latencyMs, model, sample`. success=false has `success, latencyMs, error`. This is a union type. It's not necessarily inconsistent if documented as such, but could be flagged as "discriminated union not documented".

9. **Security/SSRF**: `baseUrl` is not validated. Could fetch internal URLs. This is an API contract issue because the parameter accepts any string without schema validation.

10. **Type safety**: `req.body as TestBody` is a type assertion, bypassing any runtime validation. This is a missing input validation issue.

11. **GET /api/model-settings/providers**:
    - Hardcoded list. No issues with response shape really, but if this is meant to be dynamic later, it's a breaking change risk? Not really.
    - Wait, the `defaultUrl` for "custom" is empty string `""`. If UI uses this directly, might cause issues. But that's more of a data issue.
    - The response shape is `{ providers: [...] }`. Each provider has `id, label, defaultUrl, needsKey, defaultModel`. This seems consistent.
    - Are there missing error responses? Not really, it's a static endpoint. Unless database failure is expected, but it's hardcoded.

12. **POST /test specific issues**:
    - `apiKey` is optional but if provided, used as Bearer token. No validation.
    - The `AbortController` timeout is 8 seconds. Not documented.
    - `max_tokens: 5` is hardcoded. Not an API contract issue per se.
    - `sample` is truncated to 60 chars. `error` is truncated to 120 chars. This truncation is not documented.
    - If `fetch` throws (network error), `latencyMs` is calculated from `start` which is before the try block. That's fine.
    - But wait: if `fetch` succeeds but `r.json()` fails (malformed JSON), it goes to catch block and returns 200 with success:false. That's a "test failed" scenario. But the status code is 200. Is that correct? For a test endpoint, probably yes.

13. **Missing status codes in responses**:
    - The success and catch blocks both call `res.json()` without explicit `.status(...)`. This defaults to 200. For the catch block (network error), 200 is arguably correct because the test endpoint itself worked. But for the `!r.ok` block, same thing.
    - However, if the server itself has an error (e.g., `Date.now()` fails? No), but what about if `err` is not an Error? It handles that.

14. **Input validation specifics**:
    - `baseUrl` could be "   " (whitespace) and pass `if (!baseUrl)`.
    - `modelName` could be "   " and pass.
    - No check if `baseUrl` is a valid URL format.
    - No check if `provider` is from an allowed enum. It's typed as `string` but unused.

15. **Undocumented behavior**:
    - The endpoint appends `/chat/completions` to `baseUrl` after removing trailing slash. So the actual URL is derived. This is important contract behavior.
    - It sends a specific payload (`messages: [{role:"user", content:"Hi"}]`, `max_tokens:5`, `stream:false`). This is the "test probe" and should be documented.
    - It sends `Authorization: Bearer <apiKey>` if provided.

Let me structure the table.

Severity levels: Critical, High, Medium, Low, Info.

Issues to include:

1. **Critical/High**: Missing runtime input validation (type assertion bypass). `req.body as TestBody` means any JSON structure is accepted. Could pass objects/arrays as strings, causing runtime errors or weird behavior. Severity: High.
   - Endpoint: POST /test
   - Issue: No runtime input validation; relies on TypeScript assertion `as TestBody`, allowing malformed payloads (objects/arrays sent as strings, wrong types, extra fields).
   - Fix: Use a validation library (Zod, Joi, class-validator) to enforce `baseUrl` (URL format), `modelName` (non-empty string), `apiKey` (optional string), and reject unexpected fields.

2. **High**: SSRF / arbitrary URL fetch. `baseUrl` is not validated as a URL. Could be `file://`, `http://169.254.169.254/`, etc. Though `fetch` in Node might not support file://, it's still a risk.
   - Endpoint: POST /test
   - Issue: `baseUrl` accepts arbitrary strings without URL schema/hostname validation, enabling SSRF and open redirects.
   - Fix: Validate `baseUrl` with `new URL(baseUrl)` and enforce allowed protocols (http/https) and optionally block internal IPs.

3. **Medium**: Unused parameter `provider` accepted but ignored.
   - Endpoint: POST /test
   - Issue: `provider` is declared in the contract/interface and destructured from body but never used; clients may send invalid values that later become breaking changes when implemented.
   - Fix: Either implement provider-based routing or remove `provider` from the request contract until needed.

4. **Medium**: Inconsistent/discriminated response shape not documented.
   - Endpoint: POST /test
   - Issue: Response shape varies by outcome (`model`+`sample` on success vs `error` on failure); clients must branch on `success` boolean without documented union schema.
   - Fix: Document the discriminated union response schema (OpenAPI `oneOf`) or normalize fields (e.g., always include `error` as null).

5. **Medium/Low**: Status code correctness for failed tests.
   - Endpoint: POST /test
   - Issue: Upstream failures (HTTP 4xx/5xx) and network errors are returned as HTTP 200 with `success: false`, which can confuse HTTP-level monitoring and retries.
   - Fix: Consider using HTTP 200 for successful test execution with failed result (document clearly), OR return 502/504 for upstream/network errors and 200 only for successful connection tests. Actually, the current pattern is common for "test" endpoints. But I should flag it. Let's say Medium. Fix: Document that HTTP 200 indicates the test probe completed, not that the upstream succeeded; or use 502 for upstream errors.

6. **Low**: Truncation of `sample` and `error` fields is undocumented.
   - Endpoint: POST /test
   - Issue: `sample` and `error` are silently truncated to 60/120 chars; clients expecting full content will lose data.
   - Fix: Document length limits or return full strings with a separate `truncated: true` flag.

7. **Medium**: Missing error response documentation.
   - Endpoint: POST /test
   - Issue: Missing documented error responses for 400 (validation), 408 (timeout), 502/504 (upstream/downstream), and 500 (unexpected server error).
   - Fix: Add OpenAPI/contract docs for all possible status codes and error payload schemas.

8. **Low**: Breaking-change risk on `provider` field.
   - Endpoint: POST /test
   - Issue: `provider` is a placeholder; enabling it later will be a breaking change for clients not sending it or sending invalid values.
   - Fix: Remove the field from the contract until fully implemented, or default it to `"custom"` and document as no-op.

9. **Low/Medium**: Missing `Content-Type` validation / body parsing assumptions.
   - Endpoint: POST /test
   - Issue: Assumes `req.body` is parsed JSON; no check for `Content-Type: application/json` or malformed body handling (though Express body-parser handles this, it's not explicit in the handler).
   - Fix: Ensure body-parser middleware is documented as a dependency; validate `Content-Type`.

10. **Info**: GET /providers is hardcoded but lacks versioning/stability guarantees.
    - Endpoint: GET /providers
    - Issue: Hardcoded provider list; adding/removing providers changes the contract without versioning.
    - Fix: Version the endpoint (`/v1/...`) or document that the provider list is subject to change and clients should handle unknown IDs gracefully.

11. **Medium**: `baseUrl` normalization behavior undocumented.
    - Endpoint: POST /test
    - Issue: Trailing slash is stripped and `/chat/completions` is appended; clients sending URLs with paths may be surprised.
    - Fix: Document the URL construction logic or accept a full `endpointUrl` parameter.

12. **Low**: `apiKey` passed as plain string in memory, but more importantly, no validation of format.
    - Endpoint: POST /test
    - Issue: `apiKey` accepts any string (including empty string?) and injects it into the Authorization header. Empty string is falsy so it's skipped, but "Bearer " with a space? No, it checks `if (apiKey)`. If apiKey is `" "`, it passes. Not a huge issue.
    - Fix: Validate `apiKey` is a non-empty string when present.

13. **Medium**: Timeout duration (8s) is magic number and undocumented.
    - Endpoint: POST /test
    - Issue: 8-second AbortController timeout is not part of the documented contract.
    - Fix: Document the timeout or make it an optional request parameter `timeoutMs` with a max cap.

14. **High**: Potential crash if `req.body` is not an object.
    - Endpoint: POST /test
    - Issue: Destructuring `const { baseUrl, ... } = req.body as TestBody` will throw if `req.body` is null/undefined/string, causing an unhandled 500. Wait, actually destructuring null throws. But Express body parser usually gives `{}` for empty body. If body parser is not configured, it could be undefined. The `as TestBody` hides this.
    - Fix: Validate `req.body` is an object before destructuring.

Let me refine and select the best ones for the table. I want to cover all the categories the user asked: missing input validation, inconsistent response shapes, status-code correctness, missing error responses, undocumented params, breaking-change risks.

Selected rows:

| severity | endpoint | issue | fix |
|---|---|---|---|
| Critical | POST /test | No runtime input validation: uses `as TestBody` type assertion, allowing malformed/attack payloads (wrong types, missing fields, extra params) to reach business logic. | Replace assertion with schema validation (Zod/Joi) for `baseUrl` (valid URL), `modelName` (non-empty string), `apiKey` (optional string), and reject unknown properties. |
| High | POST /test | SSRF risk: `baseUrl` accepts arbitrary strings without URL/protocol validation, allowing internal network probing. | Enforce `new URL(baseUrl)` with allowed protocols (`http:`/`https:`) and optionally block private IP ranges. |
| High | POST /test | Missing validation on `req.body` structure: destructuring assumes an object; if body is null/scalar it throws an unhandled exception. | Add an `if (!req.body \|\| typeof req.body !== 'object')` guard before destructuring, or rely on schema validator. |
| Medium | POST /test | Undocumented & ignored param: `provider` is accepted in the interface/body but never used, creating a phantom contract field. | Remove `provider` from the request body until implemented, or document it as a no-op reserved field. |
| Medium | POST /test | Inconsistent response shape: success payloads include `model`+`sample`, failure payloads include `error`; no single schema or discriminator documented. | Document a discriminated union (OpenAPI `oneOf`) or normalize response to always include all keys (`error: null` on success, `model: null` on failure). |
| Medium | POST /test | Status-code ambiguity: upstream HTTP errors (4xx/5xx) and network timeouts are returned as HTTP 200 with `success: false`, masking failures from load balancers and retries. | Document that HTTP 200 means "probe completed", or return 502/504 for upstream/network failures and reserve 200 for successful connectivity. |
| Medium | POST /test | Missing documented error responses: contract lacks 400 (bad validation), 408/504 (timeout), 502 (bad gateway), and 500 (server error) schemas. | Add OpenAPI/contract definitions for every possible HTTP status code and a consistent error envelope (e.g., `{ status, code, message }`). |
| Medium | POST /test | Undocumented URL transformation: trailing slash is stripped and `/chat/completions` is appended, which may break providers using non-standard paths. | Document the path suffix behavior, or expose an `endpointPath` parameter with `/chat/completions` as the default. |
| Low | POST /test | Silent truncation: `sample` (60 chars) and `error` (120 chars) are hard-capped without notice, risking data loss for debugging. | Document max lengths in the contract, or return full values and let clients truncate. |
| Low | POST /test | Breaking-change risk: `provider` placeholder implies future routing logic; clients sending invalid values will break once enforcement is added. | Either remove `provider` now and re-introduce it in a v2, or validate and default it today to avoid future breakage. |
| Low | GET /providers | Hardcoded list is a hidden contract: adding/removing/reordering providers is a breaking change for UIs relying on index or specific IDs. | Version the endpoint (`/v1/providers`) and document that clients must tolerate unknown provider IDs and new fields. |

Wait, I need to make sure I don't have too many rows, but enough to be comprehensive. The user asked for a table. Let me check if there are any other issues.

One more: The `TestResult` on `!r.ok` path doesn't include `model` field, but the interface says `model?: string`. That's fine.

Another: The `latencyMs` includes the time to parse the error body or JSON body. That's fine for a test endpoint.

Another: `apiKey` is optional in interface but if passed as number/array via JSON, it will be coerced to string in template literal `Bearer ${apiKey}`. But with validation, this is fixed.

Another: The `provider` field in GET response has `needsKey: boolean`. In POST, `apiKey` is optional. No direct link.

Another: The GET endpoint returns 200 implicitly. That's fine.

Another: The POST endpoint doesn't check if `baseUrl` is empty string after trim. "   " passes. With URL validation, this is fixed.

Another: The `AbortController` timeout is not caught distinctly. If aborted, `err.message` is "The operation was aborted" or similar. It returns 200 with success:false. That's fine but could be documented as timeout.

I think my table is solid. Let me format it nicely.

Wait, the user wants the output as a table. I should ensure proper markdown table formatting.

Let me reconsider severity levels to be consistent and accurate.

- Critical: No runtime validation + type assertion (can crash or SSRF). I'll keep Critical for the input validation/SSRF combo, or split them. Actually, SSRF is High, missing runtime validation is High. Critical might be too strong unless there's a definite security exploit. But SSRF is pretty bad. I'll make SSRF High and missing runtime validation High. Or I can combine them. Let's make the first one High.

Actually, looking at the code, `baseUrl` is injected directly into fetch. If someone passes `baseUrl: "http://internal-service/api"`, it will hit it. That's SSRF. High is appropriate. Critical might be reserved for RCE or data loss. SSRF is High.

Let me adjust:

1. High - POST /test - No runtime input validation (type assertion, no URL validation, etc.) - Fix: Schema validator.
2. High - POST /test - SSRF via unvalidated baseUrl - Fix: URL validation + blocklist.
3. Medium - POST /test - Undocumented ignored param `provider` - Fix: Remove or implement.
4. Medium - POST /test - Response shape is implicit discriminated union - Fix: Document or normalize.
5. Medium - POST /test - Status code always 200 for upstream failures - Fix: Document or use 502.
6. Medium - POST /test - Missing error response docs (400, 502, 504, etc.) - Fix: Add OpenAPI specs.
7. Medium - POST /test - Undocumented path suffix `/chat/completions` - Fix: Document.
8. Low - POST /test - Silent truncation - Fix: Document limits.
9. Low - POST /test - Breaking change risk on `provider` - Fix: Remove placeholder.
10. Low - GET /providers - Hardcoded list stability - Fix: Version endpoint.

I think 10 rows is good. Let me make sure the "fix" column is actionable and concise.

One more thing: The user said "missing input validation, inconsistent response shapes, status-code correctness, missing error responses, undocumented params, breaking-change risks". I should ensure each of these categories is represented.

- Missing input validation: Row 1 (and 2 covers URL specifically).
- Inconsistent response shapes: Row 4.
- Status-code correctness: Row 5.
- Missing error responses: Row 6.
- Undocumented params: Row 3 (and 7 is undocumented behavior).
- Breaking-change risks: Row 9 (and 10).

Great.

Let me double check the code for any subtle issues.

In the `!r.ok` block:
```typescript
const body = await r.text().catch(() => "");
const result: TestResult = { ... };
return res.json(result);
```
If `r.text()` throws (unlikely but possible), it catches and returns "". That's fine.

In the catch block:
```typescript
const msg = err instanceof Error ? err.message : String(err);
```
This handles non-Error throws. Good.

But what if `err` is an object with custom toString? `String(err)` calls toString. Fine.

What about the `latencyMs` in catch? `Date.now() - start`. If the error happens quickly, it's small. If it happens after 8s (timeout), it's ~8000ms. Fine.

Is there any issue with `baseUrl.replace(/\/$/, "")` if `baseUrl` is not a string? If `baseUrl` comes as a number from JSON, `.replace` will throw because numbers don't have replace. But the type assertion says it's string. However, at runtime, if someone sends `{ "baseUrl": 123 }`, then `baseUrl` is 123, `!baseUrl` is false (123 is truthy), then `123.replace(...)` throws TypeError. This is a **runtime crash** (500 error) not handled by the catch block because the destructuring and replace happen before the try block!

Wait, look at the code:
```typescript
router.post("/test", async (req, res) => {
  const { baseUrl, apiKey, modelName, provider } = req.body as TestBody;

  if (!baseUrl || !modelName) {
    return res.status(400).json({ error: "baseUrl and modelName are required" });
  }

  const start = Date.now();

  try {
    // Normalise trailing slash
    const base = baseUrl.replace(/\/$/, "");
```
Yes! If `baseUrl` is a number (e.g., `123`), the destructuring works (JS
