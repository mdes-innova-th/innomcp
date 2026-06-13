<!-- cc-team deliverable
 group: G1 (deadcode division)
 member: DEA-020 role=deadcode model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1834,"completion_tokens":586,"total_tokens":2420,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 20s
 generated: 2026-06-13T12:02:54.712Z -->
# Dead/Unused Code Audit: `mdesModelCache.ts`

After thorough review, this module is **tight and well-used internally**. No dead code, commented-out blocks, unreachable branches, or duplicate logic were found. Below are observations, including items considered and rejected.

## Findings

| # | Location | What | Why safe to remove / status |
|---|----------|------|------------------------------|
| — | — | — | **No high-confidence dead code found.** |

## Considered & Rejected (not flagged)

| Candidate | Reason rejected |
|-----------|-----------------|
| `// 5 minutes` comment on `TTL_MS` | Useful inline documentation, not commented-out code. |
| `// go to reasoning fallback` and `// generic largest selection below` comments inside `getBestModelForTask` switch cases | Intentional flow documentation explaining the shared tail; not dead branches. |
| `// lack of quantization_level counts as 0` comment in `fast` case | Explains non-obvious default; not commented-out code. |
| `// default to a large number if unrecognized` comment in `sizeValue` | Documents a deliberate sentinel value. |
| `// If cache exists, return stale cache to avoid service disruption` comment | Explains intentional resilience behavior, not dead logic. |
| `MDESModel.details.parameter_size` / `family` / `quantization_level` optional fields | All consumed in `getModelFamilies` and `getBestModelForTask`. |
| `getStats().ttlRemaining` field | Public API surface; cannot determine external usage of this shape from the file alone. |
| `mdesModelCache` exported singleton | Standard pattern; usage outside this module isn't visible here. |
| `OllamaTagsResponse` interface (not exported) | Used internally by `getModels`; not dead. |
| `warmUp()` | Could be unused if not called at server start, but it's a public method that documents an intended lifecycle hook — flagging would not be high-confidence. |
| `isModelAvailable` and `getModel` convenience methods | Single-line wrappers, but they form part of the module's public surface; usage can't be verified from this file alone. |

## Recommendation

**No removals warranted.** The module has no commented-out code blocks, no unreachable branches, no redundant conditions, and no duplicate logic. All exports, methods, and fields are referenced either internally or form a coherent public API whose external consumers cannot be determined from this file in isolation.

If you want a **secondary review** that flags *speculative* cleanup (e.g., consolidating `getModel`/`isModelAvailable` into inline `.find`/`.some` at call sites, or inlining `sizeValue` if only used twice), let me know and I can produce a lower-confidence list separately.
