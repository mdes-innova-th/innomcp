<!-- cc-team deliverable
 group: G1 (typesafety division)
 member: TYP-016 role=typesafe model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2576,"completion_tokens":2426,"total_tokens":5002,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2117,"image_tokens":0},"cache_creation_input_tokens":0} | 27s
 generated: 2026-06-13T12:01:01.181Z -->
| severity | location | unsafe pattern | safer fix |
|----------|----------|---------------|-----------|
| **High** | `callImageGen` – gateway fallback (≈ line 128) | `catch (err: any)` – the `any` type bypasses all type checks and suppresses error shape safety | Use `catch (err: unknown)` and narrow with `instanceof Error` to access `.message` safely |
| **High** | `callImageGen` – pollinations fallback (≈ line 140) | `catch (err: any)` – same as above | Change to `catch (err: unknown)` and narrow before reading `.message` |
| **Medium** | `callGateway` – `await res.json()` (≈ line 70) | `res.json()` returns `Promise<any>`, making `json` implicitly `any` with no compile‑time shape guarantees | Declare an interface for the expected JSON response (e.g. `GatewayResponse`) and cast: `const json = await res.json() as GatewayResponse` |
| **Low** | `callImageGen` – adapted prompt guard (≈ line 108) | `opts.adaptedPromptEn && opts.adaptedPromptEn.trim()…` – treats empty string (falsy) as missing, may drop a valid zero‑length adapted prompt | Explicitly test `typeof opts.adaptedPromptEn === 'string' && opts.adaptedPromptEn.trim().length > 0` |
