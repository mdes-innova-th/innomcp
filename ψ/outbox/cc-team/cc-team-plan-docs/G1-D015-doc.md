<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D015 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":698,"completion_tokens":293,"total_tokens":991,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 7s
 generated: 2026-06-13T11:21:14.870Z -->
- **`ExportOptions`** — Options for export calls. `@param limit` — caps the number of most recent `MotherRun` entries retrieved; omit/leave undefined to use the underlying `motherHistory` default.

- **`exportToJSON(options?)`** — Serializes the current mother dispatch history to a pretty-printed JSON string (2-space indent). `@param options` — optional `ExportOptions`; `@returns` JSON string of the run history array.

- **`exportToCSV(options?)`** — Serializes the history to CSV where each row is one provider's result within a run. `@param options` — optional `ExportOptions`; `@returns` CSV string (header + rows) or the literal `"No history available to export."` when history is empty. Caveats: `query` and `preview` values are wrapped in double quotes with embedded `"` escaped as `""`; `success` is emitted as the strings `"TRUE"`/`"FALSE"`; `qualityScore` becomes `"N/A"` when `null`/`undefined`; not RFC 4180 compliant for fields containing newlines (no surrounding quotes are added beyond the escape pattern), so multi-line `preview`/`query` values will produce malformed CSV.

- **`motherExportService`** — Convenience singleton bundling the exporters as `{ toJSON, toCSV }`, each delegating to the corresponding `exportToJSON` / `exportToCSV` function.
