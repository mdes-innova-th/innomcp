# Opus Next Prompt — 2026-04-29
**สำหรับ:** Claude Opus 4.7
**สถานะก่อนส่ง:** local working tree includes health-path fixes; current open work is Phase 6 language-routing + response-composition

---

## PROMPT (คัดลอกไปวาง)

---

You are a senior software engineer continuing work on the `innomcp` project.

### Read these files first

1. `docs/4Opus/00_MASTER_BRIEFING.md`
2. `docs/4Opus/01_OUTSTANDING_ISSUES.md`
3. `docs/4Opus/03_PHASE_BACKLOG.md`
4. `docs/4Opus/05_CODEBASE_MAP.md`
5. `docs/4Opus/09_LANGUAGE_ROUTING_AND_COMPOSITION_PLAN.md`

### Problem to solve

The current image-generation flow works technically, but Thai prompts still produce poor images compared with English prompts.

Verified current state:
- `innomcp-node/src/services/imageGenService.ts` only strips prefixes in `cleanPrompt()`; it does **not** translate or enrich Thai visual prompts.
- `innomcp-node/src/routes/api/chat.ts` sends the raw Thai routing message directly into `callImageGen()` in both WS and HTTP paths.
- `innomcp-node/src/utils/mcp/answerPlanner.ts` has no language-adaptation stage.
- Response synthesis exists in scattered route-specific logic, but there is no shared final `ResponseComposer` service.

The product goal is **not** to add two always-on AI agents. That was tried early in the project and it made the system too slow.

The correct direction is:
- a gated `PromptAdapterAgent` for Thai → English visual prompt adaptation and planner normalization
- a gated `ResponseComposerAgent` for turning multi-tool or noisy tool outputs into one clean Thai answer

---

### Your task

Implement **Phase 6A + 6B foundation**, and scaffold **Phase 6C** carefully without regressing latency.

## Required Deliverables

### [D1] Create Prompt Adapter service

Create:
- `innomcp-node/src/services/promptAdapter.ts`

Add exported functions:
- `adaptImagePrompt(rawPrompt: string): AdaptedImagePromptResult`
- `normalizePlannerQuery(rawQuery: string): PlannerQueryResult`

Suggested result contracts:

```ts
export interface AdaptedImagePromptResult {
  originalPrompt: string;
  normalizedPromptTh: string;
  adaptedPromptEn: string;
  mode: "deterministic" | "llm-fallback" | "passthrough";
  confidence: number;
  reasons: string[];
}

export interface PlannerQueryResult {
  originalQuery: string;
  normalizedQuery: string;
  mode: "deterministic" | "llm-fallback" | "passthrough";
  confidence: number;
  reasons: string[];
}
```

Rules:
- Reuse existing `src/utils/thaiQueryNormalizer.ts` where helpful.
- Reuse existing image-prefix stripping behavior from `imageGenService.ts`.
- Build a deterministic bilingual visual glossary first.
- Preserve proper nouns, numbers, Thai place names, and domain-specific nouns.
- Map style words and scene words into concise English prompt fragments.
- Do **not** call the LLM for every prompt.
- Only use LLM fallback when the prompt is clearly image-related and deterministic adaptation confidence is low.
- If you add LLM fallback, keep it short, JSON-only, and protected by strict timeout/budget.

### [D2] Wire Prompt Adapter into image-generation flow

Modify:
- `innomcp-node/src/routes/api/chat.ts`
- `innomcp-node/src/services/imageGenService.ts`

Requirements:
- In both WS and HTTP image gates, adapt the prompt before calling `callImageGen()`.
- `callImageGen()` should receive the adapted English prompt, not the raw Thai text.
- Preserve user-facing Thai UX by storing both the original Thai prompt and the adapted English prompt in structured content.
- Add metadata fields such as:
  - `originalImagePrompt`
  - `adaptedImagePromptEn`
  - `promptAdapterMode`
- Keep the final displayed answer in Thai.

### [D3] Wire planner normalization without global latency regression

Modify:
- `innomcp-node/src/utils/mcp/answerPlanner.ts`
- and/or the pre-planner path in `innomcp-node/src/routes/api/chat.ts`

Requirements:
- Tool routing should be able to use a normalized query variant.
- Do not replace the raw user query globally; preserve the original for logs and UI.
- Use normalization only where it improves intent/tool selection.
- Keep general deterministic routing intact.

### [D4] Scaffold shared Response Composer service

Create:
- `innomcp-node/src/services/responseComposer.ts`

Implement at least:
- a clean typed input contract for compact tool facts
- a first deterministic `composeThaiAnswer()` implementation
- optional placeholder for future LLM fallback, but do not overbuild

Then wire it into **one** high-value route only if safe, preferably a route that already does rewrite/synthesis today.

Examples of acceptable first integration targets:
- weather tool+rewrite path
- evidence summarization path

Do not attempt to rewire every route in one pass.

### [D5] Add tests

Add targeted tests covering at least:

1. Thai image prompt adaptation
   - `สร้างรูปแมวสีแดงสไตล์การ์ตูน`
   - should produce an English visual prompt containing concepts like `red cat`, `cartoon`, etc.

2. Mixed Thai prompt with scene details
   - `วาดภาพนักบินอวกาศยืนกลางทุ่งนาไทยตอนพระอาทิตย์ตก`
   - should preserve semantic richness and not collapse into a generic prompt

3. Planner normalization
   - noisy Thai or colloquial queries should normalize without losing intent

4. Response composer deterministic output
   - given compact tool facts, the composer should output one coherent Thai answer

### [D6] Add observability

Add logging/trace fields where appropriate:
- `promptAdapterMode`
- `promptAdapterLatencyMs`
- `responseComposerUsed`
- `responseComposerLatencyMs`

### Hard constraints

- Do not add an always-on translator agent
- Do not add recursive multi-LLM chains
- Do not call the LLM twice just to generate an image
- Do not break existing auth gates for image generation
- Do not regress chat responsiveness for ordinary non-image queries
- Do not introduce heavy external dependencies if existing project utilities are enough

### Performance guardrails

- Deterministic prompt adaptation should be near-zero overhead
- LLM fallback for prompt adaptation must be rare and budgeted
- Response composer should run only on gated paths, not globally
- Prefer cache for repeated image prompts

### Suggested files to inspect before editing

- `innomcp-node/src/routes/api/chat.ts`
- `innomcp-node/src/services/imageGenService.ts`
- `innomcp-node/src/utils/mcp/answerPlanner.ts`
- `innomcp-node/src/utils/thaiQueryNormalizer.ts`
- `innomcp-node/src/utils/languageValidator.ts`

### Verification

Run focused tests for the files you add/change.
If you add new tests, run them explicitly.
If TypeScript surfaces any new errors in touched files, fix them before stopping.

### Expected outcome

After your work:
- Thai image prompts should generate materially better images because they are adapted into English visual prompts automatically
- Tool selection should benefit from normalized Thai queries without adding global latency
- The codebase should have the foundation for a shared response-composition layer without overcomplicating the current routing system

---

## End Prompt

