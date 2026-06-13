<!-- cc-team deliverable
 group: G2 (typesafety division)
 member: TYP-030 role=typesafe model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":3467,"completion_tokens":1035,"total_tokens":4502,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 32s
 generated: 2026-06-13T12:04:07.915Z -->
```typescript
/**
 * promptAdapter.ts — Phase 6A/6B
/* …truncated… */
```

The snippet is truncated, so I'll audit the visible portion and note where truncation limits analysis. I'll also check for the patterns the user asked about in the visible code.

Audit of visible code (`innomcp-node/src/services/promptAdapter.ts`):

| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| INFO | top-level `import` / function signatures | No explicit return-type annotations on exported functions; no defensive type for `unknown` boundary. | Add explicit return types (e.g. `Promise<AdaptedImagePromptResult>`) and use `unknown` for untrusted inputs at the boundary. |
| LOW | `normalizeThaiQuery` import | Imported value is treated as fully trusted; no compile-time proof of its signature. | Ensure `../utils/thaiQueryNormalizer` exports a `.d.ts` or wrap calls in a typed adapter: `const normalize: (s: string) => string = normalizeThaiQuery;` |
| LOW | `GLOSSARY: GlossaryEntry[]` | Array is typed, but entries are only validated at *definition* time, not at load time if ever deserialized. | If this data ever moves to JSON/external storage, validate with a Zod/io-ts schema. (For inline data: acceptable.) |
| INFO | `stripImageCommand(text: string)` | Pure function, no null/undefined guard on `text` (TS catches this at call sites, but untyped callers could pass `undefined` at runtime). | Add `if (typeof text !== "string" \|\| text.length === 0) return "";` at the top for runtime safety. |
| INFO | Regex declarations | Regexes are untyped at the literal level (TS infers `RegExp`); fine. | No change required. |
| MEDIUM | `normalizePlannerQuery` / `adaptImagePrompt` (truncated, typically contains `JSON.parse` + `await`) | The truncated region almost certainly contains `JSON.parse(<llm output>)` cast through `as any` or `as Record<string, unknown>` plus non-null assertions. **Cannot confirm from visible code.** | Please paste the rest of the file (especially any `JSON.parse(`, `as any`, `!`, and `try/catch (e)` blocks) so I can score severity. |
| MEDIUM | `catch (e)` (truncated) | Typical Phase-6B LLM fallback path uses `catch (e) { ... console.error(e) }` with `e: any` or untyped `e`. | Use `catch (e: unknown)` and narrow: `if (e instanceof Error) ...`; never access `.message` directly. |
| HIGH (suspected) | `JSON.parse(raw, ...) as AdaptedImagePromptResult` style cast (truncated) | Direct cast from `any`/`unknown` to a fully-typed result object is a classic source of runtime shape mismatch. | Parse to `unknown`, then validate with a runtime schema (Zod) and only then assign the result type. Avoid `as any` entirely. |
| HIGH (suspected) | `process.env.SOMETHING!` / `result.fields!.foo` (truncated) | Non-null assertion on env config or freshly-parsed LLM JSON. | Validate env at boot (return a typed `Config` object); replace `!` with explicit narrowing or a thrown `ConfigurationError`. |
| LOW (suspected) | Implicit `any` in `for (let i = 0; i < 2; i++)` loop body callbacks (truncated) | If any callback infers `any` from `replace(...)` chain, TS won't catch errors. | No evidence in visible code; loop is safe. Revisit if truncated region shows callbacks. |
| LOW | Public API: `adaptImagePrompt(rawPrompt)` | No runtime check that `rawPrompt` is a non-null `string`; callers can pass `null`/`undefined` from `JSON.parse` boundaries. | Guard: `if (typeof rawPrompt !== "string") throw new TypeError(...)`. |

**Net assessment of the visible portion:** the *shown* code is relatively clean — no `as any`, no `!`, no `JSON.parse`, no `catch (e)`, no implicit `any` are present in the lines I can see. The real risk surface lives in the truncated tail (the LLM-fallback branch), which is where Phase-6A/6B adapters historically accumulate these patterns. Paste the remainder (especially the `llm-fallback` block, the env-var reads, and any `JSON.parse` site) and I can produce a definitive scored table.

If you can share lines from the `llm-fallback` switch case through EOF, I'll re-run the audit with concrete line numbers and severity ratings.
