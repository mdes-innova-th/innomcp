<!-- cc-team deliverable
 group: G1 (fuzz division)
 member: FUZ-008 role=fuzz model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":2124,"completion_tokens":5000,"total_tokens":7124,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 62s
 generated: 2026-06-13T12:00:31.446Z -->
The user wants property-based / fuzz test cases for the `ColdRetriever` module. I need to enumerate input invariants and properties that must always hold, then adversarial/malformed/boundary inputs that could break them. Output format: markdown list with property → fuzz input → expected invariant. Concrete, no filler.

Let me analyze the code carefully to identify invariants, properties, and potential failure modes.

Key components:
1. `chunkText(text, docId)` - chunks text into ColdChunk[]
2. `extractTitle(content, filePath)` - extracts title from markdown or filename
3. `extractTags(content, filePath)` - extracts tags from YAML frontmatter and path regexes
4. `inferDomain(tags, filePath)` - infers domain from tags
5. `tokenize(text)` - tokenizes text
6. `computeTFIDF(query, chunk, idfMap)` - computes TF-IDF score
7. `ColdRetriever.loadCorpus(corpusDir)` - loads corpus directory
8. `ColdRetriever.search(query, options)` - searches corpus

Let me identify invariants and properties:

**chunkText invariants:**
- Output chunks should cover all non-empty lines from input (no data loss for non-empty content)
- Each chunk's content should be a substring of the original text (trimmed)
- chunk.id should be `${docId}:chunk:${index}`
- chunk.documentId should equal docId
- chunk.index should be sequential starting from 0
- startLine <= endLine for all chunks
- Adjacent chunks should have overlapping content if buffer exceeded CHUNK_SIZE and overlap was applied
- If text is empty or only whitespace, returns empty array
- Total number of chunks >= 0
- For single line text shorter than CHUNK_SIZE, should produce exactly 1 chunk (if non-empty)

**extractTitle invariants:**
- Return value is always a non-empty string
- If content has `# Heading`, returns that heading text
- Otherwise returns basename without extension
- Should handle filePath being empty or having no extension

**extractTags invariants:**
- Always returns an array (possibly empty)
- Tags from frontmatter should be deduplicated with path-derived tags
- No duplicate tags in output (Set used)
- Should not crash on malformed frontmatter

**inferDomain invariants:**
- Returns one of specific strings: "weather", "evidence", "geo", "law", "process", "general"
- If tags contain a domain tag, returns that domain (priority order? weather first in code)
- If multiple domain tags exist, first checked in code wins (weather > evidence > geo > law > process)

**tokenize invariants:**
- Returns array of strings
- All tokens length > 1
- All tokens lowercase
- No tokens contain non-word/non-Thai characters (replaced with space)
- Empty string returns empty array
- String with only punctuation returns empty array

**computeTFIDF invariants:**
- Returns a finite number >= 0
- If query or chunk has no tokens, returns 0
- Score should be 0 if no query tokens appear in chunk
- Score increases with more matching tokens (monotonicity)
- Score is deterministic given same inputs

**loadCorpus invariants:**
- Returns docCount and chunkCount >= 0
- If corpusDir doesn't exist, returns {0,0} without throwing
- Only .md and .txt files are indexed
- Files with empty content are skipped
- node_modules and .git paths are skipped
- All document ids start with "cold:"
- All documents have chunks array (possibly empty? but empty content is skipped)
- fileSize matches actual file size
- updatedAt is valid ISO string
- initialized set to true after success
- Does not throw on unreadable files (catches error)

**search invariants:**
- Returns array of ColdRetrievalResult
- If not initialized or no docs, returns empty array
- maxResults limits output length (<= maxResults)
- Results sorted by score descending
- domainFilter filters to exact domain match
- score >= 0 in results
- confidence = min(0.95, score * 2)
- freshness computed from updatedAt
- source.type is always "document"
- source.id equals chunk.id
- source.name equals doc.title
- source.path equals doc.path
- source.timestamp equals doc.metadata.updatedAt
- All returned chunks belong to returned documents

**keywordBoost (implied but not shown in truncated code):**
- Since it's referenced but not shown, I should assume it exists and test boundary cases

Now for adversarial/malformed/boundary inputs:

1. **chunkText:**
   - Empty string
   - String with only whitespace/newlines
   - String exactly CHUNK_SIZE (500) chars
   - String exactly CHUNK_SIZE + 1
   - String with lines longer than CHUNK_SIZE (no newlines)
   - Unicode/Thai text (ก-๙เแโใไ)
   - docId with special characters/colons
   - Text with \r\n line endings

2. **extractTitle:**
   - Content without headings
   - Content with heading but empty title `# `
   - Content with multiple headings (should match first)
   - filePath empty string
   - filePath with no extension
   - filePath with multiple dots

3. **extractTags:**
   - No frontmatter
   - Malformed frontmatter (only `---` at start but no end)
   - Empty tags array in frontmatter
   - Tags with quotes `['tag1', "tag2"]`
   - filePath matching multiple regexes (e.g., contains both weather and evidence)
   - Content with `tags:` but not in frontmatter

4. **inferDomain:**
   - Empty tags array
   - Tags array with multiple domain tags
   - filePath with domain keywords but no tags

5. **tokenize:**
   - Empty string
   - String of single characters separated by spaces
   - String with only punctuation
   - Thai text without spaces (Thai doesn't use spaces between words often, but code splits on whitespace)
   - Mixed Thai and English
   - Very long string (memory/performance)
   - String with zero-width characters

6. **computeTFIDF:**
   - Empty query
   - Empty chunk
   - Query with only stopwords/single chars (tokenized to empty)
   - idfMap missing query tokens
   - idfMap with Infinity/NaN/negative values
   - Very large idf values causing score overflow
   - Query and chunk identical

7. **loadCorpus:**
   - corpusDir is empty string
   - corpusDir is a file, not directory
   - corpusDir with no read permissions
   - corpusDir containing symlinks
   - Files with .MD uppercase extension
   - Files with .markdown extension (should be skipped)
   - Binary files read as utf-8 (malformed sequences)
   - Files with names containing colons or special chars
   - Very large files (fileSize overflow?)
   - Directory containing node_modules with .md files (should skip)
   - Directory with circular symlinks

8. **search:**
   - Empty query
   - Query with only whitespace/special chars
   - maxResults = 0
   - maxResults negative
   - maxResults very large (Infinity)
   - domainFilter that matches nothing
   - domainFilter with wrong case
   - Options undefined
   - Search before initialization
   - Query matching every chunk (score > 0 for all)
   - Query with SQL injection-like strings (irrelevant but test robustness)

9. **Freshness computation:**
   - updatedAt in the future
   - updatedAt invalid date string
   - updatedAt epoch

10. **Path handling:**
    - Windows paths vs Unix paths (replace(/\\/g, "/"))
    - Absolute paths
    - Paths with ..

Let me structure the output as requested: markdown list with property → fuzz input → expected invariant.

I need to be concrete and avoid filler. I'll organize by component/function.

Wait, the user wants: "enumerate input invariants and properties that must always hold, then adversarial/malformed/boundary inputs that could break them. Output a markdown list: property → fuzz input → expected invariant."

So format should be like:
- **Property**: [description] → **Fuzz input**: [concrete input] → **Invariant**: [what must hold]

Let me draft these:

**chunkText**
1. Property: Chunk lineage integrity → Fuzz input: `docId="a:b:c"`, text="line1\nline2\nline3" → Invariant: Every output chunk has `documentId === docId` and `id === \`${docId}:chunk:${index}\``
2. Property: Non-empty input yields sequential indices → Fuzz input: text="x".repeat(600) → Invariant: chunks.length >= 1, indices are 0..n-1 without gaps
3. Property: Overlap continuity → Fuzz input: text="word ".repeat(200) (long text forcing multiple chunks) → Invariant: chunk[i].content substring appears in chunk[i+1].content for all i < n-1 (overlap preserved)
4. Property: Empty/whitespace resilience → Fuzz input: text="", text="   \n  \n", docId="x" → Invariant: returns [] (no empty chunks)
5. Property: Line boundary sanity → Fuzz input: text="a\nb\nc", CHUNK_SIZE=500 → Invariant: first chunk startLine=0, endLine=2, covers all lines
6. Property: No newline loss on trim → Fuzz input: text="single" → Invariant: chunk.content === "single" (trim doesn't remove meaningful chars beyond whitespace)

**extractTitle**
7. Property: Fallback to filename → Fuzz input: content="no heading", filePath="/foo/bar.BAZ.md" → Invariant: returns "bar.BAZ" (basename without final ext)
8. Property: Markdown heading extraction → Fuzz input: content="#   Hello World  \nbody", filePath="x.md" → Invariant: returns "Hello World" (trimmed)
9. Property: Empty heading fallback → Fuzz input: content="# \nbody", filePath="fallback.md" → Invariant: returns "fallback" (empty heading treated as no match? Actually regex `^#\s+(.+)$` requires at least one char after space, so empty heading won't match. Returns fallback.)

**extractTags**
10. Property: Frontmatter tag parsing with quotes → Fuzz input: content="---\ntags: ['a', \"b\", c]\n---\nbody", filePath="x.md" → Invariant: returns ["a","b","c"] (quotes stripped)
11. Property: Path regex tag injection + dedup → Fuzz input: content="---\ntags: [weather]\n---", filePath="/evidence/weather.md" → Invariant: returns ["weather","evidence"] (Set dedup, order may vary but no duplicates)
12. Property: Malformed frontmatter safety → Fuzz input: content="---\ntags: [a,b\nbody", filePath="x.md" → Invariant: returns [] (no crash, no tags from broken frontmatter)

**inferDomain**
13. Property: Priority order determinism → Fuzz input: tags=["evidence","weather","geo"], filePath="x" → Invariant: returns "weather" (first checked in if-chain)
14. Property: General fallback → Fuzz input: tags=["foo","bar"], filePath="x" → Invariant: returns "general"

**tokenize**
15. Property: Thai script preservation → Fuzz input: text="กขค 123" → Invariant: returns ["กขค"] (Thai kept, numbers dropped if length<=1? Actually "123" length 3 but digits are \w, so it would be kept. Wait regex is `[^\wก-๙เแโใไ]` - \w includes digits. So "123" is kept. But filter t.length > 1, so "123" is included. "กขค" included.)
16. Property: Single-char elimination → Fuzz input: text="a b c d e" → Invariant: returns [] (all single chars filtered)
17. Property: Punctuation collapse → Fuzz input: text="!!! ??? ..." → Invariant: returns [] (replaced with spaces, split yields empty/single chars filtered)

**computeTFIDF**
18. Property: Zero score on disjoint tokens → Fuzz input: query="xyzabc", chunk="123456", idfMap=new Map() → Invariant: returns 0
19. Property: Monotonicity with idf → Fuzz input: query="test", chunk1="test", chunk2="test test", idfMap=new Map([["test",1]]) → Invariant: score(chunk2) > score(chunk1) (higher TF)
20. Property: NaN/Infinity idf resilience → Fuzz input: query="a", chunk="a a", idfMap=new Map([["a",NaN]]) → Invariant: returns NaN? Or should be finite? Actually math with NaN yields NaN. This is a bug possibility. But invariant should be: score is finite number? The code doesn't guard against this. Maybe expected invariant is that score is a number (could be NaN). But better to say: if idfMap contains only finite non-negative numbers, score is finite and >= 0.
21. Property: Empty token set → Fuzz input: query="a", chunk="", idfMap=new Map([["a",1]]) → Invariant: returns 0 (chunkTokens empty)

**loadCorpus**
22. Property: Non-existent directory → Fuzz input: corpusDir="/does/not/exist" → Invariant: returns {docCount:0, chunkCount:0}, initialized=true? Wait code says `this.initialized = true` even if not found? Actually yes, it sets initialized=true at the end regardless. But returns early with {0,0} and warns. So initialized remains false? Let's check: if (!fs.existsSync(corpusDir)) { warn; return {0,0}; } — initialized is NOT set to true in early return. So initialized stays false. Good.
23. Property: Hidden path exclusion → Fuzz input: corpusDir containing "node_modules/a.md" and ".git/b.md" and "normal/c.md" → Invariant: only "normal/c.md" indexed (docCount=1)
24. Property: Extension filtering case sensitivity → Fuzz input: files=["a.MD","b.TXT","c.md","d.txt"] → Invariant: all 4 indexed (extname.toLowerCase() check)
25. Property: Empty file skip → Fuzz input: file with content="" or "   " → Invariant: skipped, not added to documents
26. Property: Binary/invalid UTF-8 handling → Fuzz input: file containing Buffer.from([0xFF,0xFE]) read as utf-8 → Invariant: caught, warn printed, no crash, doc not added
27. Property: ID prefix → Fuzz input: any valid file → Invariant: doc.id starts with "cold:"

**search**
28. Property: Uninitialized empty result → Fuzz input: search("query") before loadCorpus → Invariant: returns []
29. Property: maxResults boundary → Fuzz input: query="the", maxResults=0 → Invariant: returns [] (slice(0,0))
30. Property: maxResults negative → Fuzz input: maxResults=-1 → Invariant: returns [] (slice(0,-1) is tricky in JS! Actually Array.slice(0, -1) removes last element. This is a bug. If maxResults is -1, slice(0,-1) returns all but last. So this is a good fuzz case. Invariant should be: returns [] or length <= maxResults? But code doesn't validate. So expected invariant might be that length <= documents.length, but not necessarily <= maxResults if negative. I'll note this as a bug/invariant violation.)
31. Property: Domain filter exact match → Fuzz input: domain="Weather" (wrong case) → Invariant: returns [] (case-sensitive filter)
32. Property: Score-confidence mapping → Fuzz input: query producing score=0.6 → Invariant: confidence === 0.95 (capped) or confidence === score*2 if <0.475. Actually Math.min(0.95, score*2). So if score=0.6, confidence=0.95 (capped). If score=0.1, confidence=0.2.
33. Property: Source metadata integrity → Fuzz input: any query returning results → Invariant: result.source.id === result.chunk.id && result.source.path === result.document.path && result.source.timestamp === result.document.metadata.updatedAt
34. Property: Sort order → Fuzz input: query matching multiple chunks with varying scores → Invariant: results sorted descending by score (for all i, results[i].score >= results[i+1].score)
35. Property: No orphan chunks → Fuzz input: any query → Invariant: every result.chunk.documentId === result.document.id

**keywordBoost (implied)**
36. Property: Keyword boost non-negative → Fuzz input: query="abc", chunk="def" → Invariant: boost >= 0 (if no match, boost should be 0)

**Freshness**
37. Property: Invalid date safety → Fuzz input: updatedAt="not-a-date" → Invariant: computeDocFreshness returns a defined value without throwing (depends on implementation, but should not crash)

**General/Integration**
38. Property: Round-trip corpus integrity → Fuzz input: corpusDir with N valid files → Invariant: sum of doc.chunks.length across registry equals loadCorpus.chunkCount
39. Property: Registry immutability exposure? → Fuzz input: call getRegistry(), mutate returned array → Invariant: internal this.documents unchanged? (Depends if getRegistry returns copy or reference. Code truncated but likely returns this.documents or slice. If it returns reference, mutation breaks invariant.)

Let me refine these to be very concrete and remove any filler. I should present them as a clean markdown list.

I need to make sure I cover the truncated parts reasonably. The getRegistry is truncated, but I can infer it returns the documents array or a copy. I'll include one property about it if safe, or skip.

Also note the `keywordBoost` function is called but not shown. I can still test its boundary via search.

Let me check for specific tricky inputs:

- `chunkText` with text having no newlines but length > CHUNK_SIZE: `buffer` grows, never triggers `i === lines.length - 1` until end, but `buffer.length >= CHUNK_SIZE` triggers. Overlap logic: `buffer = buffer.slice(overlapStart)`. But if the line itself is longer than CHUNK_SIZE, `buffer` keeps growing because `lines` is just one element. Wait: `lines = text.split("\n")`. If no newlines, lines.length=1. Loop i=0. buffer += lines[0] + "\n". If buffer.length >= CHUNK_SIZE, it creates chunk. Then overlap: buffer = buffer.slice(buffer.length - CHUNK_OVERLAP). startLine = max(0, 0-2) = 0. Then loop ends. So one chunk. Good.

- `chunkText` with text having lines longer than CHUNK_SIZE individually: e.g., line0 length 600. i=0, buffer length 601 after adding \n. >= 500, chunk created. overlapStart = 601-100=501. buffer = buffer.slice(501). That's 100 chars. startLine = 0. i=1, buffer += lines[1] + "\n". etc. This seems okay.

- `chunkText` with `docId` containing colons: id = `${docId}:chunk:${chunkIndex}`. If docId="a:b", id="a:b:chunk:0". Fine.

- `extractTags`: frontmatter regex `^---\n([\s\S]*?)\n---` requires `\n---` at end. If file starts with `---\ntags: [a]\n---` it matches. If `---\r\n...` might not match because `\n---` expects literal newline. Carriage returns could break it.

- `tokenize`: regex `[^\wก-๙เแโใไ]` — note that `\w` is [A-Za-z0-9_]. Thai range includes some but not all Thai characters. What about ๐-๙ (Thai digits)? They are not in ก-๙ (which covers ก to ๙, but ๐ is after ๙? Let's check Thai Unicode: ก (0x0E01) to ๙ (0x0E59). Actually ๐ is 0x0E50, ๑-๙ are 0x0E51-0x0E59. So ๐ is included in ก-๙? No, ก is 0x0E01, ๐ is 0x0E50. The range ก-๙ includes everything from 0x0E01 to 0x0E59, which includes ๐-๙. So it's fine. But what about ฿ (0x0E3F)? It's between 0x0E01 and 0x0E59, so included. What about combining characters like ่ ้ ๊ ๋ (0x0E48-0x0E4B)? Included. What about ํ ์ (0x0E4D-0x0E4C)? Included. So the regex covers most Thai.

However, `เ` is 0x0E40, `แ` 0x0E41, `โ` 0x0E42, `ใ` 0x0E43, `ไ` 0x0E44. These are explicitly listed. But what about ะ (0x0E30)? It's in ก-๙ range. So fine.

But what about `ำ` (0x0E33)? Included. So tokenize should handle Thai okay.

One issue: `split(/\s+/)` on Thai text without spaces will produce the whole string as one token if no spaces. That's fine.

- `computeTFIDF`: if idfMap has negative values, score can be negative. The code checks `if (totalScore > 0)` in search, so negative scores are filtered out. But confidence = Math.min(0.95, score * 2) could be negative if score negative. However search filters totalScore > 0 before creating result. So negative scores never appear in results. Good.

- `search`: `maxResults` is not validated. If undefined, defaults to 5. If 0, slice(0,0) returns []. If negative, slice(0, negative) returns elements from start to length+negative. So if maxResults=-1 and 10 results, slice(0,-1) returns 9. This violates maxResults. Good fuzz case.

- `search`: `domainFilter` exact string match. F
