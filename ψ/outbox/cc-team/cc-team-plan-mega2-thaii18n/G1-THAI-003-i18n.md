<!-- cc-team deliverable
 group: G1 (thaii18n division)
 member: THAI-003 role=i18n model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":1232,"completion_tokens":4548,"total_tokens":5780,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4248,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 59s
 generated: 2026-06-13T12:08:08.068Z -->
| severity | location | issue | fix |
|---|---|---|---|
| medium | `composeThaiAnswer` empty-facts return | Hardcoded Thai fallback string (`"ขออภัย ไม่พบข้อมูล..."`) violates separation of concerns; blocks A/B testing, tone changes, or bilingual fallback flows. | Add `fallbackText?: string` to `ResponseComposerInput` or resolve from an injected i18n dictionary. |
| medium | `composeThaiAnswer` `conf` template literal | Hardcoded Thai label `"ความมั่นใจ"` and non-locale-aware number formatting (`toFixed(0)`). | Externalize the label via an i18n key; format with `Intl.NumberFormat('th-TH', { style: 'percent', maximumFractionDigits: 0 })`. |
| medium | `composeThaiAnswer` `sourceLabel` interpolation | Raw English source identifiers (e.g. `tmd_seismic`, `weather`) injected directly into Thai output without localization, producing jarring mixed-script lines. | Add `sourceLabelThai?: string` to `ToolFact` or map `source` keys to Thai labels; keep raw keys for debug only. |
| low | `trimFact` regex | `\s` does not match Thai zero-width space (U+200B), a common word-breaking character in Thai text, leaving invisible formatting artifacts. | Use `/[\s\u200B]+/g` when collapsing whitespace. |
| low | `trimFact` return value | Thai combining characters (tone marks, vowels, Sara symbols) may arrive in decomposed Unicode forms, causing inconsistent glyph rendering or downstream comparison failures. | Chain `.normalize('NFC')` after trimming. |
| low | `composeThaiAnswer` confidence suffix | Halfwidth parentheses `()` abut Thai text without spacing, producing cramped mixed-script typography in Thai fonts. | Use fullwidth `（）` or pad with spaces: ` （ความมั���นใจ ...）`. |
| low | `composeThaiAnswer` markdown markers | ASCII markdown bold/italic (`**`, `_`) embedded in Thai text assumes a markdown-capable renderer; will render as literal noise in plain-text channels (SMS, LINE, push notifications). | Gate markdown syntax behind an `outputFormat` flag, or default to plain Thai and let callers opt-in to markdown. |
