<!-- cc-team deliverable
 group: G1 (deadcode division)
 member: DEA-008 role=deadcode model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":2108,"completion_tokens":5000,"total_tokens":7108,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 39s
 generated: 2026-06-13T12:00:40.139Z -->
The user wants a dead/unused code audit for the provided TypeScript module `innomcp-node/src/services/coldRetriever.ts`.

 I need to look for:
 1. Unused exports
 2. Unreachable branches
 3. Redundant conditions
 4. Commented-out blocks
 5. Duplicate logic

 The user wants output in format: `location | what | why-safe-to-remove`
 And wants conservative, high-confidence flags only.

 Let me analyze the code carefully.

 First, let's look at the code structure:

 Imports:
 - `fs`, `path`, `RetrievalSource`

 Exports:
 - `ColdDocument` interface
 - `ColdChunk` interface
 - `ColdRetrievalResult` interface
 - `ColdRetriever` class

 Internal functions:
 - `chunkText`
 - `extractTitle`
 - `extractTags`
 - `inferDomain`
 - `tokenize`
 - `computeTFIDF`

 Class `ColdRetriever`:
 - `documents`
 - `idfMap`
 - `initialized`
 - `loadCorpus`
 - `search`
 - `getRegistry()` - truncated in the code, but we can see it starts.

 Wait, the code is truncated at the end. The user says `/* …truncated… */`. So I should only audit what's visible.

 Let me check each item:

 1. **Unused exports**:
    - `ColdDocument`, `ColdChunk`, `ColdRetrievalResult` are exported. Are they used elsewhere? The audit is only for this file. In a file-level audit, we can't know if exports are used in other files. However, the prompt says "unused exports". Usually, in a module-level audit, if something is exported but not used within the module, and if it appears to be purely internal or if the class is the only thing needed externally... But we can't know for sure from just this file. However, `ColdChunk` is used in `ColdDocument` and `ColdRetrievalResult`. `ColdDocument` is used in `ColdRetrievalResult`. `ColdRetrievalResult` is used as return type of `search`. So they are all used in the public API. It's not safe to remove them unless we know they are unused by consumers. But the prompt asks for high-confidence. So I should probably skip exports unless there's strong evidence they are dead. Actually, looking at the code, `RetrievalSource` is imported but only used in `ColdRetrievalResult` and inside `search` method to construct the return object. So it's used.

    Wait, is `RetrievalSource` imported and used? Yes, in the interface and in the search method.

    Are there any exports that are not referenced internally? `ColdDocument`, `ColdChunk`, `ColdRetrievalResult` are referenced internally. So no high-confidence unused exports from this file alone.

 2. **Unreachable branches**:
    - In `chunkText`:
      ```typescript
      if (buffer.length >= CHUNK_SIZE || i === lines.length - 1) {
        // ...
        if (buffer.length > CHUNK_OVERLAP) {
          // ...
        } else {
          buffer = "";
          startLine = i + 1;
        }
      }
      ```
      Is the `else` branch unreachable? Let's see. If we enter the outer `if`, it means `buffer.length >= CHUNK_SIZE` OR `i === lines.length - 1`.
      If `i === lines.length - 1` (last line), `buffer` could be less than `CHUNK_SIZE`. Then `buffer.length > CHUNK_OVERLAP` (100) might be false if buffer is small. So the else branch is reachable (e.g., last line with buffer < 100). So not unreachable.

    - In `loadCorpus`:
      ```typescript
      if (!fs.existsSync(corpusDir)) {
        console.warn(...);
        return { docCount: 0, chunkCount: 0 };
      }
      ```
      This is reachable.

      ```typescript
      if (!allowedExts.includes(ext)) continue;
      if (file.includes("node_modules") || file.includes(".git")) continue;
      ```
      Reachable.

      ```typescript
      if (content.trim().length === 0) continue;
      ```
      Reachable.

    - In `search`:
      ```typescript
      if (!this.initialized || this.documents.length === 0) return [];
      ```
      Reachable.

      ```typescript
      if (domainFilter && doc.metadata.domain !== domainFilter) continue;
      ```
      Reachable.

      ```typescript
      if (totalScore > 0) {
        scored.push(...);
      }
      ```
      Reachable (score could be 0).

    - In `extractTags`:
      ```typescript
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const tagsMatch = fmMatch[1].match(/tags:\s*\[([^\]]+)\]/);
        if (tagsMatch) {
          tags.push(...);
        }
      }
      ```
      Reachable.

    - In `inferDomain`:
      ```typescript
      if (tags.includes("weather")) return "weather";
      if (tags.includes("evidence")) return "evidence";
      if (tags.includes("geo")) return "geo";
      if (tags.includes("law")) return "law";
      if (tags.includes("process")) return "process";
      return "general";
      ```
      Reachable.

    - In `computeTFIDF`:
      ```typescript
      if (queryTokens.length === 0 || chunkTokens.length === 0) return 0;
      ```
      Reachable.

    Hmm, let me look for redundant conditions.

 3. **Redundant conditions**:
    - In `loadCorpus`:
      ```typescript
      if (file.includes("node_modules") || file.includes(".git")) continue;
      ```
      But `this.listFiles(corpusDir)` is used. We don't see the implementation of `listFiles`. If `listFiles` already filters out hidden dirs/dotfiles, this is redundant. But we don't see `listFiles`. However, the comment says "Skip dotfiles and hidden dirs", but the code checks `node_modules` and `.git`. It doesn't actually check dotfiles (e.g., `.hidden.md`). The condition checks specific strings. Is it redundant? We can't see `listFiles`. But wait, the comment says "Skip dotfiles and hidden dirs" but the condition only checks `node_modules` and `.git`. This is a mismatch, but not necessarily redundant. However, if `listFiles` is something like `fs.readdirSync` recursive, it might include these. Without seeing `listFiles`, I can't confidently say this is redundant.

    - In `chunkText`:
      ```typescript
      if (buffer.length >= CHUNK_SIZE || i === lines.length - 1) {
        const trimmed = buffer.trim();
        if (trimmed.length > 0) {
          // push chunk
        }
        // ...
      }
      ```
      Is the `trimmed.length > 0` check redundant? If buffer is just whitespace? Actually, if the file has empty lines at the end, buffer could be `\n\n\n` which trims to empty. So it's not redundant.

    - Wait, look at `extractTags`:
      ```typescript
      return [...new Set(tags)];
      ```
      This deduplicates tags. Not redundant.

    - Look at `search`:
      ```typescript
      if (!this.initialized || this.documents.length === 0) return [];
      ```
      Is `this.documents.length === 0` redundant given `this.initialized`? In `loadCorpus`, `initialized` is set to true at the end, even if no documents are loaded. So if corpus dir not found, it returns early and `initialized` stays false. If corpus dir exists but no valid files, `documents` is empty, but `initialized` is set to true at the end. So `!this.initialized` handles the not-loaded case, and `this.documents.length === 0` handles the loaded-but-empty case. Both are needed. Not redundant.

    - In `computeTFIDF`:
      ```typescript
      const idf = idfMap.get(qt) || 0;
      ```
      If `idfMap` is built from the corpus, and `qt` is from query, it might not be in the map. So `|| 0` is not redundant.

    - In `search` method, `source` object:
      ```typescript
      freshness: this.computeDocFreshness(s.doc.metadata.updatedAt),
      ```
      Wait, `computeDocFreshness` is called but not defined in the visible code. Is it a method? The class likely has it, but it's not shown. That's not dead code in the visible snippet.

    - Look at `extractTags` path-based tags:
      ```typescript
      if (/weather|อากาศ/i.test(filePath)) tags.push("weather");
      if (/evidence|หลักฐาน|nip/i.test(filePath)) tags.push("evidence");
      if (/geo|จังหวัด|province/i.test(filePath)) tags.push("geo");
      if (/law|กฎหมาย|พรบ/i.test(filePath)) tags.push("law");
      if (/process|กระบวนการ|procedure/i.test(filePath)) tags.push("process");
      ```
      Then `inferDomain`:
      ```typescript
      if (tags.includes("weather")) return "weather";
      if (tags.includes("evidence")) return "evidence";
      if (tags.includes("geo")) return "geo";
      if (tags.includes("law")) return "law";
      if (tags.includes("process")) return "process";
      return "general";
      ```
      Is there duplicate logic? The path-based tag extraction and domain inference are coupled. But they are not duplicates exactly. `inferDomain` could be derived from path directly without tags, but it uses tags. Not a duplicate, just a design choice.

    - Wait, in `chunkText`:
      ```typescript
      if (buffer.length >= CHUNK_SIZE || i === lines.length - 1) {
        const trimmed = buffer.trim();
        if (trimmed.length > 0) {
          chunks.push({
            id: `${docId}:chunk:${chunkIndex}`,
            documentId: docId,
            content: trimmed,
            index: chunkIndex,
            startLine,
            endLine: i,
          });
          chunkIndex++;
        }
      ```
      `endLine: i` — if it's the last line and buffer is built from multiple lines, `i` is the current line index. This seems correct.

    - Is there any unreachable code after the truncated part? We can't see it.

    - Look at `keywordBoost` method call: `this.keywordBoost(query, chunk.content);` — this method is not defined in the visible code. If it's not defined elsewhere in the class, it's a bug, not dead code. But we can't see the rest of the class.

    - Wait, the `getRegistry()` method is truncated. We can't audit it.

    Let me look for commented-out blocks. I don't see any `//` blocks that are commented out code. Only comments.

    Let me look for unused variables/functions within the module:
    - `extractTitle` is used in `loadCorpus`.
    - `extractTags` is used in `loadCorpus`.
    - `inferDomain` is used in `loadCorpus`.
    - `chunkText` is used in `loadCorpus`.
    - `tokenize` is used in `computeTFIDF`.
    - `computeTFIDF` is used in `search`.

    Is `CHUNK_OVERLAP` used? Yes.
    Is `CHUNK_SIZE` used? Yes.

    Hmm, let me look closer at `chunkText`:
    ```typescript
    if (buffer.length > CHUNK_OVERLAP) {
      const overlapStart = buffer.length - CHUNK_OVERLAP;
      buffer = buffer.slice(overlapStart);
      startLine = Math.max(0, i - 2);
    } else {
      buffer = "";
      startLine = i + 1;
    }
    ```
    Wait, after pushing a chunk, we reset `buffer` and `startLine`. But `startLine = i + 1` in the else branch. However, in the next iteration, `i` increments. So `startLine` would be set to the next line. That seems fine.

    But wait, in the `if (buffer.length > CHUNK_OVERLAP)` branch:
    `buffer = buffer.slice(overlapStart);`
    `startLine = Math.max(0, i - 2);`
    This is a bit rough, but not dead code.

    Let me reconsider redundant conditions.

    In `loadCorpus`:
    ```typescript
    const allowedExts = [".md", ".txt"];
    // ...
    const ext = path.extname(file).toLowerCase();
    if (!allowedExts.includes(ext)) continue;
    ```
    This is fine.

    ```typescript
    if (file.includes("node_modules") || file.includes(".git")) continue;
    ```
    This is checked AFTER the extension check. If a file is in node_modules but has .md extension, it will be skipped. But if `listFiles` already excludes directories like node_modules, this check is redundant. However, we don't know what `listFiles` does. But wait, the comment says "Skip dotfiles and hidden dirs". The check `file.includes("node_modules")` or `file.includes(".git")` would match files like `.../node_modules/.../readme.md`. If `listFiles` traverses recursively into subdirectories, and doesn't exclude node_modules, then this is needed. But many `listFiles` implementations do exclude. Without seeing `listFiles`, I can't be high-confidence.

    Actually, look at the `search` method:
    ```typescript
    const keywordBoost = this.keywordBoost(query, chunk.content);
    ```
    If `keywordBoost` is a method that doesn't exist in the final class, that's an error. But the code is truncated, so maybe it's defined below. I should not flag this.

    Wait, I see something. In `extractTags`:
    ```typescript
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    ```
    This regex requires the frontmatter to start at the very beginning of the file (`^`). But then it matches `---\n...`. However, if the file starts with a BOM or whitespace, it won't match. But that's not dead code.

    Let me look at `inferDomain`:
    ```typescript
    function inferDomain(tags: string[], filePath: string): string {
      if (tags.includes("weather")) return "weather";
      if (tags.includes("evidence")) return "evidence";
      if (tags.includes("geo")) return "geo";
      if (tags.includes("law")) return "law";
      if (tags.includes("process")) return "process";
      return "general";
    }
    ```
    The `filePath` parameter is unused. The function takes `filePath` but never uses it. It only uses `tags`. This is high-confidence dead parameter. But is it safe to remove? Changing a function signature might break callers. However, within this module, the only caller is:
    ```typescript
    domain: inferDomain(tags, relativePath),
    ```
    So if we remove the parameter, we need to update the caller. Since both are in the same module, it's safe to remove. But is it "dead/unused code"? It's an unused parameter. The prompt asks for "unused exports, unreachable branches, redundant conditions, commented-out blocks, duplicate logic". Unused parameter is not explicitly listed, but it's related to unused code. However, the user asks to be conservative. Is removing `filePath` from `inferDomain` safe? Yes, because it's purely internal and the parameter is not used. But wait, maybe it's exported? No, it's not exported. So yes, safe to remove.

    Actually, looking at `extractTags`, it takes `content` and `filePath`. It uses both. `inferDomain` only uses `tags`. The `filePath` parameter in `inferDomain` is truly unused.

    Is there anything else?

    Look at `chunkText`:
    ```typescript
    let buffer = "";
    let startLine = 0;
    let chunkIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      buffer += lines[i] + "\n";

      if (buffer.length >= CHUNK_SIZE || i === lines.length - 1) {
        const trimmed = buffer.trim();
        if (trimmed.length > 0) {
          chunks.push({
            // ...
            startLine,
            endLine: i,
          });
          chunkIndex++;
        }

        // Overlap: keep last CHUNK_OVERLAP chars
        if (buffer.length > CHUNK_OVERLAP) {
          const overlapStart = buffer.length - CHUNK_OVERLAP;
          buffer = buffer.slice(overlapStart);
          startLine = Math.max(0, i - 2);
        } else {
          buffer = "";
          startLine = i + 1;
        }
      }
    }
    ```
    Wait, `startLine = i + 1` in the else branch. But if `buffer.length <= CHUNK_OVERLAP` and we just processed line `i`, the next chunk should start at line `i+1`. However, if `i === lines.length - 1` (last line), we won't enter the loop again, so setting `startLine` doesn't matter. So it's not dead, just unnecessary in the last iteration but not unreachable.

    Let me look for duplicate logic.
    - `extractTags` adds tags from frontmatter and from path.
    - `inferDomain` maps tags to domain.
    - In `loadCorpus`, `tags` are passed to `inferDomain`.
    This is not duplicate logic.

    Wait, in `search`:
    ```typescript
    source: {
      id: s.chunk.id,
      type: "document" as const,
      name: s.doc.title,
      path: s.doc.path,
      freshness: this.computeDocFreshness(s.doc.metadata.updatedAt),
      timestamp: s.doc.metadata.updatedAt,
      confidence: Math.min(0.95, s.score * 2),
    },
    ```
    `timestamp` is set to `updatedAt`. Is `timestamp` used? It's part of the return type. Not dead.

    Is there any unreachable branch in `computeTFIDF`?
    ```typescript
    for (const qt of queryTokens) {
      const tf = (chunkFreq.get(qt) || 0) / chunkTokens.length;
      const idf = idfMap.get(qt) || 0;
      score += tf * idf;
    }
    ```
    If `idfMap` doesn't have `qt`, `idf` is 0, so score += 0. This is reachable if query has terms not in corpus.

    Hmm, what about the `|| 0` in `chunkFreq.get(qt)`? Since `qt` is from `queryTokens`, and `chunkFreq` is built from `chunkTokens`, `qt` might not be in `chunkFreq`. So `|| 0` is needed.

    Let me reconsider the `inferDomain` unused parameter. That's a strong candidate.

    Are there any other unused parameters or variables?
    - In `chunkText`, `chunkIndex` is used.
    - In `ColdChunk`, `documentId` is set and used? In `chunkText`, yes. In `ColdRetrievalResult`, `chunk.documentId` might be used by consumers, but within the module, `s.chunk.id` is used for `source.id`. `documentId` is not used within the module except in construction. But it's part of the interface. Since it's exported, we can't remove it.

    Wait, look at `ColdChunk` interface:
    ```typescript
    export interface ColdChunk {
      id: string;
      documentId: string;
      content: string;
      index: number;
      startLine: number;
      endLine: number;
    }
    ```
    In `chunkText`, `documentId` is populated. In `search`, `s.chunk` is returned. Is `documentId` used anywhere in the module? No. But it's part of the public interface. We can't remove it without knowing external usage. So not high-confidence.

    What about `ColdDocument.content`? It's populated and used in `chunkText`, but after that, is it used? In `search`, we return `document: s.doc`, which includes content. But we don't use `doc.content` in the search logic. However, it's part of the returned result. So not dead.

    Let me look at `loadCorpus` again:
    ```typescript
    const stat = fs.statSync(file);
    // ...
    fileSize: stat.size,
    ```
    `fileSize` is stored but never used in the module. But it's part of the metadata interface. Not safe to remove.

    Is there any commented-out block? I don't see any.

    Is there unreachable code? Let me check `chunkText` again carefully.
    ```typescript
    for (let i = 0; i < lines.length; i++) {
      buffer += lines[i] + "\n";

      if (buffer.length >= CHUNK_SIZE || i === lines.length - 1) {
        const trimmed = buffer.trim();
        if (trimmed.length > 0) {
          chunks.push({...});
          chunkIndex++;
        }

        if (buffer.length > CHUNK_OVERLAP) {
          const overlapStart = buffer.length - CHUNK_OVERLAP;
          buffer = buffer.slice(overlapStart);
          startLine = Math.max(0, i - 2);
        } else {
          buffer = "";
          startLine = i + 1;
        }
      }
    }
    ```
    Consider the case where `buffer.length >= CHUNK_SIZE` is true, but `trimmed.length === 0`. This happens if buffer is all whitespace and length >= 500? Unlikely but possible if lines are empty? Actually, `buffer += lines[i] + "\n";` — if lines are empty strings, buffer accumulates `\n`. After 500 newlines, buffer length is 500. `trimmed` would be empty string. So `trimmed.length > 0` is false, chunk is not pushed. Then we still do the overlap logic. Is that correct? If we don't push a chunk, should we still reset buffer? The code resets buffer regardless. This might be a bug, but not dead code.

    Actually, wait. If `trimmed.length === 0`, we don't push the chunk, but we still truncate the buffer. This means those lines are lost. But that's a logic bug, not dead code.

    Let me look for redundant conditions again.

    In `search`:
    ```typescript
    if (!this.initialized || this.documents.length === 0) return [];
    ```
    Is this redundant because `loadCorpus` always sets `initialized = true` at the end, even if empty? Yes, so `documents.length === 0` can happen with `initialized = true`. So both are needed.

    What about:
    ```typescript
    const maxResults = options?.maxResults ?? 5;
    const domainFilter = options?.domain;
    ```
    If `options` is undefined,
