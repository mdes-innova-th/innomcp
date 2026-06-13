<!-- cc-team deliverable
 group: G1 (deadcode division)
 member: DEA-010 role=deadcode model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":2279,"completion_tokens":1147,"total_tokens":3426,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 35s
 generated: 2026-06-13T12:01:06.887Z -->
# Dead/Unused Code Audit: `dataAnalysisTool.ts`

After careful review of this self-contained module, I found **no high-confidence dead code items**. The code is a single-file module with one exported function (`analyzeData`), one exported interface used by that function (`AnalysisResult`), and one supporting exported type (`ColumnStats`) that is referenced in `AnalysisResult.columns`. All non-exported helpers (`parseCSV`, `numStats`, `barChartSvg`) are used internally. Below are the items I considered and rejected, with reasoning — including one **potentially risky** pattern worth flagging separately.

## Items Considered and Rejected (Not High-Confidence)

| Location | What | Why **not** flagged |
|---|---|---|
| `parseCSV` lines 0–17 | Inner `if (lines.length === 0) return { headers: [], rows: [] }` guard | High-confidence *not* dead: reachable whenever `text.trim()` is empty/whitespace, and defensively guards the `lines[0].split` access. |
| `parseCSV` cell loop | `inQ` toggle on `'"'` characters | High-confidence *not* dead: this is the CSV quoted-field state machine; removing it would break any CSV containing commas inside quotes. |
| `numStats` `if (vals.length === 0) return {}` | Empty-array guard | Reachable: `analyzeData` computes `numVals` from a column that may have no parseable numbers, then calls `numStats(numVals)`. |
| `numStats` `.toFixed(3)` rounding | Could be "redundant" precision handling | Behavioral, not dead — affects output values. Out of scope for this audit. |
| `barChartSvg` `Math.max(labels.length, 1)` | Defensive divisor | Reachable: `labels` is only built when `topEntries.length >= 2`, but the guard is cheap defensive code, not dead. |
| `barChartSvg` `maxVal = Math.max(...values, 1)` | The `, 1` fallback | Reachable when all values are 0 or NaN; `Math.max(...[])` returns `-Infinity`, so the `1` is load-bearing. |
| `analyzeData` `type: "date"` in `ColumnStats` union | No code path sets it | **Considered flagging**, but the type is part of the *public exported interface* `ColumnStats`. External consumers may rely on it, and tightening it is a breaking change. Conservative call: do not remove. |
| `ColumnStats` optional fields (`unique`, `min`, `max`, etc.) | Many are conditionally set | All are populated on their respective code paths (numeric vs. string branch). Not dead. |
| `unique` field in string branch | Set on both branches | Both numeric and string branches set it; used by the chart-selection logic (`c.unique ?? 0 <= 20`). Not dead. |
| Comment `// Find best numeric column for chart` | Commented intent | It's a one-line comment, not a commented-out *block* of code. Out of scope. |
| `topEntries.length >= 2` guard | Redundant-looking? | Reachable: `aggr` can have 0 or 1 entries if the categorical column has no overlapping numeric values; the guard prevents emitting a degenerate 1-bar chart. Not dead. |
| `opts = { workspaceRoot: "" }` default | Default param never matches real usage | Not dead — it's a valid default that lets `input: string` callers omit `opts`. Removing it would be a breaking signature change. |
| `input.path.replace(/^\/+/, "")` | Strips leading slashes | Load-bearing: paired with the `safePath.startsWith(input.workspaceRoot)` check to prevent traversal. Not dead. |

## ⚠️ Worth Flagging (Not Dead Code, But Adjacent Risk)

| Location | What | Note |
|---|---|---|
| `analyzeData`, `if (typeof input === "string")` branch | When `input` is a string, `opts.workspaceRoot` may be `""` (the default), so the `if (chartSvg && opts.workspaceRoot)` branch is **unreachable** for string-input callers — `chartSvg` is still returned inline, but no `artifactPath` is ever written. | Not dead code per se, but a latent behavior gap: callers passing a CSV string will never get `artifactPath` populated. Worth a comment or a code change, not a deletion. |
| `ColumnStats.type` `"date"` variant | Declared but never produced | Borderline dead type variant. I did **not** flag it as safe-to-remove because it's part of the exported contract; removing it requires confirming no downstream consumer narrows on `"date"`. |
| `catCols` filter `c.unique ?? 0 <= 20` | `?? 0` is unreachable here — `unique` is always set on string columns in this file | Micro-redundancy only, and still defensive against future schema changes. Not high-confidence. |

## Summary

**High-confidence dead code removals: 0.**

The module is compact and internally consistent: every helper is called, every branch is reachable, every exported symbol is used. The one structural smell — the `"date"` type variant that no code path produces — touches a public type and should be resolved by confirming downstream usage rather than by deletion.
