<!-- cc-team deliverable
 group: G1 (typesafety division)
 member: TYP-006 role=typesafe model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1441,"completion_tokens":1047,"total_tokens":2488,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":854,"image_tokens":0},"cache_creation_input_tokens":0} | 14s
 generated: 2026-06-13T11:58:42.643Z -->
| severity | location | unsafe pattern | safer fix |
|----------|----------|----------------|------------|
| medium | `processNext()` line: `const item = this.queue.shift()!;` | Non-null assertion (`!`) on `shift()` result, which returns `undefined` if queue empty | Replace with a guard: `const item = this.queue.shift(); if (!item) { // should never happen but handle safely }` or restructure loop to ensure element exists before shift |
| low | `processNext()` line: `(error) => { ... }` in `.then()` error callback | Implicit `any` on the `error` parameter, as the callback expects `(reason: any) => void` from `Promise.then` | Explicitly type the parameter as `unknown` and narrow inside: `(error: unknown) => { ... item.deferred.reject(error); }` |
