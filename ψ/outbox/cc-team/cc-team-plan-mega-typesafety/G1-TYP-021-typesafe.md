<!-- cc-team deliverable
 group: G1 (typesafety division)
 member: TYP-021 role=typesafe model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2707,"completion_tokens":2891,"total_tokens":5598,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2599,"image_tokens":0},"cache_creation_input_tokens":0} | 37s
 generated: 2026-06-13T12:02:24.948Z -->
| severity | location | unsafe pattern | safer fix |
|----------|----------|----------------|------------|
| high | `recordTurnAndGetMeta` (retrievalMode ternary) | Unsafe cast `plan.decision as RetrievalMode` without runtime validation that the remaining value actually fits `RetrievalMode` | Replace with a type‑safe mapping: `const modeMap: Record<string, RetrievalMode> = { hot: "hot", cold: "both", both: "both" }; retrievalMode: modeMap[plan.decision] ?? "none"`. |
| medium | `extractEntities` parameter `toolResult?: any` | Explicit `any` type loses all type safety; value is never used but could be passed unsafely | Change to `toolResult?: unknown` so callers must narrow before use. |
| medium | `recordTurnAndGetMeta` parameter `toolResult?: any` | Same explicit `any` (unused) | Change to `toolResult?: unknown`. |
| medium | `enrichGroundedContract` parameter `structuredContent: any` | Parameter is typed `any`, bypassing checks on the object shape beyond the first guard | Change to `structuredContent: unknown` and use a type predicate or `in` guard: `typeof structuredContent === "object" && structuredContent !== null && "__groundedContract" in structuredContent`. |
