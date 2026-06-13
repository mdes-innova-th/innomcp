<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-022 role=trace model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":1815,"completion_tokens":5768,"total_tokens":7583,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3848,"image_tokens":0},"cache_creation_input_tokens":0} | 161s
 generated: 2026-06-13T12:05:09.807Z -->
Here is the concrete data flow trace for the `ResponseFormatter` module, broken down by its public entry points.

### Flow 1: `format(raw, options)` — Primary Synchronous Formatting
1. **Enters**:
   * `raw` (`string`, source: raw LLM/text output).
   * `options` (`FormatOptions`, source: client configuration). Shape: `{ renderMarkdown?: boolean, highlightCode?: boolean, sanitizeHtml?: boolean, maxLength?: number, locale?: 'th' | 'en' }`.
2. **Transformation Steps**:
   * **Step 1 (Locale)**: Resolves `locale` from `options` (defaults to `'en'`).
   * **Step 2 (Truncation)**: If `options.maxLength` is set, calls `truncate(raw, maxLength)`. Slices text at word boundaries and appends `...`. Result: `text` (`string`).
   * **Step 3 (Code Extraction)**: Calls `extractCodeBlocks(text)`. Uses regex to find ```` ``` ```` fences. For each, determines language (via `detectLanguage()` if missing), extracts code, and counts lines. Result: `codeBlocks` (`CodeBlock[]`).
   * **Step 4 (Table Extraction)**: Calls `extractTables(text)`. Splits by newline, filters out markdown separator rows (`---|---`), splits cells by `|`. Result: `tables` (`string[][]`).
   * **Step 5 (Markdown Detection)**: Calls `hasMarkdown(text)`. Tests regex for headers, bold, code, lists, tables. Result: `hasMarkdown` (`boolean`).
   * **Step 6 (Reading Time)**: Calls `estimateReadingTime(text, locale)`. Calculates word count (Thai: chars/6, EN: space-split) and divides by WPM (150/200). Result: `estimatedReadTimeSeconds` (`number`).
   * **Step 7 (Assembly)**: Assembles base `FormattedResponse` object with the above results.
   * **Step 8 (HTML Rendering)**: If `options.renderMarkdown` is true, calls `renderMarkdown(text)`. Escapes HTML entities and replaces markdown syntax with HTML tags (`<h1>`, `<pre>`, `<strong>`, etc.). Result: `html` (`string`).
   * **Step 9 (Sanitization)**: If `options.sanitizeHtml !== false`, calls `sanitize(html)` to strip `<script>` tags, `on*` event attributes, and `javascript:` URIs. Updates `result.html`.
3. **Exits**:
   * `result` (`FormattedResponse`, destination: client UI/API response). Shape: `{ text: string, html?: string, codeBlocks: CodeBlock[], tables: string[][], hasMarkdown: boolean, estimatedReadTimeSeconds: number }`.
4. **Side-effects**:
   * **None**. (Pure computation, no state mutation, no I/O).

### Flow 2: `formatStream(chunk)` — Stateful Stream Buffering
1. **Enters**:
   * `chunk` (`string`, source: SSE/WebSocket streaming text chunk).
2. **Transformation Steps**:
   * **Step 1 (Buffer Append)**: Appends `chunk` to the instance state `this.streamBuffer`.
   * **Step 2 (Fence Check)**: Checks if `streamBuffer` contains code fences (```` ``` ````).
   * **Step 3 (Incomplete Block Halt)**: If fences exist, counts them. If the count is odd (indicating an unclosed code block), halts processing and returns an empty string `''` to buffer the incomplete block.
   * **Step 4 (Flush)**: If fence count is even or zero, assigns the current `streamBuffer` to a local `output` variable.
   * **Step 5 (Reset)**: Resets `this.streamBuffer` to an empty string `''`.
3. **Exits**:
   * `output` (`string`, destination: client stream consumer). Contains the fully buffered text or `''` if waiting for a closing fence.
4. **Side-effects**:
   * **State**: Mutates instance property `this.streamBuffer` (appends incoming chunk, then clears it upon flush).

### Flow 3: `detectLanguage(code)` — Code Language Inference
1. **Enters**:
   * `code` (`string`, source: extracted code block content).
2. **Transformation Steps**:
   * **Step 1**: Trims whitespace from `code`.
   * **Step 2**: Tests regex for TS/JS keywords (`import`, `const`, `async function`, etc.). If match, returns `'ts'`.
   * **Step 3**: Tests regex for Python keywords (`def`, `import`). If match, returns `'py'`.
   * **Step 4**: Tests regex for JSON start characters (`{`, `[`). If match, returns `'json'`.
   * **Step 5**: Tests regex for SQL keywords (`SELECT`, `INSERT`, etc.). If match, returns `'sql'`.
   * **Step 6**: Tests regex for Bash/Shell indicators (`#!`, `npm`, `curl`, etc.). If match, returns `'bash'`.
   * **Step 7**: Falls back to `'text'` if no patterns match.
3. **Exits**:
   * Language identifier (`string`, destination: `CodeBlock.language` property).
4. **Side-effects**:
   * **None**.

### Flow 4: `sanitize(html)` — HTML Security Sanitization
1. **Enters**:
   * `html` (`string`, source: rendered markdown HTML).
2. **Transformation Steps**:
   * **Step 1**: Strips `<script>...</script>` tags and their contents using regex.
   * **Step 2**: Strips inline event handlers (e.g., `onclick="..."`, `onload='...'`) using regex.
   * **Step 3**: Strips `javascript:` protocol URIs using regex.
3. **Exits**:
   * Sanitized HTML (`string`, destination: `FormattedResponse.html`).
4. **Side-effects**:
   * **None**.

### Flow 5: `truncate(text, maxLength, ellipsis)` — Text Truncation
1. **Enters**:
   * `text` (`string`), `maxLength` (`number`), `ellipsis` (`string`, default `'...'`).
2. **Transformation Steps**:
   * **Step 1**: Checks if `text.length <= maxLength`. If true, returns `text` unmodified.
   * **Step 2**: Calculates `boundary` as `maxLength - ellipsis.length`.
   * **Step 3**: Slices `text` up to `boundary`.
   * **Step 4**: Finds the last space character in the sliced text.
   * **Step 5**: If the last space is past 60% of the boundary, slices at the space to avoid cutting words in half.
   * **Step 6**: Appends `ellipsis` to the sliced text.
3. **Exits**:
   * Truncated text (`string`, destination: `FormattedResponse.text`).
4. **Side-effects**:
   * **None**.

### Flow 6: `extractCodeBlocks(text)` — Code Block Parsing
1. **Enters**:
   * `text` (`string`, source: raw or truncated text).
2. **Transformation Steps**:
   * **Step 1**: Executes global regex `/```(\w+)?\r?\n([\s\S]*?)```/g` to find all markdown code blocks.
   * **Step 2**: For each match, extracts the optional language identifier and the code content.
   * **Step 3**: If language is missing, calls `detectLanguage(code)` to infer it.
   * **Step 4**: Calculates `lineCount` by splitting the code by newlines.
   * **Step 5**: Pushes `{ language, code, lineCount }` to the `blocks` array.
3. **Exits**:
   * `blocks` (`CodeBlock[]`, destination: `FormattedResponse.codeBlocks`).
4. **Side-effects**:
   * **None**.

### Flow 7: `getInstance()` — Singleton Initialization
1. **Enters**:
   * None.
2. **Transformation Steps**:
   * **Step 1**: Checks if static `ResponseFormatter.instance` exists.
   * **Step 2**: If not, instantiates `new ResponseFormatter()` (which initializes `streamBuffer` to `''`).
3. **Exits**:
   * `ResponseFormatter` instance (destination: calling service/controller).
4. **Side-effects**:
   * **State**: Initializes static `instance` property on the class on the first call.
