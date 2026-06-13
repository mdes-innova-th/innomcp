<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D031 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1666,"completion_tokens":704,"total_tokens":2370,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":205,"image_tokens":0},"cache_creation_input_tokens":0} | 9s
 generated: 2026-06-13T11:24:05.047Z -->
- **`GuardResult`** (interface) — Describes the outcome of a safety check.  
  - `ok: boolean` – whether the event passed all gates  
  - `reason?: string` – human‑readable failure reason  
  - `forbiddenKey?: string` – set if a forbidden key was found  
  - `forbiddenSubstring?: string` – set if forbidden visible text matched  
  - `shapeError?: string` – set if `validateAgentEvent` returned an error  

- **`checkAgentEventSafe(ev: AgentEvent, opts?)`** — Verifies an `AgentEvent` is safe for the SSE stream by scanning serialized JSON for forbidden key names (case‑insensitive) and checking visible text fields (`publicSummary`, `deltaText`, `finalText`, `fallbackReason`) for forbidden literals, the word “placeholder” (with word boundaries), and optionally “Used tools: none”.  
  @param `opts.allowMapTerms` (default `false`) – when truthy, skips only the “placeholder” word check (map‑related literal strings are still rejected).  
  @param `opts.expectedToolUsage` (default `false`) – when truthy, “Used tools: none” in visible text is considered a violation.  
  @returns `GuardResult` — `{ ok: true }` if safe; otherwise `{ ok: false, reason, … }`.  
  **Caveat**: The guard is intentionally a dumb string scanner (not type‑based) to catch runtime‑injected fields spread from untyped sources.

- **`checkVisibleTextSafe(text: string, opts?)`** — Convenience wrapper that wraps an arbitrary string as a `draft_delta` event and passes it to `checkAgentEventSafe`.  
  @param `opts` — same options as `checkAgentEventSafe`.  
  @returns `GuardResult` — directly from the delegated check.  
  **Caveat**: The envelope event uses placeholder values (`runId: "scan"`, `messageId: "scan"`, `publicSummary: "scan"`, `timestamp: new Date().toISOString()`) — only `deltaText` is meaningful. Shape‑validation may fail if the real event would have a different shape, but the main visible‑text gates still apply.
