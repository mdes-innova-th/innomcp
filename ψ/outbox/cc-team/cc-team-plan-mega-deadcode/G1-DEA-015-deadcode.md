<!-- cc-team deliverable
 group: G1 (deadcode division)
 member: DEA-015 role=deadcode model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1846,"completion_tokens":739,"total_tokens":2585,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 23s
 generated: 2026-06-13T12:02:00.991Z -->
# Dead/Unused Code Audit — `hotRetriever.ts`

## Summary

The module exports six public symbols (`RetrievalFact`, `normalizeWeatherFacts`, `normalizeEvidenceFacts`, `normalizeDeterministicFact`, `mergeRetrievalFacts`, `composeFactSummary`) and defines two private helpers. Based solely on the code provided, I cannot confirm whether any are unused, because **no import sites or call sites are visible in this excerpt**. A complete audit requires seeing all consuming modules.

## High-Confidence Flags (conservative)

| # | Location | What | Why safe to remove |
|---|----------|------|--------------------|
| — | — | — | Nothing flagged. |

## Conservative Observations (not yet flaggable)

| # | Location | What | Why I am *not* flagging yet |
|---|----------|------|-----------------------------|
| 1 | `query` parameter in `normalizeWeatherFacts` (line ~21) | Only passed to `extractWeatherEntities`; result goes into `entities` of the object-result branch. | The `query` parameter *is* used — it drives entity extraction. Not dead. |
| 2 | `query` parameter in `normalizeDeterministicFact` (line ~109) | Declared but never referenced in the function body. | High-confidence *local* dead — the parameter is unused inside this function. However, removing it is a **breaking signature change** for any external caller, so it should only be removed after confirming no caller passes it. Flagging as "verify caller" rather than "remove." |
| 3 | Module-level `factCounter` (line ~13) | Mutable global state shared across the module. | Not dead, but a code-smell; counter is reset only at process start, so `fact.id` uniqueness is process-lifetime. No action recommended. |
| 4 | Redundant ternary `typeof item === "string" ? item : JSON.stringify(item)` and `typeof results === "string" ? results : JSON.stringify(results)` | Type coercion repeated. | Not dead — both branches are reachable (caller could pass a string or object). Not redundant logic, just consistent. |
| 5 | Hardcoded province/region/ISP regexes (`extractWeatherEntities`, `extractISP`) | Magic patterns embedded in code. | Live code, not dead. Maintenance concern, not a dead-code concern. |

## Verification Steps Before Any Removal

To convert the above into actionable removals, the following are needed:

1. **Export usage check** — grep for each exported symbol across the repo:
   ```
   grep -rn "from .*hotRetriever" innomcp-node/src
   grep -rn "normalizeWeatherFacts\|normalizeEvidenceFacts\|normalizeDeterministicFact\|mergeRetrievalFacts\|composeFactSummary\|RetrievalFact" innomcp-node/src
   ```
2. **`query` parameter in `normalizeDeterministicFact`** — confirm via the grep above whether any caller actually passes a 4th argument. If not, the parameter can be dropped from the signature.
3. **Re-audit after import sites are known** — re-run with cross-references to catch exports that are never imported.

## Recommendation

Re-run this audit with the full repository context (or at minimum all `import` statements that reference `hotRetriever`). With only the single file provided, the only high-confidence local finding is the unused `query` parameter in `normalizeDeterministicFact`, and even that requires confirming no external caller depends on the 4-argument signature before removal.
