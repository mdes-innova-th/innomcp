<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-010 role=trace model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":2281,"completion_tokens":2085,"total_tokens":4366,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 42s
 generated: 2026-06-13T12:00:45.503Z -->
# Data Flow Trace: `dataAnalysisTool.ts::analyzeData`

## Entry (Step 0)

- **Input `input`**: `string` (raw CSV text) **OR** `{ path: string; workspaceRoot: string }` (file reference)
- **Input `opts`**: `{ workspaceRoot: string; maxRows?: number }`, default `maxRows = 10_000`
- **Source**: caller in MCP tool layer
- **Exit contract**: `Promise<AnalysisResult>`

---

## Step 1 — Input Materialization

- **Enters**: `input` (union) + `opts.workspaceRoot`
- **Transformation**:
  - Branch on `typeof input === "string"`:
    - `string` branch: `text = input` (no I/O)
    - `object` branch:
      - `safePath = path.resolve(input.workspaceRoot, input.path.lstrip("/"))` (file system path)
      - **Security check**: throws `Error("Path outside workspace")` if `safePath` does not start with `input.workspaceRoot` (path-traversal guard)
      - **Side effect (network/disk)**: `await fs.readFile(safePath, "utf-8")` → filesystem read
- **Exits**: `text: string` (full CSV)
- **Side effects**: FS read (object branch only) or error throw

## Step 2 — CSV Parsing

- **Enters**: `text: string`
- **Transformation in `parseCSV`**:
  - `lines = text.split(/\r?\n/).filter(l => l.trim())` → `string[]`
  - `headers = lines[0].split(",").map(stripQuotes).map(trim)` → `string[]`
  - For each subsequent line: hand-rolled character loop tracks `inQ` (quote flag), splits on unquoted commas → `string[][]`
- **Exits**: `{ headers: string[]; rows: string[][] }`
- **Shape**: `rows` is `N × C` (C = headers.length, but ragged if rows have fewer cells)
- **Side effects**: none

## Step 3 — Row Limiting

- **Enters**: `rows: string[][]`, `maxRows = opts.maxRows ?? 10_000`
- **Transformation**: `limitedRows = rows.slice(0, maxRows)`
- **Exits**: `limitedRows: string[][]` (≤ 10,000 rows)
- **Side effects**: none

## Step 4 — Per-Column Statistical Reduction (the main loop)

For each column index `ci` ∈ `[0, headers.length)`:

### 4a — Cell extraction
- `cellVals = limitedRows.map(r => r[ci]?.trim() ?? "").filter(v => v !== "")` → `string[]`
- `nullCount = limitedRows.length - cellVals.length` → `number`

### 4b — Type inference
- `numVals = cellVals.map(Number).filter(!isNaN)` → `number[]`
- `isNumeric = numVals.length > cellVals.length * 0.7` → `boolean` (numeric iff >70% parse)

### 4c — Numeric branch
- `numStats(numVals)` computes (when `numVals.length > 0`):
  - `sorted` copy (ascending)
  - `mean = sum / n`
  - `median` (midpoint or midpoint pair)
  - `variance = Σ(v − mean)² / n`, then `stdDev = √variance`
  - All rounded to 3 decimals via `toFixed(3)` + unary `+`
- **Exits** `ColumnStats`: `{ name, type:"number", count: numVals.length, nullCount, unique: Set(numVals).size, min, max, mean, median, stdDev }`

### 4d — String branch (else)
- Build `freq: Map<string, number>` over `cellVals`
- `topValues = freq.entries().sortDesc().take(5).map({value, count})` → `Array<{value, count}>` (≤5)
- **Exits** `ColumnStats`: `{ name, type:"string", count: cellVals.length, nullCount, unique: freq.size, topValues }`
- No `date` branch is ever taken despite the type union declaring it.
- **Side effects**: none

## Step 5 — Column Partitioning

- `numCols = columns.filter(c => c.type === "number")` → `ColumnStats[]`
- `catCols = columns.filter(c => c.type === "string" && (c.unique ?? 0) <= 20)` → `ColumnStats[]` (categorical = low-cardinality string)
- **Side effects**: none

## Step 6 — Chart Generation (conditional)

- **Guard**: `if (catCols.length > 0 && numCols.length > 0)`
- Pick `cat = catCols[0]`, `num = numCols[0]` (first of each — **deterministic, not "best"**)
- Resolve column indices: `catIdx`, `numIdx`
- **Aggregation** (second pass over `limitedRows`):
  - `aggr: Map<string, number[]>` keyed by categorical value, accumulating numeric values
  - Skip rows where key empty or value NaN
  - `topEntries = [...aggr.entries()].slice(0, 10)` → keeps insertion order, **not** sorted by frequency
- **Guard**: only if `topEntries.length >= 2`
- Compute bar values: `vals[i] = mean of vs[i]`
- **Side effect: CPU only** — `barChartSvg(labels, vals, title)` returns `string` (SVG, dimensions 480×220)
  - Internals: `maxVal = max(...values, 1)`, `BAR_W` clamped, each bar rendered as `<rect>` + 2 `<text>` elements; y-axis and x-axis baseline `<line>`s appended
- **Exits**: `chartSvg: string | undefined`
- **Side effects**: none (pure string build)

## Step 7 — Summary String Assembly

- `numSummary = numCols.map("name: min, max, mean(2dp)").join("; ")`
- `catSummary = catCols.map("name: N unique values").join("; ")`
- `summary = "${limitedRows.length} rows, ${headers.length} columns. Numeric: … Categorical: …"`
- **Exits**: `summary: string`
- **Side effects**: none

## Step 8 — Artifact Persistence (conditional)

- **Guard**: `if (chartSvg && opts.workspaceRoot)`
- `dir = path.resolve(opts.workspaceRoot, "artifacts", "charts")`
- `fname = "chart-${Date.now()}.svg"` (epoch ms timestamp — collision risk under concurrency)
- **Side effects (disk)**:
  1. `await fs.mkdir(dir, { recursive: true })` — creates nested dirs
  2. `await fs.writeFile(artifactPath, chartSvg, "utf-8")` — writes SVG
- **Exits**: `artifactPath: string | undefined` (absolute path)
- **Side effects**: FS write, **no network**, **no DB**, **no events emitted**, **no in-process state mutation**

## Step 9 — Return

- **Exits** to caller: `Promise<AnalysisResult>` resolving to:
  ```
  {
    rowCount: limitedRows.length,         // number
    colCount: headers.length,             // number
    columns: ColumnStats[],               // per-column stats
    summary: string,                      // human-readable
    chartSvg: string | undefined,         // SVG XML or absent
    artifactPath: string | undefined      // absolute FS path or absent
  }
  ```
- **Destination**: MCP tool response handler (caller not visible in this module)

---

## Side-Effect Inventory (consolidated)

| Type | Where | Notes |
|---|---|---|
| **FS read** | Step 1 (object branch) | Guarded by path-traversal check |
| **FS mkdir** | Step 8 | `recursive: true` |
| **FS write** | Step 8 | Filename = `chart-<epochMs>.svg` |
| **Network** | — | none |
| **Database** | — | none |
| **Event emit** | — | none |
| **Process state** | — | none (no module-level mutable state) |
| **Throws** | Step 1 | `Error("Path outside workspace")` on traversal attempt; `fs` rejections propagate |

## Notable Data Hazards

1. **Ragged rows**: cells missing for a column become `""` → counted as null. Extra cells are silently dropped (no overrun handling in the parser).
2. **Quote handling**: doubled-quote escaping (`""` → `"`) is **not implemented** — `inQ` toggles but embedded quotes corrupt the cell.
3. **`type: "date"`** is declared in `ColumnStats` but **never produced**.
4. **"Best" column selection** (comment) is a lie — it always picks `catCols[0]` / `numCols[0]`.
5. **Top-N categorical entries** for chart use insertion order, not frequency, so the bar order is non-deterministic w.r.t. data distribution.
6. **Filename collision**: `Date.now()` granularity → concurrent calls within the same ms overwrite each other.
7. **Numeric coercion is permissive**: `Number("")` = 0 is filtered, but `Number("1e1000")` = `Infinity` is **not** filtered and will poison `mean`/`stdDev`.
