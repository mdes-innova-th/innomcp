<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-012 role=fuzz model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2448,"completion_tokens":4246,"total_tokens":6694,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3229,"image_tokens":0},"cache_creation_input_tokens":0} | 79s
 generated: 2026-06-13T12:02:04.956Z -->
### `renderThaiNumberText(value: number)`
- **Non-finite passthrough** → `NaN`, `Infinity`, `-Infinity` → Returns exact string representation (`"NaN"`, `"Infinity"`, `"-Infinity"`) without throwing.
- **Zero normalization** → `0`, `-0` → Returns exactly `"ศูนย์"`.
- **Negative prefix invariant** → `-1`, `-999999`, `-1000001` → Output strictly starts with `"ลบ"` and contains no `-` or numeric digits.
- **Decimal truncation** → `1.5`, `1.9`, `999999.9`, `-1.5` → Output strictly equals `renderThaiNumberText(Math.floor(input))` (or equivalent for negatives via `Math.abs`).
- **Million boundary threshold** → `999999`, `1000000`, `1000001` → Output for `>= 1000000` contains `"ล้าน"`, output for `< 1000000` does not.
- **Digitless output** → Random integers/floats in `[-1e9, 1e9]` → Output contains absolutely no characters in `[0-9]`.
- **Large number resilience** → `Number.MAX_SAFE_INTEGER`, `1e20`, `1e100` → Returns a string without throwing or entering infinite loops (JS precision loss is acceptable, crash is not).

### `countDaysUntilEndOfYear(baseDate: Date)`
- **Non-negative floor** → `new Date("invalid")`, `new Date(NaN)` → Returns `0` (since `Math.max(0, NaN)` evaluates to `0`).
- **Upper bound limit** → `new Date(2023, 0, 1)`, `new Date(2024, 0, 1)` → Returns `<= 365` (364 for non-leap year, 365 for leap year).
- **End-of-year zero** → `new Date(2023, 11, 31)`, `new Date(2024, 11, 31, 23, 59, 59)` → Returns exactly `0`.
- **Timezone/Time agnostic** → `new Date(2023, 11, 31, 23, 59, 59)`, `new Date(2023, 11, 31, 0, 0, 0)` → Both return `0` (time component is stripped via `getFullYear/getMonth/getDate`).
- **Type coercion safety** → `null`, `undefined`, `"2023-01-01"`, `{}` → Throws `TypeError` predictably (due to `.getFullYear()` on non-Date objects) rather than returning silent garbage.

### `renderGeneralSmokeAnswer(userText: string)`
- **Null/Undefined coercion** → `null`, `undefined`, `NaN`, `[]`, `{}` → Returns `LOW_CONFIDENCE_FALLBACK_TEXT` (coerced to `""` or `"null"`, failing Thai/regex checks).
- **Non-Thai fallback** → `"abcdef"`, `"12345"`, `""`, `"   "` → Returns exactly `LOW_CONFIDENCE_FALLBACK_TEXT`.
- **Regex DoS resistance** → `"a".repeat(100000)`, `"ระบบ" + "a".repeat(100000) + "พร้อม"` → Completes in `< 50ms`, no catastrophic backtracking or event loop blocking.
- **Precedence determinism** → `"ping ชื่ออะไร"`, `"ภาคกลาง RAG"` → Returns the first matched regex's response (e.g., ping status, not name/region), strictly deterministic.
- **Unicode/Whitespace resilience** → `"\u200b".repeat(100) + "ping"`, `"p\u0069ng"`, `"👍"` → Handles gracefully without throwing; falls back to low confidence if regex fails to match normalized text.
- **Extreme length handling** → `"ก".repeat(10_000_000)` → Returns fallback or matches without OOM (Out of Memory) or V8 string length limit crashes.

### `renderGeneralFallbackMessage()`
- **Static immutability** → `()` (no args) → Always returns the exact hardcoded string, length `> 0`, no side effects or state mutations.
