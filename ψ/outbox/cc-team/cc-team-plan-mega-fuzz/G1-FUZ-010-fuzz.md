<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-010 role=fuzz model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":2291,"completion_tokens":3442,"total_tokens":5733,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 78s
 generated: 2026-06-13T12:01:34.590Z -->
```markdown
# Property-Based / Fuzz Test Cases — `dataAnalysisTool.ts`

## Parser Invariants

- **P1: Empty/whitespace-only input returns empty result** → fuzz: `""`, `"   "`, `"\n\n\n"`, `"\t\r\n"` → expected: `rowCount=0, colCount=0, columns=[], summary` non-throwing, no chart.
- **P2: Header count matches parsed column count** → fuzz: random N∈[1,30] headers + N-aligned then misaligned rows → expected: `colCount === columns.length === headers.length`; row cells may be short but never extend `columns`.
- **P3: `nullCount` = rows where that column index is missing/empty after trim** → fuzz: rows with `undefined`, `""`, `"   "`, short rows → expected: `nullCount === limitedRows.length - cellVals.length` per column.
- **P4: Type detection threshold (70% numeric)** → fuzz: column with ratios 0%, 69%, 70%, 71%, 100% numeric strings ("1","2","3",…,"x") → expected: type flips exactly at >70%; numeric column returns `min/max/mean/median/stdDev`; string column returns `topValues`.
- **P5: Numeric coercion rejects NaN but accepts sci notation/exponents/negatives** → fuzz: `"1e308"`, `"-0"`, `"NaN"`, `"Infinity"`, `"-Infinity"`, `"1e-500"` (→0), `"0.0"`, `"0001"` → expected: `NaN/Infinity` excluded from `numVals`; `count` reflects filtered; no NaN in returned stats.
- **P6: Median correctness for odd/even lengths** → fuzz: random integer arrays length 1,2,3,7,100,1000, identical-value arrays → expected: `min ≤ median ≤ max`; `min === max === mean === median === stdDev` for single-unique arrays; even-length median is average of two middles.
- **P7: `mean` and `stdDev` rounded to 3 decimals** → fuzz: values producing repeating decimals (`1/3`, `2/7`) → expected: `mean`, `stdDev` are integers with ≤3 decimal places (no `1.3333334`).
- **P8: `unique` matches `Set` cardinality** → fuzz: strings with unicode duplicates (`"café"` vs `"cafe\u0301"`), whitespace variants, case variants → expected: `unique` ≤ `count`; case-sensitive (no normalization).
- **P9: `topValues` length ≤ 5, sorted by count desc** → fuzz: columns with 0,1,2,10,1000 distinct strings → expected: `topValues.length = min(unique,5)`; counts monotonically non-increasing; tie-break stable.
- **P10: `rowCount` ≤ `maxRows` and ≤ input row count** → fuzz: `maxRows=0,1,5,100,10000`; CSV with 50k rows → expected: `rowCount === min(parsedRows, maxRows)`.

## CSV Parser Robustness

- **P11: Quoted commas preserved, unquoted commas split** → fuzz: `'a,b\n"x,y",2\n3,4'` → expected: 2 columns, row1=`["x,y","2"]`.
- **P12: Unbalanced quotes toggle inQ forever** → fuzz: `'"a,b,c\n2,3,4'` (odd quote count) → expected: must not throw; subsequent text treated as one cell — invariant: result is well-formed (arrays of strings).
- **P13: Embedded newlines inside quotes break row split** (known limitation) → fuzz: `'a,b\n"x\ny",2'` → expected: doesn't crash; downstream stats still defined, even if row count wrong.
- **P14: Trailing comma / empty trailing cell** → fuzz: `'a,b,c\n1,2,'`, `'a,b\n1,2,3,4'` → expected: no crash; `colCount` taken from header; missing trailing cell counts toward `nullCount`.
- **P15: CRLF / LF / CR line endings** → fuzz: mixed `\r\n`, `\n`, lone `\r` in same input → expected: identical row count vs LF-only equivalent.
- **P16: BOM at file start** → fuzz: `'\uFEFFa,b\n1,2'` → expected: must not include BOM in first header name (current impl likely fails — flag if header starts with `\uFEFF`).
- **P17: Header row with empty/duplicate header names** → fuzz: `",b,b\n1,2,3"` → expected: `columns[0].name === ""`; downstream `headers.indexOf(name)` returns first match (duplicate `b` → always first index).
- **P18: Non-string characters / control bytes** → fuzz: `'\x00a,b\n\x001,2'`, embedded `\x01-\x1f` → expected: does not throw `TypeError`; control bytes survive as cell content.
- **P19: Very long rows / cells** → fuzz: 1MB single cell, 100k column row → expected: completes; `topValues` values may be truncated only by `.slice(0,8)` in **chart label**, not in `topValues[].value`.
- **P20: Negative numeric parsing** → fuzz: `"-1,-2\n-3,-4"` → expected: `min<0`, `max<0`, stats negative.

## Path / IO Invariants

- **P21: Path traversal blocked** → fuzz: `{ path: "../../../etc/passwd", workspaceRoot: "/safe" }`, `{ path: "/etc/passwd" }`, `{ path: "..", workspaceRoot: "" }` → expected: throws `Error("Path outside workspace")`; never reads outside `path.resolve(workspaceRoot)`.
- **P22: WorkspaceRoot must be absolute prefix** → fuzz: `workspaceRoot="/safe"`, `path="safeOther/file.csv"` (sibling prefix attack) → expected: `path.resolve("/safe","safeOther/file.csv") === "/safe/safeOther/file.csv"` which **startsWith "/safe"** → passes. Confirm no sibling-prefix bypass exists. Also test `workspaceRoot=""` + `path="/abs"` → `path.resolve("","/abs")` → should reject? Current check: `safePath.startsWith("")` is always true → **invariant violated**: empty `workspaceRoot` disables traversal guard.
- **P23: Missing file throws** → fuzz: `path="nope.csv"` in valid workspace → expected: rejects with `ENOENT`-derived error, not silent empty.
- **P24: Non-UTF-8 file** → fuzz: latin1 / UTF-16 BOM file → expected: `fs.readFile(..., "utf-8")` may return mojibake but must not throw; downstream parse is still defined.
- **P25: Directory passed as path** → fuzz: `path="."` → expected: `EISDIR` error, not silent.
- **P26: Symlink escape** → fuzz: symlink inside workspace pointing outside → expected: `fs.readFile` follows symlink; current code does not check `realpath` → **invariant**: after `realpath`, must still be inside workspace. Test reveals gap.
- **P27: `artifactPath` only written when `workspaceRoot` set AND chart produced** → fuzz: chart-eligible data + `workspaceRoot=""` → expected: `artifactPath === undefined`, no directory created; `{workspaceRoot:"/tmp/x"}` with no chart → expected: no `artifacts/charts` dir.

## Chart Generation

- **P28: Chart only emitted when ≥1 numeric col AND ≥1 categorical col with ≤20 unique AND ≥2 aggregated groups** → fuzz: 0 num / 0 cat / 1 cat / 21 unique cat / 1 aggregated group / 2 groups → expected: `chartSvg` present iff all three conditions met.
- **P29: Chart labels truncated to 8 chars** → fuzz: category names of length 0,1,8,9,100, unicode `"🚀".repeat(50)` → expected: SVG `text` content for labels ≤ 8 chars (or surrogate-clipped); `topValues[].value` untruncated.
- **P30: SVG contains no unescaped label injection** → fuzz: label = `"/></text><script>alert(1)</script>` → expected: **invariant violated** in current code (raw interpolation) — flag as XSS-in-SVG; expect sanitizer or escape. Test should fail on current impl.
- **P31: `BAR_W` never negative even with many labels** → fuzz: `labels.length=200` → expected: `BAR_W = min(30, floor((400)/200) - 4) = min(30, -2) = -2` → **invariant violated**: negative `width` attribute. Test should fail.
- **P32: `Math.max(...values, 1)` handles empty/zero arrays** → fuzz: aggregated group where all values filtered out → expected: `maxVal ≥ 1`; `barH = 0` for zero-mean groups; no NaN from `0/0` (currently protected by the `, 1`).
- **P33: Chart axes always drawn at PAD=40 boundaries** → fuzz: any label/value set → expected: SVG contains `<line x1="40"` and `x2="${W-40}"` literally; rectangle `x ≥ 40` and `x+width ≤ 440`.
- **P34: Summary string contains row + column counts** → fuzz: 0/0, 1/1, 1000/50 → expected: `"<n> rows, <m> columns."` substring present; "Numeric: none" when no numeric col; "Categorical: none" when no cat col.

## Numeric Edge Cases

- **P35: All-null column** → fuzz: column with all `""` or all missing index → expected: `count=0, nullCount=rows`, `min/max/mean/median/stdDev` all `undefined`; no division by zero in `numStats` (guarded by `vals.length===0`).
- **P36: Single value column** → fuzz: `["7"]` → expected: `min=max=mean=median=7, stdDev=0`.
- **P37: Overflow / near-`Number.MAX_VALUE`** → fuzz: `["1e308","1e308","1e308"]` → expected: `mean ≈ 1e308`, no `Infinity`; `sum + v` must not exceed `Number.MAX_VALUE` (3×1e308 = `Infinity` → **invariant violated** for this exact input). Test should fail.
- **P38: Mixed numeric + non-numeric in "numeric" column** → fuzz: `["1","2","x","4","5"]` (80% numeric → numeric type) → expected: `count=4`, `nullCount` counts only true empties, not the `"x"`.
- **P39: Date-like strings** → fuzz: `"2024-01-01"`, `"01/02/2024"`, `"Jan 1"` → expected: `Number("2024-01-01")=NaN` → classified as `string`; `type !== "date"` despite the `ColumnStats` type union including `"date"` (currently unreachable code path).
- **P40: Boolean-looking strings** → fuzz: `"true","false","TRUE","0","1"` → expected: `Number("true")=NaN` → string column; `Number("0")=0`, `Number("1")=1` → numeric if ≥70%.

## Concurrency / Idempotence

- **P41: Concurrent calls produce distinct `artifactPath` filenames** → fuzz: 100 parallel `analyzeData` with chart-eligible data + same `workspaceRoot` → expected: 100 distinct `chart-<ts>.svg` files; no clobber. Current impl uses `Date.now()` only — **invariant violated** under sub-ms parallelism. Test should fail.
- **P42: Repeated identical call idempotent on parsed result** → fuzz: same input 1000× → expected: identical `columns`, `rowCount`, `colCount`, `summary` content (chart SVG identical; artifact path differs by timestamp only).
- **P43: `maxRows=0` produces headers-only result** → fuzz: CSV with data + `maxRows=0` → expected: `rowCount=0`, all columns have `count=0, nullCount=0`, `chartSvg` undefined (no aggregated groups).

## Type / Shape Invariants

- **P44: `ColumnStats.type` is one of the three literals** → fuzz: every heuristic path → expected: `type ∈ {"number","string","date"}`; `"date"` is currently dead code.
- **P45: `topValues` only present on string columns** → fuzz: numeric and string columns side-by-side → expected: numeric column has no `topValues` key (spread from `numStats`); string has it.
- **P46: `AnalysisResult` shape stability** → fuzz: any valid input → expected: keys exactly `{rowCount, colCount, columns, summary, chartSvg?, artifactPath?}`; no extra keys leaked.
- **P47: `summary` is a string, never throws on `.toFixed` of undefined** → fuzz: numeric column with empty values → expected: `c.mean?.toFixed(2)` short-circuits via `?.`; no `TypeError`. Verify.
- **P48: `numCols` / `catCols` filters stable** → fuzz: column where `unique === 20` vs `21` → expected: cat boundary is `≤ 20` inclusive; 20 included, 21 excluded.

## Adversarial Inputs

- **P49: CSV that is a valid JS prototype pollution vector** → fuzz: header `__proto__` or `constructor` → expected: no mutation of `Object.prototype`; `columns` is a plain array of plain objects.
- **P50: Header injection of HTML/SVG via column name** → fuzz: `name = "<script>alert(1)</script>"` → expected: when used in `barChartSvg` title (currently not — title uses `${num.name} by ${cat.name}` in chart axis label) → **invariant violated** if title not sanitized. Test reveals XSS in title text.
- **P51: Massive unique cardinality forces memory** → fuzz: 100k-row column of UUIDs → expected: completes; `unique` correct; `topValues` length 5; memory bounded.
- **P52: Path with null bytes** → fuzz: `{ path: "good\u0000.csv", workspaceRoot: "/safe" }` → expected: Node rejects with `ERR_INVALID_ARG_VALUE` or similar, not silent.
- **P53: Workspace root with trailing slash inconsistency** → fuzz: `workspaceRoot="/safe/"` vs `"/safe"` → expected: `safePath.startsWith(workspaceRoot)` semantics differ — `"/safe-other/x".startsWith("/safe/")` is false (good) but `"/safe".startsWith("/safe")` works; document the contract: no trailing slash required, but if provided must be normalized. Test both.
- **P54: `input` is non-string non-object (e.g., number, null)** → fuzz: `analyzeData(123 as any, ...)` → expected: TypeScript rejects at compile; runtime would throw on `typeof input === "string"` check falling through to object branch and crashing on `.path`. Add runtime guard or assert.
```
