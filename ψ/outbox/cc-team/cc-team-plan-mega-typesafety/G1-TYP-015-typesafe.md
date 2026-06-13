<!-- cc-team deliverable
 group: G1 (typesafety division)
 member: TYP-015 role=typesafe model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1855,"completion_tokens":763,"total_tokens":2618,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 24s
 generated: 2026-06-13T12:00:34.351Z -->
| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| high | `normalizeWeatherFacts` parameter `toolResult: any` (line 18) | implicit-`any` propagation from caller; entire function body assumes unconstrained shape | Type as `unknown` (or a `WeatherToolResult` discriminated union) and narrow with type guards before accessing `.result`/`.data` |
| high | `normalizeEvidenceFacts` parameter `toolResult: any` (line 81) | same — unvalidated `.result`/`.data` chain | Replace `any` with `unknown`; narrow via `is PlainObject` guard before property access |
| high | `normalizeDeterministicFact` parameter `result: any` (line 125) | `String(result)` on `any` can produce `"[object Object]"` or throw on Symbol | Type as `unknown` and use a `stringifySafe(value: unknown): string` helper that handles primitives/objects/errors |
| medium | `toolResult.result \|\| toolResult.data \|\| toolResult` (lines 27, 86) | if `toolResult` is `any`, `result`/`data` can be any type; result also typed implicitly as `any` | Narrow `toolResult` first (see above) so the fallback chain is type-checked; if all branches are objects, declare a local `unknown` and validate |
| medium | `item.province \|\| item.location` (line 31) | `item` is implicitly `any` from the untyped `results` array | After `Array.isArray`, type `item: Record<string, unknown>` (or a `WeatherItem` interface) and assert/validate string fields |
| medium | `JSON.stringify(item)` / `JSON.stringify(results)` (lines 38, 53) | throws `TypeError` on circular refs or `BigInt`; unsafe on `any` | Wrap in `try { return JSON.stringify(value) } catch { return "[unserializable]" }` after narrowing `value: unknown` |
| low | `extractWeatherEntities` / `extractISP` parameters not annotated in any risky way — but `extractISP` returns `m[1].toUpperCase()` | `m[1]` is `string` (typed by `match`), but union with `undefined` if `noUncheckedIndexedAccess` is on | Enable `noUncheckedIndexedAccess` and handle `m[1] === undefined` explicitly |
| low | `nextFactId` uses module-level mutable `factCounter` | not a type-safety bug, but global state; flag for review | Encapsulate in a factory class if used across modules |
| low | `confidence: 0.9` / `0.95` / `1.0` literals | not enforced to be within `0..1`; consumers may assume invariant | Add a branded type `Confidence = number & { readonly __brand: 'Confidence' }` with a constructor that clamps/validates |
| info | no `as any`, non-null `!`, `JSON.parse`, or `catch (e)` present in this module | n/a | n/a — but `JSON.stringify` on untrusted shapes is the equivalent risk here |

**Recommended primary refactor:** replace the three `: any` parameters with `: unknown`, add a small `isPlainObject(x: unknown): x is Record<string, unknown>` guard, and introduce explicit `WeatherToolResult` / `EvidenceToolResult` interfaces for the shapes the rest of the codebase actually produces. This eliminates the `any` blast radius without changing runtime behavior.
