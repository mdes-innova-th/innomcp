<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-022 role=fuzz model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1827,"completion_tokens":4068,"total_tokens":5895,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3000,"image_tokens":0},"cache_creation_input_tokens":0} | 76s
 generated: 2026-06-13T12:05:26.326Z -->
- **Property: Truncation Length Limit**
  - **Fuzz Input**: `raw` = random string (length 0–10,000), `maxLength` = random integer (3–1000), `ellipsis` = random string (length 1–5).
  - **Expected Invariant**: `result.text.length <= maxLength`. If `raw.length > maxLength`, `result.text` strictly ends with the `ellipsis` string.

- **Property: Truncation Word Boundary Preservation**
  - **Fuzz Input**: `raw` = string with multiple spaces, `maxLength` < `raw.length`, `maxLength` > `ellipsis.length`.
  - **Expected Invariant**: If a space exists in `raw` after the 60% mark of the truncation boundary, the character immediately preceding the `ellipsis` in `result.text` is not a space (no trailing whitespace before ellipsis).

- **Property: XSS Sanitization Coverage**
  - **Fuzz Input**: `raw` = string heavily injected with `<script>`, `onclick="..."`, `onclick='...'`, `javascript:`, mixed casing, and nested tags. `options.renderMarkdown = true`, `options.sanitizeHtml = true`.
  - **Expected Invariant**: `result.html` (lowercased) contains zero instances of `<script`, `javascript:`, or the regex pattern `\son\w+=["']`.

- **Property: Stream Buffer Backtick Parity & State**
  - **Fuzz Input**: Sequence of random string chunks containing random counts of ` ``` ` (0–5 per chunk).
  - **Expected Invariant**: `formatStream(chunk)` returns an empty string `''` IF AND ONLY IF the internal unflushed buffer contains an odd number of ` ``` ` substrings. When it returns a non-empty string, the internal buffer is reset to `''`.

- **Property: Code Block Line Count Accuracy**
  - **Fuzz Input**: `raw` = string containing valid ````lang\n[code]```` blocks, where `[code]` contains random combinations of `\n`, `\r\n`, and empty lines.
  - **Expected Invariant**: For every block in `result.codeBlocks`, `block.lineCount === block.code.split(/\r?\n/).length` (if code is not empty), or `0` if the code string is empty.

- **Property: Reading Time Lower Bound & Type**
  - **Fuzz Input**: `raw` = empty string, single space, or very short string (1–5 chars). `locale` = randomly `'th'` or `'en'`.
  - **Expected Invariant**: `result.estimatedReadTimeSeconds >= 1` and `Number.isInteger(result.estimatedReadTimeSeconds)` is strictly true.

- **Property: Table Separator Row Exclusion**
  - **Fuzz Input**: `raw` = markdown tables with varying separator rows (e.g., `|---|---|`, `|:---|---:|`, `| --- | --- |`, `|---|`).
  - **Expected Invariant**: No row array in `result.tables` contains a cell string that matches the regex `/^:?-{3,}:?$/` (separator rows are strictly filtered out).

- **Property: Markdown HTML Escaping (Input Isolation)**
  - **Fuzz Input**: `raw` = string containing raw HTML tags (`<div>`, `<img src=x>`, `<`), `options.renderMarkdown = true`.
  - **Expected Invariant**: `result.html` does not contain raw `<` or `>` characters that originated from the `raw` input text; all input angle brackets must be escaped to `&lt;` and `&gt;` prior to markdown tag generation.

- **Property: Singleton Reference Stability**
  - **Fuzz Input**: Call `ResponseFormatter.getInstance()` multiple times, interspersed with random method calls (`format`, `formatStream`, `sanitize`).
  - **Expected Invariant**: `Object.is(instanceA, instanceB)` is always true; the exact same memory reference is returned every time.

- **Property: Code Block Language Fallback**
  - **Fuzz Input**: `raw` = string containing ````\n[code]```` blocks (no language specified), where `[code]` is randomized to match or not match the regex patterns in `detectLanguage`.
  - **Expected Invariant**: If the markdown fence lacks a language identifier, `block.language` strictly equals the output of `detectLanguage(block.code)`, defaulting to `'text'` if no regex matches.

- **Property: Format Stream Cumulative Output**
  - **Fuzz Input**: Array of chunks that collectively contain an even number of ` ``` ` (or zero).
  - **Expected Invariant**: The concatenation of all returned strings from sequential `formatStream` calls exactly equals the concatenation of all input chunks. No data is lost or duplicated.
