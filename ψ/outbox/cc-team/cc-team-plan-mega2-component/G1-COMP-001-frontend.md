<!-- cc-team deliverable
 group: G1 (component division)
 member: COMP-001 role=frontend model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1038,"completion_tokens":1546,"total_tokens":2584,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1221,"image_tokens":0},"cache_creation_input_tokens":0} | 22s
 generated: 2026-06-13T12:06:54.648Z -->
| Severity | Location | Issue | Fix |
|----------|----------|-------|-----|
| N/A | `innomcp-next/src/apikeymiddleware.ts` (entire file) | No React component detected. Audit criteria (unnecessary re-renders, missing memo/keys, effect dependency bugs, state-in-render, prop drilling, error boundaries missing, unsafe `dangerouslySetInnerHTML`, hydration risks) do not apply to this server‑side middleware. | Not applicable. |
| Medium | `checkRateLimit` function – `console.log('[checkRateLimit] API Key ID: ${apiKeyData.apikey_id}, … IP: ${ip}')` | Logging the API key ID and client IP on every rate‑limit check may expose sensitive identifiers in logs, creating a security and privacy risk. | Remove or redact identifying details in production logs, use a debug‑level logger that can be turned off, or avoid logging API key ID and IP. |
| Low | `apiKeyMiddleware` – `@ts-expect-error` for `req.ip` | The `@ts-expect-error` comment silences TypeScript, but `req.ip` may genuinely be absent. If missing, the code falls back to `"unknown"`, which is acceptable but weakens IP‑based rate limiting. | Use `req.socket?.remoteAddress` (if available in Node.js runtime) or rely solely on the `x-forwarded-for` / `x-real-ip` headers, removing the need for `req.ip`. |
