<!-- cc-team deliverable
 group: G1 (typesafety division)
 member: TYP-019 role=typesafe model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1406,"completion_tokens":2289,"total_tokens":3695,"prompt_tokens_details":{"cached_tokens":32,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1823,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 18s
 generated: 2026-06-13T12:01:19.255Z -->
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| High | `callTool` catch block | Untyped catch / Unsafe cast: `catch (err) { const e = err as { name?: string; status?: number; message?: string }` | Type `err` as `unknown` and use type guards: `const message = err instanceof Error ? err.message : String(err); const status = typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number' ? err.status : undefined;` |
| High | `requestOnce` | Unsafe cast: `new Error(...) as Error & { status: number }` | Define a custom error class: `class McpHttpError extends Error { readonly status: number; constructor(msg: string, status: number) { super(msg); this.status = status; } }` and throw it |
| Medium | `requestOnce` | Unsafe JSON parse / implicit any: `(await resp.json()) as T` | Parse via `JSON.parse(await resp.text())` and validate the payload against a runtime schema (e.g., Zod) before assigning to `T`, or return `McpToolResult<unknown>` and let callers assert |
| Low | `isAvailable`, `safeReadText` | Untyped catch: `catch { return false; }` / `catch { return ""; }` | Bind the error explicitly as `catch (err: unknown)` and log it before swallowing, ensuring network failures aren't silently dropped during debugging |
