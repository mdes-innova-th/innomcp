<!-- cc-team deliverable
 group: G1 (thaii18n division)
 member: THAI-004 role=i18n model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":1658,"completion_tokens":3247,"total_tokens":4905,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2002,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 29s
 generated: 2026-06-13T12:08:28.367Z -->
# Thai i18n Correctness Audit — `responseFormatter.ts`

| severity | location | issue | fix |
|----------|----------|-------|-----|
| **HIGH** | `truncate()` | Slicing at an arbitrary index can split a Thai grapheme cluster (e.g., base consonant ก + combining tone mark ่ → orphaned mark renders as broken character) | Use `Intl.Segmenter` with `granularity: 'grapheme'` to find safe break points, or at minimum walk backwards past combining marks (`\p{Mn}`) before slicing |
| **HIGH** | `truncate()` | Word-boundary search uses `lastIndexOf(' ')`; Thai does not use spaces between words, so the method always falls through to a hard character cut in pure Thai text | For Thai locale, use a dictionary-based word segmenter (e.g., `thai-segmenter`/`icu-segmenter`) to find a phrase boundary, or fall back to grapheme-cluster boundary instead of space boundary |
| **HIGH** | `estimateReadingTime()` | Mixed Thai-English text is counted as `(all-non-space-chars) / 6`, grossly over-counting English words that are already space-delimited (e.g., "API สวัสดี REST" → 12 chars / 6 = 2 "words" instead of 3) | Split text into Thai and non-Thai runs; count space-separated words in non-Thai segments, count Thai characters / avg-word-length in Thai segments; sum both |
| **MEDIUM** | `FormatOptions.locale` | Type is `'th' \| 'en'` instead of BCP 47 locale tags (`'th-TH'`, `'en-US'`), preventing use with `Intl` APIs and blocking future locale variants (`th-LA`, `en-GB`) | Change to `string` (or a union of BCP 47 tags) and pass directly to `Intl` formatters |
| **MEDIUM** | `truncate()` | Hardcoded Latin ellipsis `'...'` (three ASCII periods); Thai typography prefers `'…'` (U+2026) or a locale-specific convention | Default to `'…'` or accept ellipsis as a locale-aware option |
| **MEDIUM** | `estimateReadingTime()` | Hardcoded divisor `6` and `wordsPerMinute: 150` for Thai; average Thai word length is ~4–5 characters and reading speed varies by genre | Make both values configurable; consider 4.5 chars/word and 180 WPM for adult readers, or better yet, use a Thai word segmenter for an actual count |
| **MEDIUM** | *(missing)* | No date formatting — th-TH uses the Buddhist calendar (BE = CE + 543) and DD/MM/YYYY order; raw ISO dates will be misread by Thai users | Add a `formatDate()` method using `Intl.DateTimeFormat('th-TH', { calendar: 'buddhist' })` |
| **MEDIUM** | *(missing)* | No number/currency formatting — th-TH expects grouping with `.` (dot) for thousands, `,` (comma) for decimal, and `฿` or `THB` for currency | Add `Intl.NumberFormat('th-TH')` and `Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' })` helpers |
| **MEDIUM** | *(missing)* | No Thai text normalization — decomposed input (e.g., U+0E04 + U+0E31 vs precomposed U+0E4D) causes inflated `.length`, broken truncation, and duplicate display | Apply `text.normalize('NFC')` at the top of `format()` before any processing |
| **LOW** | `hasMarkdown()` | Regex `^#{1,6}\s` requires a space after `#`; Thai text commonly omits the space (e.g., `#สวัสดี`) per Thai typography conventions | Change to `^#{1,6}(?:\s\|\p{Thai})` or `^#{1,6}[ \t\p{Thai}]` to accept Thai initial characters |
| **LOW** | `detectLanguage()` | No detection for Thai content inside code blocks; falls back to `'text'` even when the block is Thai prose | Add a Thai-character heuristic: `/\p{Thai}/u` coverage > 30 % → `'th'` |
| **LOW** | `formatStream()` | If a UTF-8 multi-byte sequence is split across two `chunk` calls, `this.streamBuffer += chunk` concatenates correctly in JS strings, but only if the upstream decoded to strings; raw `Buffer` concatenation would corrupt Thai | Document that `chunk` must be a decoded UTF-16 string; add a runtime type guard or `Buffer.isBuffer(chunk)` check |
| **LOW** | `format()` | Default `locale` is `'en'`, so Thai text is silently measured with English heuristics when the caller omits locale | Auto-detect locale from content (`/\p{Thai}/u` ratio) when `locale` is not explicitly set, then fall back to `'en'` |
| **LOW** | `sanitize()` | Regex `\son\w+="[^"]*"` and `\son\w+='[^']*'` don't catch event handlers with backtick-wrapped values (ES6 template literals) or unquoted attributes common in Thai CMS content | Add `\son\w+=\`[^\`]*\`` and `\son\w+=(?=[^\s>])` patterns; consider using a proper HTML sanitizer (DOMPurify) instead of regex |

---

### Key Takeaways

1. **Grapheme-cluster safety** is the most critical fix — `truncate()` can produce broken Thai text visible to end users. Use `Intl.Segmenter` (available in Node ≥ 16) to find safe cut points.

2. **Word segmentation** underpins both truncation and reading-time estimation. Thai has no inter-word spaces; a dictionary segmenter (or ICU `Segmenter` with `granularity: 'word'` and `locale: 'th'`) is essential for any per-word operation.

3. **NFC normalization** should be applied once at the entry point (`format()`) to canonicalize Thai combining sequences before any length/boundary logic runs.

4. **`Intl` APIs** already handle Buddhist-calendar dates, Thai digit grouping, and baht formatting — adopt BCP 47 locale strings so these can be leveraged directly.
