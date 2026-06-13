<!-- cc-team deliverable
 group: G1 (serverdeep division)
 member: SERV-014 role=audit model=zai-org/GLM-5.1
 finish_reason: length | tokens: {"prompt_tokens":2306,"completion_tokens":5000,"total_tokens":7306,"prompt_tokens_details":{"cached_tokens":32,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4861,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 61s
 generated: 2026-06-13T12:12:19.854Z -->
# Deep Bug Audit: `audioTranscribeTool.ts`

| severity | location | issue | fix |
|---|---|---|---|
| **HIGH** | `transcribeViaOpenAI` / `transcribeViaGateway` | **No fetch timeout** — `fetch()` calls have no `AbortController` / timeout. A hung TCP connection or unresponsive backend blocks the tool (and the MCP transport) indefinitely. | Create `AbortController` with `setTimeout(() => ac.abort(), 30_000)`; pass `signal: ac.signal` to every `fetch`. |
| **HIGH** | `loadAudioBytes` (base64 path) | **Unbounded memory allocation before size check** — `Buffer.from(payload, "base64")` materialises the entire decoded buffer in memory *before* the `MAX_BYTES` guard. A malicious 1 GB+ base64 string causes OOM. | Add a Zod `.max()` on `audioBase64` (≈ 34 MB to leave headroom for 25 MB decoded). Better: stream-de
