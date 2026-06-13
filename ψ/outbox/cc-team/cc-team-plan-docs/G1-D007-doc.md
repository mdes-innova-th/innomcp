<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D007 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":2187,"completion_tokens":2171,"total_tokens":4358,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1714,"image_tokens":0},"cache_creation_input_tokens":0} | 42s
 generated: 2026-06-13T11:20:26.702Z -->
* **`ColumnStats`** (Interface)
  * **Purpose:** Represents the statistical summary for a single dataset column, including basic counts and type-specific metrics like descriptive statistics for numbers or top frequencies for strings.
  * **Caveat:** The `"date"` type is defined in the `type` union but is never actually inferred or populated by the current `analyzeData` implementation.

* **`AnalysisResult`** (Interface)
  * **Purpose:** Represents the complete output of a dataset analysis operation, containing dimensional counts, per-column statistics, a text summary, and an optional auto-generated SVG chart alongside its saved file path.

* **`analyzeData`** (Function)
  * **Purpose:** Parses CSV data to compute descriptive statistics and optionally generates an aggregated bar chart.
  * **`@param input`** — Raw CSV text, or an object containing `path` and `workspaceRoot` to read a CSV file from disk.
  * **`@param opts`** — Configuration object containing `workspaceRoot` (used for secure path resolution and saving artifacts) and `maxRows` (limits processing, defaults to 10,000).
  * **`@returns`** — A `Promise<AnalysisResult>` containing row/column counts, detailed column stats, a text summary, and optional chart SVG/path.
  * **Caveats & Non-obvious Behavior:**
    * **Security:** Throws an error if the resolved file path escapes the provided `workspaceRoot` (strict path traversal protection).
    * **Type Inference:** A column is inferred as `"number"` only if >70% of its non-empty cells parse as valid numbers; otherwise, it defaults to `"string"`.
    * **Chart Generation:** An SVG bar chart is automatically generated only if the dataset contains at least one categorical column (≤20 unique values) and one numeric column. It aggregates the numeric column by the categorical one.
    * **Artifact Saving:** If a chart is generated and `opts.workspaceRoot` is provided, the SVG is automatically written to `<workspaceRoot>/artifacts/charts/chart-<timestamp>.svg`.
