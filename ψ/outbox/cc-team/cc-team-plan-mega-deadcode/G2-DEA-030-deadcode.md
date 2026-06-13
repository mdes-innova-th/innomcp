<!-- cc-team deliverable
 group: G2 (deadcode division)
 member: DEA-030 role=deadcode model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":3458,"completion_tokens":671,"total_tokens":4129,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 94s
 generated: 2026-06-13T12:08:41.941Z -->
Looking at the provided snippet of `promptAdapter.ts`, I cannot make confident claims about dead/unused code for several reasons:

1. **The file is truncated** — I can only see the top portion (imports, types, `stripImageCommand`, and the start of the `GLOSSARY` array). The public exports `adaptImagePrompt` and `normalizePlannerQuery` are not visible in the snippet.
2. **No consumer information** — I have no way to verify whether exported types/functions are imported elsewhere in the codebase.
3. **Glossary entries** appear intentionally curated and order-sensitive per the comments; I cannot flag any as dead without runtime/usage data.

## Honest assessment: no high-confidence findings from the snippet

The conservative rule you asked for means I should not flag anything I can't verify. I do have one **structural observation** about visibility that the snippet does support:

| # | Location | What | Why safe to remove | Confidence |
|---|----------|------|--------------------|------------|
| — | — | — | — | — |

**No items flagged.** 

## What I would need to audit properly

To produce a reliable dead-code report for this module, please provide:

1. **The full file** (or at least from the `GLOSSARY` array onward through the two public functions `adaptImagePrompt` and `normalizePlannerQuery`).
2. **Grep results for imports of this module**, specifically:
   - `from ".*promptAdapter"`
   - References to `AdapterMode`, `AdaptedImagePromptResult`, `PlannerQueryResult`
   - References to `adaptImagePrompt`, `normalizePlannerQuery`
3. **Grep results for the two regexes** (`IMAGE_COMMAND_PREFIX_RE`, `IMAGE_COMMAND_REVERSE_RE`, `IMAGE_FILLER_RE`) and `stripImageCommand` — to confirm the comment "mirrors `imageGenService.cleanPrompt`" isn't a clue to genuine duplicate logic.
4. **Any LLM-fallback code paths** mentioned in the header (env-gated JSON-only with strict timeout) — the snippet doesn't reach them, but they're a common source of dead branches if the feature is partially implemented.

## Tentative leads (NOT to act on yet)

These are things the header/signature made me want to check, but I cannot confirm from the truncated snippet:

- **`AdapterMode = "passthrough"`** — the union includes a value the header doesn't describe. If `passthrough` is never assigned/returned, the type member may be dead, but the type itself may be part of a stable public contract.
- **`stripImageCommand` duplication** — header comment says it "mirrors `imageGenService.cleanPrompt`". If the mirror is byte-identical, one of the two is dead; if the comment is aspirational and only the regexes overlap, neither is dead. Need to see both.
- **Glossary ordering claim vs. actual sort** — header says "longer / more specific phrases first." The array *appears* to follow that, but without seeing the match algorithm and the rest of the entries, I can't confirm there are no shadowed entries.

Send the rest of the file plus the grep output and I'll give you a concrete, confidence-rated list.
