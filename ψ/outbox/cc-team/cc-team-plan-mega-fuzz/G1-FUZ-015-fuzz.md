<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-015 role=fuzz model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":545,"completion_tokens":2265,"total_tokens":2810,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 49s
 generated: 2026-06-13T12:02:53.977Z -->
```markdown
# Property-Based / Fuzz Tests: motherProviderToggle.ts

## Core Invariants

- **`isProviderEnabled(P)` after `disableProvider(P)`** → always `false`
  - Fuzz: any ASCII / Unicode / control-char / empty / 1MB string as `providerId`
  - Expected: `isProviderEnabled(P) === false` regardless of charset

- **`isProviderEnabled(P)` after `enableProvider(P)`** → always `true`
  - Fuzz: `providerId` = emoji-only, null-byte embedded, surrogate pairs, leading/trailing whitespace
  - Expected: `true` (Set membership is exact-string)

- **`isProviderEnabled(P)` after `toggleProvider(P)`** → returns the **negation** of prior state, and reported return value matches new state
  - Fuzz: call `toggle` 2× with same arbitrary string; return values must be `[false, true]` or `[true, false]`
  - Expected: `toggle(P) === !isProviderEnabled(P)` pre-call

- **`getDisabledProviders()` length** ≡ `|disabledProviders|` set membership
  - Fuzz: 10k random string `providerId`s, mix of `disable/enable/toggle`, then snapshot
  - Expected: every returned ID `id` satisfies `isProviderEnabled(id) === false`; every `id` with `isProviderEnabled(id) === false` appears in the snapshot (bijection)

- **No duplicate IDs in snapshot**
  - Fuzz: call `disableProvider(P)` 1000× with same `P`
  - Expected: snapshot contains `P` at most once

- **Set operations are idempotent for `disableProvider`**
  - Fuzz: `disableProvider(P); disableProvider(P); disableProvider(P)` then `getDisabledProviders()`
  - Expected: same state as single call

- **Set operations are idempotent for `enableProvider` on already-enabled**
  - Fuzz: `enableProvider(P)` when `P` never disabled
  - Expected: no throw, no state change, `isProviderEnabled(P) === true`

- **`resetAllProviders()` returns state to all-enabled**
  - Fuzz: random sequence of `disable/toggle` on 100 strings, then `resetAllProviders()`, then `isProviderEnabled` for each
  - Expected: all return `true`; `getDisabledProviders().length === 0`

- **Default state is all-enabled for any of the 14 known providers**
  - Fuzz: at fresh import, `isProviderEnabled(id)` for all 14 canonical IDs (e.g. `"openai"`, `"anthropic"`, …)
  - Expected: all `true`

## Cross-Operation Invariants

- **`isProviderEnabled(P)` ⇔ `!getDisabledProviders().includes(P)`**
  - Fuzz: arbitrary interleaving of `disable/enable/toggle/reset` on arbitrary strings, then assert equivalence for all probed IDs
  - Expected: equivalence holds after every operation

- **Toggle is involution on boolean state: `toggle(toggle(P))` ≡ no-op for `isProviderEnabled`**
  - Fuzz: arbitrary `P`, random leading state
  - Expected: `isProviderEnabled` unchanged; but Set may have transient entry — verify by capturing snapshot before/after

- **`enableProvider(P)` then `disableProvider(P)`** ≡ state where `P` is disabled, snapshot contains `P`
  - Fuzz: P = any string including empty
  - Expected: holds

- **`disableProvider(P)` then `enableProvider(P)`** ≡ state where `P` is enabled, snapshot does **not** contain `P`
  - Fuzz: P = 1000 random strings
  - Expected: holds

- **`getDisabledProviders()` returns a fresh array (no aliasing of internal state)**
  - Fuzz: snapshot, mutate returned array (`push`, `splice`, `sort`), then call `isProviderEnabled` for pushed IDs
  - Expected: pushed IDs report `true` (internal Set untouched); also snapshot length unchanged on next call

## Adversarial / Malformed Inputs

- **Empty string `""` as `providerId`**
  - Fuzz: full lifecycle `disable("")` → `isProviderEnabled("")` → `enable("")` → `toggle("")`
  - Expected: module treats it as a valid distinct key; no throw

- **Whitespace-only / control-character IDs** (`" "`, `"\t"`, `"\n"`, `"\0"`, `"\r"`)
  - Fuzz: each as `providerId`
  - Expected: no throw; treated as distinct keys; no normalization

- **Case sensitivity**
  - Fuzz: `disableProvider("OpenAI")` then `isProviderEnabled("openai")` and vice versa
  - Expected: treated as different IDs (case-sensitive Set)

- **Leading/trailing whitespace IDs are distinct from trimmed IDs**
  - Fuzz: `" openai"`, `"openai "`, `" openai "` vs `"openai"`
  - Expected: 4 distinct keys; all coexist independently

- **Unicode normalization forms** (`"café"` NFC vs NFD, precomposed vs decomposed)
  - Fuzz: disable one form, check the other
  - Expected: treated as different keys (raw codepoint comparison)

- **Very long provider IDs** (1 MB string)
  - Fuzz: `disableProvider(<1MB string>)` then `isProviderEnabled` same string
  - Expected: completes, no OOM, no throw, consistent state

- **Keys differing only in trailing null bytes** (`"a"`, `"a\0"`, `"a\0\0"`)
  - Fuzz: disable each, verify Set contains all three independently
  - Expected: all three track separately

- **Prototype-pollution / `__proto__` style keys**
  - Fuzz: `disableProvider("__proto__")`, `disableProvider("constructor")`, `disableProvider("hasOwnProperty")`
  - Expected: no prototype mutation; subsequent `({}).hasOwnProperty` intact; IDs stored verbatim

- **Numeric / boolean / object coerced to string** at TS boundary (simulate via `String(x)`)
  - Fuzz: `disableProvider(String(42))`, `disableProvider(String(true))`, `disableProvider(String({a:1}))`
  - Expected: keys `"42"`, `"true"`, `"[object Object]"`; no type errors; no Symbol coercion attempted

- **Mass concurrent-style interleaving (sequentially simulating race)**
  - Fuzz: 10k random ops on 10k random IDs in random order, then `isProviderEnabled` for a sample
  - Expected: state always equals "last writer wins" per ID; `getDisabledProviders()` consistent with `isProviderEnabled`

- **Repeated `toggleProvider` on never-seen ID** (starts enabled)
  - Fuzz: random ID, single `toggle`
  - Expected: returns `false`, ID now in disabled Set

- **`getDisabledProviders()` ordering**
  - Fuzz: insert 1000 IDs in random insertion order
  - Expected: Set iteration order = insertion order; snapshot preserves it (document as property or test for stability)

- **Snapshot after `resetAllProviders()` and re-disable**
  - Fuzz: `disableProvider("a")` → `resetAllProviders()` → `disableProvider("b")` → snapshot
  - Expected: snapshot is `["b"]` only; no `"a"` residue

## Negative / Type-Boundary

- **Non-string `providerId` at runtime** (TS will allow if `as any` cast): `null`, `undefined`, `number`, `object`
  - Fuzz: `disableProvider(null as any)`, `disableProvider(undefined as any)`, `disableProvider(123 as any)`, `disableProvider({} as any)`
  - Expected: documents actual behavior — likely `"null"`, `"undefined"`, `"123"`, `"[object Object]"` keys; or throws on `null/undefined`; assert whichever, but **must not silently corrupt** the Set with `undefined` causing lookup surprises

- **Symbol as `providerId`**
  - Fuzz: `disableProvider(Symbol("x") as any)`
  - Expected: documents throw vs coerced behavior; assert consistency across `is/enable/toggle`

- **Frozen / sealed string-like objects**
  - Fuzz: `disableProvider(Object.assign(Object.freeze(Object("foo")), {}) as any)` 
  - Expected: handled without throwing; key stored per `String(x)` coercion

## Property Summary Table

| # | Property | Fuzz Input | Expected Invariant |
|---|----------|-----------|--------------------|
| 1 | `disable` makes `isProviderEnabled` false | any string, including 1MB | `=== false` |
| 2 | `enable` makes `isProviderEnabled` true | any string | `=== true` |
| 3 | `toggle` negates state, return value matches new state | any string, any prior state | `returned === new isEnabled` |
| 4 | Snapshot ⇔ `!isProviderEnabled` for all probed IDs | random ops + probe | equivalence holds |
| 5 | `disable` is idempotent | repeat same key N× | state unchanged after 1st |
| 6 | `enable` on enabled key is no-op | never-disabled key | no throw, state unchanged |
| 7 | `resetAllProviders` clears all | 100 disabled, then reset | `getDisabledProviders().length === 0`; all `isProviderEnabled === true` |
| 8 | No `__proto__` / `constructor` pollution | these as IDs | prototype intact, IDs stored verbatim |
| 9 | Case-sensitive | `"A"` vs `"a"` | independent keys |
| 10 | Unicode-normalization-sensitive | NFC vs NFD | independent keys |
| 11 | Whitespace-significant | `"x"` vs `" x"` | independent keys |
| 12 | `getDisabledProviders` returns fresh array | mutate returned array | internal Set unchanged |
| 13 | 14 canonical providers start enabled | all 14 known IDs at import | all `true` |
| 14 | Non-string coerced keys behave predictably | `null`, `undefined`, numbers, objects | documented, non-corrupting |
| 15 | Toggle involution on `isProviderEnabled` | `toggle(toggle(P))` | `isProviderEnabled(P)` unchanged |
```
