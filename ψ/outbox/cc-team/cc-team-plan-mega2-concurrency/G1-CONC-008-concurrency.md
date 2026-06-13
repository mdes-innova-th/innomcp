<!-- cc-team deliverable
 group: G1 (concurrency division)
 member: CONC-008 role=concurrency model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":2121,"completion_tokens":5000,"total_tokens":7121,"prompt_tokens_details":{"cached_tokens":66,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 42s
 generated: 2026-06-13T12:08:42.140Z -->
The user wants a concurrency/async-safety audit of the provided TypeScript module `coldRetriever.ts`. I need to analyze the code for:

1. Shared mutable state without locks
2. Check-then-act races
3. Unawaited promises
4. Promise.all error-swallowing
5. Event-listener leaks
6. Cache stampedes
7. Ordering assumptions

Then output a table with columns: severity | location | race/issue | fix

Let me carefully analyze the code.

First, let's look at the class `ColdRetriever`:

```typescript
export class ColdRetriever {
  private documents: ColdDocument[] = [];
  private idfMap: Map<string, number> = new Map();
  private initialized = false;
```

These are instance fields. Since this is a Node.js service, if the same instance is shared across concurrent requests (which is typical for a retriever service), we have shared mutable state.

**loadCorpus method:**
```typescript
async loadCorpus(corpusDir: string): Promise<...> {
    this.documents = [];
    this.idfMap = new Map();
    // ...
    this.initialized = true;
}
```

This is a big issue. `loadCorpus` is async and mutates shared state (`this.documents`, `this.idfMap`, `this.initialized`). If two calls happen concurrently, or if a call to `search` happens during `loadCorpus`, we have races:
- `documents` could be partially populated while `search` is running
- `initialized` is set to true at the end, but documents are populated incrementally
- `idfMap` is rebuilt at the end, but during the loop it's empty or partially built

This is a **check-then-act race** in `search` vs `loadCorpus`, and **shared mutable state without locks/protection**.

**search method:**
```typescript
search(query: string, options?: ...): ColdRetrievalResult[] {
    if (!this.initialized || this.documents.length === 0) return [];
    // ...
    for (const doc of this.documents) {
      // ...
    }
}
```

`search` reads `this.documents` and `this.idfMap` without any synchronization. If `loadCorpus` is running concurrently:
- `this.documents` array is being mutated (pushed to) while being iterated over in `search` → this can cause crashes or missed elements in JS? Actually, in JS, modifying an array while iterating with `for...of` can behave unpredictably. If `loadCorpus` does `this.documents = []` at the start, then `search` might see an empty array or the new array. But if `search` is iterating over the old array and `loadCorpus` pushes to the new array, that's fine. However, if `search` is iterating and `loadCorpus` hasn't finished but `initialized` is true from a previous run, `search` reads the old documents while `idfMap` is being rebuilt? Wait, `this.idfMap = new Map()` happens at the start of `loadCorpus`. So if `search` runs during `loadCorpus`, it might see an empty `idfMap` or partially built one, or the old documents with a new empty idfMap.

Actually, the bigger issue: `loadCorpus` is `async` but doesn't do any async I/O! It uses `fs.readFileSync` and `fs.statSync`. So it's synchronous internally despite being declared async. But because it's declared async, the event loop can yield between statements? No, `async` functions run synchronously until the first `await`. Since there are no `await`s in `loadCorpus`, it runs to completion synchronously (though returns a Promise). However, if called from an async context, the caller might await it, but the function itself executes atomically on the event loop.

Wait, is that true? Yes! Since there are no `await` expressions inside `loadCorpus`, the entire function body executes synchronously before returning a resolved promise. So actually, there might not be an interleaving issue *within* a single `loadCorpus` call. But if multiple `loadCorpus` calls are triggered, they can interleave at the `await` boundary of the *caller*.

Example:
```typescript
const retriever = new ColdRetriever();
// Call 1
retriever.loadCorpus('/path1');
// Call 2 (before call 1 finishes, but since loadCorpus is sync internally, 
// if called synchronously one after another, they don't interleave.
// But if called from different async contexts:
await Promise.all([retriever.loadCorpus('/path1'), retriever.loadCorpus('/path2')]);
```

Actually, `Promise.all([...])` will execute both. Since `loadCorpus` has no await, each runs completely before yielding. But which one runs first? The first one starts, runs to completion (synchronously), returns a promise. Then the second one starts? Not necessarily. In microtask queue, if both are queued, they might run in order. But the key is: if `loadCorpus` is synchronous, then `this.documents = []` and all pushes and `this.initialized = true` happen without interruption. However, if called from two different event loop ticks, they can interleave. For example:

```typescript
setImmediate(() => retriever.loadCorpus('/path1'));
setImmediate(() => retriever.loadCorpus('/path2'));
```

These are two separate macro-tasks. The first runs completely, then the second runs completely. So no interleaving within the function. But what if there's an `await` somewhere? There isn't.

Wait, but `fs.readFileSync` is synchronous. So `loadCorpus` is actually a synchronous function disguised as async. This means concurrent calls to `loadCorpus` from different requests will execute one after another on the event loop, not interleaved. However, `search` can still be called during `loadCorpus` if `search` is called from another request that is already being processed? No, Node.js is single-threaded. If `loadCorpus` is running synchronously (CPU-bound), it blocks the event loop. No other JavaScript code runs until it finishes. So `search` cannot interleave in the middle of `loadCorpus`.

But wait, is that the whole story? What if `loadCorpus` is called, and while it's running (synchronously), an I/O callback that calls `search` is already in the microtask queue? No, synchronous code blocks everything. So actually, the race condition might be less severe than I thought, but there are still issues:

1. **Logical race / ordering**: If `loadCorpus` is called twice concurrently (e.g., `Promise.all([r.loadCorpus(a), r.loadCorpus(b)])`), the second one will overwrite the first. But since they run sequentially (first one fully, then second one fully), the result will be whichever runs last. That's not a crash, but it's a logical issue.

2. **Check-then-act in search**: `search` checks `this.initialized` and then reads `this.documents` and `this.idfMap`. Since `loadCorpus` is synchronous, there's no interleaving. But if someone modifies `loadCorpus` later to add an `await`, or if the class is used in a worker thread or different context, it's still a latent bug. However, strictly speaking, in the current code, `search` and `loadCorpus` won't interleave because `loadCorpus` is sync.

But wait, the user asked for an audit. I should flag potential issues even if they are latent. The `initialized` flag is a check-then-act pattern. Also, `documents` is mutable shared state.

Let me look for other issues.

**listFiles**: Not shown in the truncated code, but likely uses `fs.readdirSync` or similar. Not relevant.

**Unawaited promises**: I don't see any explicit promises being created and not awaited, except maybe the `async loadCorpus` return. But if the caller doesn't await it, that's on the caller. However, inside the code, are there any? No.

**Promise.all error-swallowing**: Not present in the shown code.

**Event-listener leaks**: Not present.

**Cache stampedes**: The `idfMap` is computed once during load. If `loadCorpus` is called multiple times rapidly, it recalculates. But since it's synchronous and blocking, not exactly a stampede. However, if this were to be used in a serverless environment or with hot-reloading, concurrent reloads could happen. But no explicit cache.

Wait, is there a cache? The `documents` array acts as an in-memory cache. If multiple `loadCorpus` calls happen, they race to fill it. But again, sync execution prevents true concurrency.

**Ordering assumptions**: The code assumes `fs.existsSync` check then `listFiles` is safe. That's a check-then-act on the filesystem (TOCTOU). The directory could be deleted between `existsSync` and `listFiles`. Better to just try and catch.

Also, `fs.statSync(file)` after reading the file - the file could change between read and stat, or be deleted. But that's minor.

**Shared mutable state without locks**: The `documents` and `idfMap` are shared mutable state. If this class instance is shared across concurrent requests (e.g., in an Express app), and if `loadCorpus` is triggered by one request while `search` is used by others, there's a window where the corpus is being rebuilt. Even though `loadCorpus` is sync, if it's called from a route handler, it blocks the event loop, but other requests that arrived earlier might have their callbacks in the queue? No, if the event loop is blocked, nothing else runs. But if the server is multi-threaded (worker threads, cluster mode), this is unsafe. In standard single-threaded Node.js, it's safe from crashes but bad for availability (blocking).

Actually, the most important issue is that `loadCorpus` is `async` but does synchronous I/O. This is misleading and can block the event loop. But the user asked specifically about concurrency/async-safety.

Let me reconsider the `search` method. It reads `this.documents` and `this.idfMap`. If `loadCorpus` is called from a background task or during a reload, and `search` is called concurrently from another request... in Node.js single thread, they can't truly run concurrently, but if `loadCorpus` is made properly async later (e.g., using `fs.promises.readFile`), then we have a serious race.

Given the prompt asks for an audit, I should flag:
1. `loadCorpus` mutates shared state (`documents`, `idfMap`, `initialized`) without synchronization. Severity depends on usage, but it's a structural issue.
2. `search` has a check-then-act on `this.initialized` and `this.documents` / `this.idfMap`.
3. `fs.existsSync` followed by `listFiles` is a filesystem check-then-act (TOCTOU).
4. `loadCorpus` is declared async but uses only sync I/O, which blocks the event loop and prevents true concurrency but also means any future async refactoring would expose races.
5. The `chunkText` function and other helpers are pure, so no issues there.

Wait, is there any unawaited promise? The `loadCorpus` is async. If the caller does `retriever.loadCorpus(dir)` without await, it proceeds. But that's external.

Is there any `Promise.all`? No.

Event listeners? No.

Cache stampede? If `loadCorpus` is expensive and triggered by multiple requests, since it's sync, requests would serialize and block. But if it were async, there'd be a stampede. I could mention this as a latent issue.

Let me think about what to include in the table. The user wants specific locations and fixes.

Potential rows:

1. **Severity: High** | Location: `ColdRetriever` class fields (`documents`, `idfMap`, `initialized`) | Race/issue: Shared mutable state without locks; concurrent `loadCorpus` calls or interleaved `search` during reload can corrupt index or return inconsistent results. | Fix: Make reload atomic by building a new index in local variables and swapping references at the end; use a read-write lock or semaphore if true concurrency is needed; or make `loadCorpus` private and trigger only at startup.

2. **Severity: Medium** | Location: `search()` method | Race/issue: Check-then-act on `this.initialized` and `this.documents` — state can change between the guard check and the iteration if `loadCorpus` is made async or in multi-threaded contexts. | Fix: Capture a local snapshot of the index (e.g., `const docs = this.documents; const idf = this.idfMap;`) at the start of `search`, or use immutable index snapshots.

3. **Severity: Medium** | Location: `loadCorpus()` filesystem check | Race/issue: `fs.existsSync(corpusDir)` followed by `this.listFiles(corpusDir)` is a filesystem check-then-act (TOCTOU); directory may be deleted or permissions changed between check and use. | Fix: Remove the `existsSync` check; wrap `listFiles` in a try-catch and handle `ENOENT` there.

4. **Severity: Medium** | Location: `loadCorpus()` synchronous I/O inside async function | Race/issue: `fs.readFileSync`, `fs.statSync`, `fs.existsSync` block the event loop; concurrent requests cannot progress during corpus reload, causing head-of-line blocking. | Fix: Use `fs.promises` equivalents (`readFile`, `readdir`, `stat`) and await them; consider streaming for large corpora.

5. **Severity: Low/Medium** | Location: `loadCorpus()` error handling inside loop | Race/issue: Individual file errors are logged and swallowed, but `totalChunks` and `this.documents` may end up in an inconsistent state if a file fails after partial push? Actually, `this.documents.push(doc)` happens after the file is fully read. If `fs.statSync` fails after `readFileSync`? No, stat is after read. If read succeeds but stat fails, the error is caught and doc is not pushed. That's fine. But if `buildIDF()` throws? It's called after the loop. If it throws, `initialized` is never set, but `this.documents` and `this.idfMap` are partially populated (all docs pushed, idfMap might be partially built? No, `buildIDF` is sync and either succeeds or fails. But if it fails, `this.documents` contains the new docs while `this.idfMap` is empty or old? Actually `this.idfMap = new Map()` at the start, so if `buildIDF` fails, `idfMap` is empty and `documents` is full. Then `search` might see `initialized=false` from previous run? No, `initialized` is set after `buildIDF`. So if `buildIDF` throws, `initialized` remains false (or true from previous run). If it was true from previous run, `search` will use old `initialized` flag but new `documents`? Wait, `initialized` is set to true only at the end. If `buildIDF` throws, `initialized` stays whatever it was. If it was already true from a previous successful load, `search` will see `initialized=true` and iterate over the new `documents` but use the new `idfMap` which might be empty if `buildIDF` failed early, or partially built. Actually `buildIDF` isn't shown, but presumably it populates `this.idfMap`. If it throws, `this.idfMap` might be in an inconsistent state. This is a check-then-act / atomicity issue.

6. **Severity: Low** | Location: `loadCorpus()` return value | Race/issue: If called concurrently, the returned `{docCount, chunkCount}` reflects only the final caller's view, but the side effects overwrite shared state. | Fix: Return a snapshot or make the method atomic.

Let me also consider `keywordBoost` and `computeDocFreshness` — not shown, but likely pure.

Another issue: `extractTags` uses regex on potentially large strings. Not concurrency related.

What about `Promise.all` error swallowing? Not applicable.

Event listener leaks? Not applicable.

Cache stampede? If `loadCorpus` is triggered by a request and takes time, multiple requests might trigger reloads. Since it's sync, they serialize. But if converted to async, multiple concurrent calls would all rebuild the corpus. Fix: Use a promise gate / deduplication (e.g., `reloadPromise` so concurrent callers share the same reload operation).

Actually, that's a good point. Even though currently sync, the pattern invites future async refactoring. I can flag it as a latent stampede / thundering herd.

Let me structure the table. I need to be careful to only flag real issues in the code, not imaginary ones, but also flag latent/pattern issues that are likely to cause bugs if the code evolves.

Key issues to include:

1. **Shared mutable state / non-atomic reload**: `this.documents`, `this.idfMap`, `this.initialized` are mutated in-place during `loadCorpus`. If the retriever is a singleton (likely), concurrent calls or search during load yield torn reads. Even though currently sync, this is brittle.
   - Fix: Build new index locally, then swap atomically: `this.documents = newDocs; this.idfMap = newIdf; this.initialized = true;`.

2. **Check-then-act in search**: `if (!this.initialized || this.documents.length === 0) return [];` then uses `this.documents` and `this.idfMap`. Between check and use, another load could swap them (if atomic swap is implemented, it's still a snapshot issue; if not, it's a race).
   - Fix: Read all shared state into locals at the top of `search`: `const { documents, idfMap, initialized } = this;` and check locals.

3. **Filesystem TOCTOU**: `fs.existsSync(corpusDir)` before `listFiles`.
   - Fix: Try-catch around `listFiles` instead.

4. **Synchronous I/O in async function**: Blocks event loop, preventing concurrency and masking true async safety issues.
   - Fix: Use `fs.promises.readFile`, etc.

5. **Unawaited / fire-and-forget potential**: `loadCorpus` is async but if the caller doesn't await, `search` might run against empty/partial index. This is more of an API contract issue.
   - Fix: Document that `loadCorpus` must be awaited before `search`; or make constructor private and use factory pattern.

6. **Reload stampede / duplicate work**: No deduplication of concurrent `loadCorpus` calls.
   - Fix: Cache the in-flight promise and return it to concurrent callers.

Wait, is there any unawaited promise *inside* the code? No. The prompt mentions "unawaited promises" as a category to check. I should only include it if found. I don't see any inside this module. So I won't include it unless I find one.

Similarly, `Promise.all` error swallowing: not present.

Event listener leaks: not present.

So I'll focus on the issues actually present.

Let me draft the table rows:

| severity | location | race/issue | fix |
|---|---|---|---|
| High | `ColdRetriever.loadCorpus` (lines ~95-140) | Shared mutable state mutated incrementally (`this.documents.push`, `this.idfMap` rebuilt) without isolation; singleton instance exposes torn reads to concurrent `search` calls if reload is triggered at runtime. | Build the new index in local variables and swap atomically at the end; or protect with a reader-writer lock / async mutex. |
| High | `ColdRetriever.search` (lines ~145-180) | Check-then-act on `this.initialized` and `this.documents` / `this.idfMap`; state can change between guard and iteration leading to inconsistent scoring or crashes. | Snapshot shared fields into local constants at the start of `search`; or access an immutable index snapshot. |
| Medium | `loadCorpus` entry (line ~98) | Filesystem check-then-act: `fs.existsSync(corpusDir)` before `listFiles(corpusDir)` — directory may be removed or altered between check and use (TOCTOU). | Remove `existsSync`; wrap `listFiles`/`readdir` in `try…catch` and handle `ENOENT` directly. |
| Medium | `loadCorpus` I/O (lines ~112, 121) | Synchronous blocking I/O (`readFileSync`, `statSync`) inside an `async` function blocks the entire event loop, serializing all concurrent work and hiding async-safety defects. | Replace with `fs.promises.readFile` / `stat` and await them; stream large files if needed. |
| Medium | `loadCorpus` error handling (line ~137) | Swallowed file errors leave `this.documents` partially populated while `this.idfMap` may be inconsistent if `buildIDF()` fails later; `initialized` is never set, but previous `initialized` flag may remain `true`. | Make index rebuild atomic (local vars + swap); ensure `initialized` is cleared at the start of reload and only set after full success. |
| Low | `ColdRetriever` class design | Cache stampede / thundering herd: multiple concurrent `loadCorpus` invocations perform redundant full-rebuild work with no request deduplication. | Deduplicate in-flight reloads by storing a shared `Promise` for ongoing loads and returning it to concurrent callers. |

I need to make sure line numbers are approximate or descriptive since the code doesn't have line numbers. I'll use method names and approximate positions.

Wait, the code shows `buildIDF()` is called but not shown. I should mention it.

Also, regarding the `search` method: it computes `confidence: Math.min(0.95, s.score * 2)`. Not relevant.

Another thing: `chunkText` uses `buffer.length` and `buffer.slice`. The overlap logic seems slightly off (`startLine = Math.max(0, i - 2)` is hardcoded) but that's not concurrency.

Let me reconsider the severity of the sync I/O issue. In Node.js, doing sync I/O in an async function is an anti-pattern because it blocks the event loop. If this is a service handling multiple requests, one reload blocks everyone. That's a concurrency issue (prevents concurrent progress). Severity: Medium or High? I'll say Medium because it doesn't cause data corruption, just availability.

Actually, the prompt asks for "Concurrency/async-safety audit". Blocking the event loop is an async safety issue (it prevents async operations from proceeding). I'll keep it.

Is there any issue with `this.documents.push(doc)` while another `search` is iterating? In single-threaded JS, if `loadCorpus` is sync, no. But if someone later changes to async I/O, it becomes a race. The current code is safe from that specific interleaving, but the pattern is unsafe. I should phrase it carefully: "Mutable
