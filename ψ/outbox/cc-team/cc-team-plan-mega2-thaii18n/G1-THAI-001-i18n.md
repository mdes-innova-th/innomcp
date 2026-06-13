<!-- cc-team deliverable
 group: G1 (thaii18n division)
 member: THAI-001 role=i18n model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3336,"completion_tokens":1760,"total_tokens":5096,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1428,"image_tokens":0},"cache_creation_input_tokens":0} | 26s
 generated: 2026-06-13T12:07:09.205Z -->
| severity | location | issue | fix |
|----------|----------|-------|-----|
| **Medium** | `containsAny()` (line 265) and `evidenceMatch()` (line 277); all substring/regex matching against user input throughout `classifyIntent()` | **No Unicode normalization before comparisons.** Thai characters like vowels and tone marks can be represented in composed (NFC) or decomposed (NFD) forms. User input and the hardcoded keyword arrays may be in different normalization forms, causing `includes()` or regex checks to miss valid matches. This leads to incorrect intent classification (false negatives) for Thai utterances. | Normalize all user input and keyword lists to a consistent Unicode normalization form (preferably NFC) before comparison. In `containsAny`, compute `const lower = text.normalize('NFC').toLowerCase();` and apply `.normalize('NFC')` to each keyword when building the list (or pre‑normalize the arrays). In `evidenceMatch`, normalize the message before both `evidenceMatch` and the secondary regex test. |

**Additional notes:**

- No date/number/currency formatting is performed in this module, so no such issues.
- Tokenization is not required because the classifier relies on substring matching, which naturally handles Thai’s lack of explicit word boundaries.
- Hardcoded English strings are intentional and appropriate for a classifier supporting Thai + English; no localisation issue there.
- The use of `toLowerCase()` is harmless for Thai (no case changes) and works correctly for English. No mixed‑language encoding risks are present beyond the normalization gap.
