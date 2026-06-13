<!-- cc-team deliverable
 group: G1 (dataflow division)
 member: DAT-008 role=trace model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":2111,"completion_tokens":5000,"total_tokens":7111,"prompt_tokens_details":{"cached_tokens":55,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 48s
 generated: 2026-06-13T12:00:17.206Z -->
The user wants a TRACE pass through the `coldRetriever.ts` module. This means I need to trace the data flow: what enters, each transformation step, what exits, and side-effects (db/network/events/state). Output should be an ordered step list, concrete.

Let me analyze the code carefully.

First, let's identify the entry points and data flows:

1. **Entry: `loadCorpus(corpusDir: string)`**
   - Input: `corpusDir` (string - filesystem path)
   - Source: Caller (likely initialization code or another service)

2. **Inside `loadCorpus`:**
   - Calls `this.listFiles(corpusDir)` - though `listFiles` isn't shown in the snippet, it presumably returns `string[]` of file paths. It likely uses `fs.readdirSync` or similar recursively.
   - Filters by extension `.md`, `.txt`
   - Skips `node_modules`, `.git`
   - Reads file: `fs.readFileSync(file, "utf-8")` → `content` (string)
   - Gets `relativePath` via `path.relative`
   - Computes `docId` = `cold:${relativePath}`
   - Extracts `tags` via `extractTags(content, relativePath)`
   - Gets file stats via `fs.statSync(file)` → `stat`
   - Extracts title via `extractTitle(content, file)`
   - Chunks text via `chunkText(content, docId)` → `ColdChunk[]`
   - Constructs `ColdDocument` object
   - Pushes to `this.documents` (state mutation)
   - After loop: calls `this.buildIDF()` (not shown in snippet but referenced - it presumably builds `this.idfMap`)
   - Sets `this.initialized = true`
   - Returns `{ docCount, chunkCount }`

3. **Inside `chunkText`:**
   - Input: `text` (string), `docId` (string)
   - Splits text by newlines → `lines`
   - Iterates, accumulates buffer
   - When buffer >= 500 chars or last line, creates chunk with trimmed content
   - Overlap logic: keeps last 100 chars
   - Returns `ColdChunk[]`

4. **Inside `extractTitle`:**
   - Input: `content` (string), `filePath` (string)
   - Regex match for markdown heading `/^#\s+(.+)$/m`
   - Fallback to basename without ext
   - Returns string

5. **Inside `extractTags`:**
   - Input: `content` (string), `filePath` (string)
   - Matches YAML frontmatter `---\n...\n---`
   - Extracts tags array from frontmatter
   - Adds domain tags based on regex tests on `filePath`
   - Returns deduplicated string array

6. **Inside `inferDomain`:**
   - Input: `tags` (string[]), `filePath` (string) - though filePath unused in the shown code? Wait, looking at the code: `function inferDomain(tags: string[], filePath: string)` but `filePath` is not used in the body. The body only checks tags. But it's called with `inferDomain(tags, relativePath)`.
   - Returns domain string

7. **Inside `buildIDF`:** Not shown in snippet, but it's called. It presumably iterates over all documents/chunks, tokenizes, computes document frequency, and populates `this.idfMap`. I need to mention it as a transformation step even if not fully shown, but I should note it's referenced. Actually, looking at the code, `buildIDF` is not defined in the shown snippet. But it's clearly called. I should trace it as a "black box" step or infer from context. Since the user asked to trace the module, and it's part of the module's flow, I should include it but note it's internal. Wait, the user said "TRACE data flow through this module". Since `buildIDF` isn't shown, I should probably mention it as a step that transforms `this.documents` into `this.idfMap`. But I can't see its implementation. I'll describe it based on standard TF-IDF and the fact that `computeTFIDF` uses `idfMap`.

8. **Entry: `search(query: string, options?)`**
   - Input: `query` (string), `options` (optional object with `maxResults`, `domain`)
   - Source: Caller (likely query processor or orchestrator)

9. **Inside `search`:**
   - Checks `this.initialized` and `this.documents.length`
   - Sets defaults
   - Iterates `this.documents`
   - Filters by `domainFilter` if provided
   - Iterates `doc.chunks`
   - Calls `computeTFIDF(query, chunk.content, this.idfMap)` → `score` (number)
   - Calls `this.keywordBoost(query, chunk.content)` → `keywordBoost` (number) - though `keywordBoost` method isn't shown in the snippet, it's referenced.
   - Computes `totalScore = score + keywordBoost`
   - Filters `totalScore > 0`
   - Pushes to `scored` array
   - Sorts by score descending
   - Slices top `maxResults`
   - Maps to `ColdRetrievalResult[]` including `source` object with computed `freshness` and `confidence`

10. **Inside `computeTFIDF`:**
    - Input: `query` (string), `chunk` (string), `idfMap` (Map<string, number>)
    - Tokenizes both
    - Computes term frequency in chunk
    - Sums `tf * idf` for query tokens
    - Returns number

11. **Inside `computeDocFreshness`:** Not shown but referenced in `search`. Called with `updatedAt` string. Returns something (likely number or string).

12. **Inside `getRegistry()`:**
    - Returns list of indexed docs (truncated in snippet, but presumably `this.documents` or mapped version)
    - Input: none
    - Output: Array of something

13. **State/Side-effects:**
    - `this.documents`: mutated in `loadCorpus`, read in `search` and `getRegistry`
    - `this.idfMap`: mutated in `loadCorpus` (via `buildIDF`), read in `search`
    - `this.initialized`: boolean flag mutated in `loadCorpus`
    - Console logs: `console.warn`, `console.log`
    - File system reads: `fs.existsSync`, `fs.readFileSync`, `fs.statSync`, `this.listFiles` (presumably uses fs)
    - No DB, no network, no events emitted.

Wait, I need to be careful. The user wants concrete shapes and sources. Let me structure this as an ordered step list.

I should trace two main flows:
A) Indexing flow (`loadCorpus`)
B) Query flow (`search`)

But the prompt says "TRACE data flow through this module (a /trace pass)". Usually this means trace the data as it moves through the module. I can present it as two separate flows or one combined ordered list. Since they are distinct operations (initialization vs runtime), I should probably present them as two ordered traces, or clearly demarcate them. An ordered step list covering both with clear entry points makes sense.

Let me draft the steps:

**Flow A: Corpus Ingestion & Indexing (`loadCorpus`)**

1. **Entry**: `corpusDir` (string: absolute filesystem path) enters via `loadCorpus()` call from external initializer.
2. **State Reset**: `this.documents` cleared to `[]`, `this.idfMap` cleared to `new Map()`, `this.initialized` set false (implicitly by reset).
3. **Filesystem Probe**: `fs.existsSync(corpusDir)` checks directory existence. If false → early return `{0,0}` + console.warn side-effect.
4. **File Discovery**: `this.listFiles(corpusDir)` returns `string[]` of absolute file paths (recursive directory traversal via fs).
5. **Extension & Path Filter**: Array filtered to `.md`/`.txt` extensions; excludes paths containing `node_modules` or `.git`.
6. **File Read**: For each surviving file path, `fs.readFileSync(file, "utf-8")` produces raw `content` (string). Empty/whitespace-only content skipped.
7. **Path Derivation**: `path.relative(corpusDir, file)` + normalize backslashes → `relativePath` (string, e.g., `docs/law/penal.md`).
8. **Metadata Extraction**:
   - `fs.statSync(file)` → `stat` object (side-effect: filesystem read).
   - `extractTitle(content, file)` → `title` (string). Transforms content via regex `/^#\s+(.+)$/m`, falls back to basename.
   - `extractTags(content, relativePath)` → `tags` (string[]). Transforms content via YAML frontmatter regex and path regex heuristics.
   - `inferDomain(tags, relativePath)` → `domain` (string). Transforms tags array via tag-to-domain mapping.
9. **Chunking**: `chunkText(content, docId)` → `ColdChunk[]`. Transforms raw text string into array of chunk objects (shape: `{id, documentId, content, index, startLine, endLine}`). Splits on newlines, buffers up to 500 chars with 100 char overlap.
10. **Document Assembly**: Object assembled into `ColdDocument` shape `{id, path, title, content, chunks, metadata}` where `id = "cold:" + relativePath`.
11. **Registry Accumulation**: Document pushed into `this.documents` (in-memory array state mutation).
12. **IDF Build**: `this.buildIDF()` called (internal method). Transforms the full `this.documents` corpus into `this.idfMap` (`Map<string, number>`) by computing inverse document frequencies across all chunk tokens. (Note: implementation not shown in snippet, but it's a state mutation side-effect).
13. **Initialization Flag**: `this.initialized` set to `true`.
14. **Exit**: Returns `{ docCount: number, chunkCount: number }` to caller. Side-effect: `console.log` with counts.

**Flow B: Retrieval (`search`)**

15. **Entry**: `query` (string: user query text) and `options` (optional `{maxResults?: number, domain?: string}`) enter via `search()` call.
16. **Guard Check**: Reads `this.initialized` and `this.documents.length`. If false/empty → returns `[]` (early exit).
17. **Option Defaults**: `maxResults` defaults to 5; `domainFilter` extracted.
18. **Corpus Scan**: Iterates over `this.documents` (in-memory state). If `domainFilter` present, skips documents where `doc.metadata.domain !== domainFilter`.
19. **Chunk Scoring**: For each chunk in each surviving document:
    - `tokenize(query)` → query tokens (`string[]`).
    - `tokenize(chunk.content)` → chunk tokens (`string[]`).
    - `computeTFIDF(...)` reads `this.idfMap` (state) and returns `score` (number: TF-IDF dot product).
    - `this.keywordBoost(query, chunk.content)` → `keywordBoost` (number). (Method not shown in snippet).
    - `totalScore = score + keywordBoost` (number).
    - Filter: only keep if `totalScore > 0`.
20. **Ranking Accumulation**: Surviving `{chunk, doc, score}` tuples pushed into `scored` array (local variable).
21. **Sort**: `scored` sorted descending by `score` (in-place array transformation).
22. **Top-K Slice**: First `maxResults` elements extracted.
23. **Result Mapping**: Each tuple mapped to `ColdRetrievalResult` shape:
    - `chunk`, `document`, `score` passed through.
    - `source` object constructed: `{id, type:"document", name, path, freshness, timestamp, confidence}`. `freshness` computed by `this.computeDocFreshness(doc.metadata.updatedAt)` (method not shown). `confidence` clamped to `Math.min(0.95, score * 2)`.
24. **Exit**: Returns `ColdRetrievalResult[]` (array of result objects) to caller. No DB/network/events. Pure read against in-memory state.

**Flow C: Registry Query (`getRegistry`)**
25. **Entry**: Call to `getRegistry()` (no inputs).
26. **Read**: Reads `this.documents` (or derived mapping).
27. **Exit**: Returns array of document metadata/listings to caller.

**Side-effects summary**:
- **State mutations**: `this.documents`, `this.idfMap`, `this.initialized`.
- **Filesystem I/O**: `fs.existsSync`, `fs.readFileSync`, `fs.statSync`, directory listing (via `listFiles`).
- **Console I/O**: `console.warn`, `console.log`.
- **No external network/DB/events**.

I should make sure to mention the shapes concretely. The user asked for "Concrete."

Let me refine the list to be strictly ordered and clear. I'll group by operation but keep a global step numbering or separate sections. Separate sections with clear headers is probably better for readability, but the user asked for "an ordered step list". I'll do one big ordered list but indicate the flow branches.

Actually, looking at the prompt again: "Output an ordered step list. Concrete." So a single numbered list is best. I'll do 1-24 or so, covering both flows, and note where flows diverge.

Wait, `getRegistry` is truncated. I can mention it briefly at the end or as a separate flow. Since it's truncated, I should be careful not to invent too much. It clearly reads `this.documents`. I'll include it as a minor flow.

Let me double-check the code for any hidden details.

- `chunkText`: The overlap logic. `buffer = buffer.slice(overlapStart)` where `overlapStart = buffer.length - CHUNK_OVERLAP`. `startLine = Math.max(0, i - 2)`. This is a concrete transformation. I should mention the 500-char window and 100-char overlap.
- `extractTags`: The regex `/^---\n([\s\S]*?)\n---/` matches YAML frontmatter. Then `tags:\s*\[([^\]]+)\]` extracts tags list. Then path regexes add tags. Then dedup with `[...new Set(tags)]`.
- `inferDomain`: `filePath` parameter is accepted but unused in the shown body. Only `tags` used. I should note this.
- `computeTFIDF`: `tokenize` replaces non-word/non-Thai chars with space. `/[^\wก-๙เแโใไ]/g`. This is important concrete detail.
- `search`: `source.confidence` is `Math.min(0.95, s.score * 2)`. `freshness` is computed from `updatedAt`.

I should also mention `listFiles`, `buildIDF`, `keywordBoost`, `computeDocFreshness` as "module-internal helpers" whose implementations are not shown but whose inputs/outputs are traceable from call sites.

Let me structure the final output.

**Format**:
Each step: `N. [Location/Function] — Action. Input: (shape/source). Output: (shape/destination). Side-effects: (...)`

Example:
1. `loadCorpus` entry — `corpusDir` string enters from caller. Input: absolute path string. Output: none yet. Side-effects: none yet.

I'll write it clearly.

Let me think about whether to include the internal helper flows inline or as separate steps. Since `chunkText` etc. are called within `loadCorpus`, I should nest them under the loadCorpus flow or list them as steps when they occur. I'll list them sequentially as they are invoked.

Detailed ordered list:

1. **Entry: `loadCorpus(corpusDir)`** — External caller passes `corpusDir: string` (absolute filesystem path).
2. **State reset** — `this.documents` set to `[]`, `this.idfMap` set to `new Map()`. Side-effect: wipes prior in-memory index.
3. **Directory existence check** — `fs.existsSync(corpusDir)` returns boolean. If false → emits `console.warn` side-effect and returns `{ docCount: 0, chunkCount: 0 }` (flow ends).
4. **File listing** — `this.listFiles(corpusDir)` (internal, fs-based) returns `string[]` of absolute file paths under directory.
5. **Filtering** — Array transformed by extension whitelist (`.md`, `.txt`) and blacklist (`node_modules`, `.git`). Output: `string[]` of candidate file paths.
6. **Per-file read loop** — For each path:
   a. `fs.readFileSync(file, "utf-8")` reads bytes → `content: string`. Side-effect: filesystem I/O.
   b. Empty guard: if `content.trim().length === 0`, skip iteration.
   c. `path.relative(corpusDir, file).replace(/\\/g, "/")` → `relativePath: string` (e.g., `"law/penal.md"`).
   d. `fs.statSync(file)` → `stat` object. Side-effect: filesystem I/O. `stat.mtime.toISOString()` → `updatedAt: string`; `stat.size` → `fileSize: number`.
   e. `extractTitle(content, file)` → `title: string`. Transformation: regex `/^#\s+(.+)$/m` on content, fallback to `path.basename`.
   f. `extractTags(content, relativePath)` → `tags: string[]`. Transformation: YAML frontmatter regex `/^---\n([\s\S]*?)\n---/` + `tags:\s*\[([^\]]+)\]` + path regex heuristics + `Set` deduplication.
   g. `inferDomain(tags, relativePath)` → `domain: string`. Transformation: tag-to-domain mapping (tags includes "law" → "law", etc.).
   h. `chunkText(content, docId)` → `chunks: ColdChunk[]`. Transformation: splits by newline, buffers max 500 chars, emits chunk objects with overlap of 100 chars. Each chunk shape: `{id: string, documentId: string, content: string, index: number, startLine: number, endLine: number}`.
   i. Assemble `ColdDocument` object: `{id: "cold:" + relativePath, path: relativePath, title, content, chunks, metadata: {updatedAt, domain, tags, fileSize}}`.
   j. Push document into `this.documents` (in-memory state mutation).
7. **IDF computation** — `this.buildIDF()` called. Input: `this.documents` (all docs/chunks). Output: mutates `this.idfMap` to `Map<string, number>` (term → IDF score). Side-effect: in-memory state mutation. (Implementation not shown in snippet.)
8. **Initialization flag** — `this.initialized` set to `true`.
9. **Exit: `loadCorpus`** — Returns `{ docCount: number, chunkCount: number }` to caller. Side-effect: `console.log` with stats.

10. **Entry: `search(query, options)`** — External caller passes `query: string` and optional `options: {maxResults?: number, domain?: string}`.
11. **Guard** — Reads `this.initialized` (boolean state) and `this.documents.length`. If false/0 → returns `[]` (empty array) immediately.
12. **Option normalization** — `maxResults` defaults to `5`; `domainFilter` extracted as `string | undefined`.
13. **Corpus iteration & domain filter** — Reads `this.documents` array. For each document, if `domainFilter` is defined and `doc.metadata.domain !== domainFilter`, document is skipped.
14. **Chunk scoring loop** — For each chunk in each surviving document:
    a. `tokenize(query)` → `queryTokens: string[]` (lowercased, non-word/Thai chars replaced with space, length > 1).
    b. `tokenize(chunk.content)` → `chunkTokens: string[]`.
    c. `computeTFIDF(query, chunk.content, this.idfMap)` → `score: number`. Reads `this.idfMap` state. Computes TF (chunk token frequency / length) × IDF (from map) for each query token, sums.
    d. `this.keywordBoost(query, chunk.content)` → `keywordBoost: number`. (Implementation not shown.)
    e. `totalScore = score + keywordBoost`.
    f. Filter: if `totalScore > 0`, push `{chunk, doc, score: totalScore}` into local `scored` array.
15. **Ranking** — `scored` array sorted in-place descending by `score` (highest first).
16. **Truncation** — `scored.slice(0, maxResults)` reduces array length to top N.
17. **Result mapping** — Each item mapped to `ColdRetrievalResult`:
    - `chunk`, `document`, `score` passed through.
    - `source` object built: `{id: chunk.id, type: "document", name: doc.title, path: doc.path, freshness: this.computeDocFreshness(doc.metadata.updatedAt), timestamp: doc.metadata.updatedAt, confidence: Math.min(0.95, score * 2)}`.
    - `computeDocFreshness` reads `updatedAt` string; returns freshness metric (implementation not shown).
18. **Exit: `search`** — Returns `ColdRetrievalResult[]` to caller. No state mutations, no I/O.

19. **Entry: `getRegistry()`** — Called with no arguments.
20. **Read** — Reads `this.documents` in-memory state.
21. **Exit: `getRegistry`** — Returns array of document listings (shape truncated in snippet, derived from `this.documents`) to caller.

**Side-effects summary** (maybe as a final bullet or integrated). The user asked for side-effects in the trace. I should integrate them per step or add a summary section. I'll integrate them per step and add a final summary block.

Wait, the user wants "an ordered step list". I should make sure it's a flat list, not too nested. I can use sub-bullets for the per-file loop details but keep the main numbering sequential. Or I can flatten everything.

Let me try to flatten it as much as possible while keeping clarity.

1. **Entry `loadCorpus`** — Input: `corpusDir: string` (absolute path) from caller.
2. **Reset state** — `this.documents` cleared to `[]`; `this.idfMap` cleared to `new Map()`.
3. **Check directory** — `fs.existsSync(corpusDir)` → boolean. If false: side-effect `console.warn`, return `{ docCount: 0, chunkCount: 0 }`.
4. **List files** — `this.listFiles(corpusDir)` → `files: string[]` (absolute paths). Side-effect: filesystem directory traversal.
