_29 findings consolidated, 1 missing._

# TRIAGE — mega-deadcode

> deadcode lens (provider=0): Dead/unused code audit: unused exports, unreachable branches, redundant conditio

> Generated for mother-Sonnet review. provider=0 deliverables.


---

## DEA-001 — deadcode — `innomcp-node/src/services/agentLoop.ts` [deepseek/deepseek-v4-pro]
No high-confidence dead code identified. All exported types and internal logic are used, no unreachable branches, and conditions are necessary.

---

## DEA-002 — deadcode — `innomcp-node/src/services/analyticsService.ts` [Qwen/Qwen3.7-Max]
| location | what | why-safe-to-remove |
|---|---|---|
| `constructor` & `reset` methods | Duplicate object literal for `this.metrics` initialization (10+ lines of identical default state assignment) | Extracting the default state into a private helper method (e.g., `private getDefaultMetrics(): Metrics`) eliminates the duplication. This ensures that if the `Metrics` interface changes or default values need tweaking, the update only has to be made in one place, preventing sync bugs. |

---

## DEA-003 — deadcode — `innomcp-node/src/services/answerContract.ts` [moonshotai/Kimi-K2.6]
The user wants a dead/unused code audit for the provided TypeScript module `innomcp-node/src/services/answerContract.ts`.

 I need to look for:
 1. Unused exports
 2. Unreachable branches
 3. Redundant conditions
 4. Commented-out blocks
 5. Duplicate logic

 And output as: list | location | what | why-safe-to-remove
 Conservative — flag only high-confidence.

 Let's analyze the code carefully.

 **Exports:**
 - `AnswerMode` - exported type, used in `AnswerContract` and `buildAnswerContract` params. Not necessarily unused just because it's exported. But is it used elsewhere? The audit is for this module, but "unused exports" means exported from this module but potentially not imported elsewhere. However, since I only have this module, I should flag exports that are not used within this module AND seem like internal utilities, OR exports that are clearly dead. Actually, looking at the code:
   - `AnswerMode` is used in `AnswerContract` and `buildAnswerContract` params. It's exported. Could be used by other modules. High confidence to remove? No, it's a public type.
   - `RetrievalMode` - exported type, used in `AnswerContract` and `buildAnswerContract`. Same as above.
   - `RetrievalSource` - exported interface, used in `AnswerContract` and `buildAnswerContract`. Same.
   - `AnswerContract` - exported interface, used as return type. Same.
   - `buildAnswerContract` - exported function. Used? Not within this module. But it's the main export.

 Wait, the user is asking for an audit of this specific module. "Unused exports" usually means symbols exported from this module that are not referenced anywhere in the codebase. But since I only have this one file, I should be very conservative. However, I can see if exports are referenced within the module. If not referenced within the module, they might be unused exports, but they could be used by other modules. So I should only flag an export as unused if it's not used in this module AND it seems like it should be internal, OR if there's clear evidence it's dead.

 Actually, looking at the code, all exports are used in the public API of this module. None seem "unused" within the context of the module itself. But wait...

 Let's look at `sourceIds` in `AnswerContract`. It's computed as `params.sources.map((s) => s.id)`. Is `sourceIds` used? It's part of the returned object. Not dead.

 Let's look at the logic in `buildAnswerContract`:

 ```typescript
 const hotSources = params.sources.filter((s) => s.type === "tool" || s.type === "api" || s.type === "database");
 const coldSources = params.sources.filter((s) => s.type === "document");
 ```

 Is there duplicate logic? No, the filters are different.

 Is there unreachable code?
 ```typescript
 let freshness: AnswerContract["freshness"] = "stale";
 if (params.sources.length > 0) {
   const freshnessValues = params.sources.map((s) => s.freshness);
   const hasLive = freshnessValues.includes("live");
   const hasStale = freshnessValues.includes("stale");
   if (hasLive && hasStale) freshness = "mixed";
   else if (hasLive) freshness = "live";
   else if (freshnessValues.includes("recent")) freshness = "recent";
 } else if (params.answerMode === "deterministic") {
   freshness = "live";
 }
 ```

 Let's trace the freshness logic:
 - Default: "stale"
 - If sources.length > 0:
   - hasLive && hasStale -> "mixed"
   - else if hasLive -> "live"
   - else if includes "recent" -> "recent"
   - else (implicitly) stays "stale" (if no live, no stale? Wait, if hasLive is false, and hasStale is true, and includes recent is false, it stays "stale". That's correct.)
 - Else if answerMode === "deterministic": freshness = "live"
 - Else (implicitly) stays "stale" (if no sources and not deterministic)

 Is there any unreachable branch?
 What if `params.sources.length > 0` and `hasLive` is false and `hasStale` is false and there are only "recent" sources? Then `freshnessValues.includes("recent")` is true -> "recent". Correct.
 What if `hasLive` is false, `hasSt

---

## DEA-004 — deadcode — `innomcp-node/src/services/artifactService.ts` [zai-org/GLM-5.1]
## Audit Result: `artifactService.ts`

**No high-confidence dead/unused code found.**

This module is minimal and clean. Here's what I checked and why nothing was flagged:

| Check | Result |
|---|---|
| Unused exports | `artifactService` is exported — can't confirm unused without consumer analysis |
| Unreachable branches | None present |
| Redundant conditions | None present |
| Commented-out blocks | None present (the existing comment is informational, not dead code) |
| Duplicate logic | None present |
| Overly broad import | `import * as artifacts` imports the full namespace but only `listArtifacts` and `getArtifact` are used; however, this is a style/optimization concern handled by tree-shaking, not a high-confidence dead code flag |

**Verdict:** ✅ Clean — no items to flag.

---

## DEA-005 — deadcode — `innomcp-node/src/services/auditLogger.ts` [deepseek/deepseek-v4-pro]
- **innomcp-node/src/services/auditLogger.ts:33-37**  
  **What:** `private authorizer?: () => boolean;` field and `setAuthorizer(auth: () => boolean): void` method  
  **Why safe to remove:** The `authorizer` property is never read or referenced in any other part of the class. The `setAuthorizer` method only sets this unused field, so no logic depends on it. Removing both does not affect audit logging, file rotation, querying, or export capabilities.

---

## DEA-006 — deadcode — `innomcp-node/src/services/backpressureHandler.ts` [deepseek/deepseek-v4-flash]
After a thorough audit of the provided module, no dead/unused code (unused exports, unreachable branches, redundant conditions, commented-out blocks, or duplicate logic) was identified with high confidence. All exports, variables, methods, and control flow paths are actively used and necessary for the intended functionality.

**Result:** No items to flag.

---

## DEA-007 — deadcode — `innomcp-node/src/services/cacheManager.ts` [Qwen/Qwen3.7-Max]
| location | what | why-safe-to-remove |
| :--- | :--- | :--- |
| `CacheManager` class property | `private readonly cleanupTimer` | **Unused property:** The property is assigned in the constructor but never read anywhere else in the class. A local variable inside the constructor is sufficient to hold the timer reference and call `.unref()`. |
| `set` and `configure` methods | `&& this.tail` in the `while` loop condition | **Redundant condition:** `this.maxSize` is guaranteed to be `>= 1` (default is 1000, and `configure` enforces `Math.max(1, ...)`). If `this.entries.size > this.maxSize`, the list has at least one node, meaning `this.tail` is mathematically guaranteed to be non-null. |
| `set` and `configure` methods | Eviction `while` loop block | **Duplicate logic:** The exact same 4-line eviction loop is duplicated in both methods. It can be safely extracted into a single private helper method (e.g., `evictIfNeeded()`) to adhere to DRY principles. |

---

## DEA-008 — deadcode — `innomcp-node/src/services/coldRetriever.ts` [moonshotai/Kimi-K2.6]
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
     

---

## DEA-009 — deadcode — `innomcp-node/src/services/contextManager.ts` [deepseek/deepseek-v4-pro]
No high-confidence dead/unused code, unreachable branches, redundant conditions, commented-out blocks, or duplicate logic were identified in the provided module. The exported `contextManager` instance is assumed to be used externally, and all public methods/properties have at least internal or potential external use. The placeholder `summarize` method and unused readonly constants (`maxMessagesPerSession`, `maxContentLength`, `summaryMaxTokens`) could be dead if the rest of the codebase does not reference them, but without external usage information they are not flagged conservatively.

| location | what | why-safe-to-remove |
| -------- | ---- | ------------------ |
| -        | -    | -                  |

---

## DEA-010 — deadcode — `innomcp-node/src/services/dataAnalysisTool.ts` [MiniMaxAI/MiniMax-M3]
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
| `ColumnStats.type` `"date"` variant | Declared but never produced | Borderline dead type variant. I did **not** flag it as safe-to-remove 

---

## DEA-011 — deadcode — `innomcp-node/src/services/eventBus.ts` [deepseek/deepseek-v4-flash]
No high-confidence dead/unused code detected.

---

## DEA-012 — deadcode — `innomcp-node/src/services/fastPathHandler.ts` [Qwen/Qwen3.7-Max]
| location | what | why-safe-to-remove |
|---|---|---|
| Line 4 | `import { evaluate } from "mathjs";` | **Unused import.** `evaluate` is never invoked in this file. Math evaluation is expected to be performed by the caller using the exported `trigToDeg`/`cleanFloat` helpers. |
| Line 6 | `import { maybeFastPath, getFastPathDictInfo } ...` | **Unused imports.** Neither function is called in the module. Intent and dictionary logic have been refactored to use `analyzeIntent` and `getExtraPhrases`. |
| Lines 38-40 (`cleanFloat`) | Redundant `if` condition | **Duplicate logic/Redundant branch.** Both the `if (Number.isInteger(rounded))` branch and the fallback execute the exact same statement (`return String(rounded);`). The condition has zero effect and can be safely deleted. |
| Lines 86-88 | `nowIso()` private function | **Unused code.** This helper is never called within the module. Time tracking and logging rely directly on `performance.now()` and `Date.now()`. |
| Lines 90-94 | `safeTrim()` private function | **Unused code.** This helper is never called within the module. String truncation is handled inline where needed (e.g., `text.slice(0, 50)`). |

---

## DEA-013 — deadcode — `innomcp-node/src/services/generalGate.ts` [deepseek/deepseek-v4-pro]
**Dead/Unused Code Audit – `/innomcp-node/src/services/generalGate.ts`**  
  
| # | Location | What | Why safe to remove |
|---|----------|------|---------------------|
| 1 | `import { logBoth } from "../utils/mcpLogger";` (top‑level) | `logBoth` is imported but never called anywhere in the file. | No code references `logBoth`; removing the import has no effect on any function or runtime behaviour.

---

## DEA-014 — deadcode — `innomcp-node/src/services/healthAggregator.ts` [zai-org/GLM-5.1]
| location | what | why-safe-to-remove |
|---|---|---|
| `HealthStatus` interface & `runCheckerWithTimeout` method | `latencyMs` property and its assignments (`latencyMs: durationMs`) | `latencyMs` is always assigned the exact same value as `durationMs` in both the `try` and `catch` blocks. Since `durationMs` is already explicitly required in the `AggregatedHealth.checks` record, `latencyMs` is redundant duplicate data that can be safely removed and consolidated into `durationMs`. |

---

## DEA-015 — deadcode — `innomcp-node/src/services/hotRetriever.ts` [MiniMaxAI/MiniMax-M3]
# Dead/Unused Code Audit — `hotRetriever.ts`

## Summary

The module exports six public symbols (`RetrievalFact`, `normalizeWeatherFacts`, `normalizeEvidenceFacts`, `normalizeDeterministicFact`, `mergeRetrievalFacts`, `composeFactSummary`) and defines two private helpers. Based solely on the code provided, I cannot confirm whether any are unused, because **no import sites or call sites are visible in this excerpt**. A complete audit requires seeing all consuming modules.

## High-Confidence Flags (conservative)

| # | Location | What | Why safe to remove |
|---|----------|------|--------------------|
| — | — | — | Nothing flagged. |

## Conservative Observations (not yet flaggable)

| # | Location | What | Why I am *not* flagging yet |
|---|----------|------|-----------------------------|
| 1 | `query` parameter in `normalizeWeatherFacts` (line ~21) | Only passed to `extractWeatherEntities`; result goes into `entities` of the object-result branch. | The `query` parameter *is* used — it drives entity extraction. Not dead. |
| 2 | `query` parameter in `normalizeDeterministicFact` (line ~109) | Declared but never referenced in the function body. | High-confidence *local* dead — the parameter is unused inside this function. However, removing it is a **breaking signature change** for any external caller, so it should only be removed after confirming no caller passes it. Flagging as "verify caller" rather than "remove." |
| 3 | Module-level `factCounter` (line ~13) | Mutable global state shared across the module. | Not dead, but a code-smell; counter is reset only at process start, so `fact.id` uniqueness is process-lifetime. No action recommended. |
| 4 | Redundant ternary `typeof item === "string" ? item : JSON.stringify(item)` and `typeof results === "string" ? results : JSON.stringify(results)` | Type coercion repeated. | Not dead — both branches are reachable (caller could pass a string or object). Not redundant logic, just consistent. |
| 5 | Hardcoded province/region/ISP regexes (`extractWeatherEntities`, `extractISP`) | Magic patterns embedded in code. | Live code, not dead. Maintenance concern, not a dead-code concern. |

## Verification Steps Before Any Removal

To convert the above into actionable removals, the following are needed:

1. **Export usage check** — grep for each exported symbol across the repo:
   ```
   grep -rn "from .*hotRetriever" innomcp-node/src
   grep -rn "normalizeWeatherFacts\|normalizeEvidenceFacts\|normalizeDeterministicFact\|mergeRetrievalFacts\|composeFactSummary\|RetrievalFact" innomcp-node/src
   ```
2. **`query` parameter in `normalizeDeterministicFact`** — confirm via the grep above whether any caller actually passes a 4th argument. If not, the parameter can be dropped from the signature.
3. **Re-audit after import sites are known** — re-run with cross-references to catch exports that are never imported.

## Recommendation

Re-run this audit with the full repository context (or at minimum all `import` statements that reference `hotRetriever`). With only the single file provided, the only high-confidence local finding is the unused `query` parameter in `normalizeDeterministicFact`, and even that requires confirming no external caller depends on the 4-argument signature before removal.

---

## DEA-016 — deadcode — `innomcp-node/src/services/imageGenService.ts` [deepseek/deepseek-v4-flash]
| Location | What | Why Safe to Remove |
|----------|------|-------------------|
| Inside `callPollinations()`, the condition `if (!check.ok && check.status !== 200)` | Redundant condition | `check.ok` is `false` only when the HTTP status code is not in the 2xx range (i.e., not 200). Therefore, `check.status !== 200` is always `true` when `!check.ok` is `true`. Simplifying to `if (!check.ok)` yields identical behavior and eliminates unnecessary logic. |

---

## DEA-017 — deadcode — `innomcp-node/src/services/intentClassifier.ts` [deepseek/deepseek-v4-pro]
| location | what | why-safe-to-remove |
|----------|------|---------------------|
| `innomcp-node/src/services/intentClassifier.ts` (top-level constant `OFFICER_SIGNAL_RE`) | Unused constant `OFFICER_SIGNAL_RE` (regex) | The constant is never referenced anywhere in the module. The same regex pattern is duplicated inline inside `evidenceMatch()`, making the constant dead code. Removing it has no effect on behaviour or other modules. |

---

## DEA-018 — deadcode — `innomcp-node/src/services/leaderboardMetrics.ts` [moonshotai/Kimi-K2.6]
The user wants a dead/unused code audit for the provided TypeScript module `leaderboardMetrics.ts`. They want a list with columns: location | what | why-safe-to-remove. They want conservative, high-confidence flags only.

Let me analyze the code carefully.

1. **Unused exports**: Check exported functions/interfaces.
   - `ProviderStats` interface is exported. Is it used elsewhere? The module exports it, but we can't see other modules. However, the prompt asks to audit *this* module. Usually, exported items are meant for external use. But if we're strictly auditing this file for dead code, exported items are by definition reachable from outside. However, sometimes exports are unused by consumers. But we don't have the full codebase. The prompt says "Module: innomcp-node/src/services/leaderboardMetrics.ts". So I should focus on internal dead code, but also flag exports that might be unused if they are not referenced internally. Actually, the standard interpretation is: flag things that are dead *within* the module or clearly redundant. But "unused exports" specifically means exported but never imported. Since I only have this one file, I can't know for sure if `ProviderStats` is imported elsewhere. However, I can flag things that are exported but never used *within* the module, and suggest they might be unused exports if the codebase doesn't reference them. But the user wants conservative high-confidence. So I should be careful.

Wait, looking at the code, there are several exported functions: `recordProviderCall`, `getProviderStats`, `getSparklineData`, `getIntentWinsSnapshot`, `recordProviderWin`. The code is truncated at the end (`[pr`), but we can infer the rest.

Let me look for internal unused items:
- `computeStdDev` is defined but only used in `getProviderStats` inside an IIFE for `consistencyScore`. So it is used.
- `computeP95` is used in `getProviderStats`. So used.
- `persistLeaderboardStats` is used in `recordProviderCall` and likely `recordProviderWin` (though truncated, the comment says same pattern). So used.

Now look for redundant conditions or unreachable branches:
- In `recordProviderCall`, `responseChars` parameter is optional. The condition `if (responseChars != null)` is fine.
- In `getProviderStats`, `winRate` calculation: `raw.requests > 0 ? Math.round((raw.wins / raw.requests) * 100) : 0`. But `efficiencyScore` is `raw.requests > 0 ? Math.min(100, Math.round((raw.wins / raw.requests) * 100)) : 0`. These are very similar but not identical. `winRate` is not capped at 100, while `efficiencyScore` is. But wait, `winRate` is wins/requests * 100. Since wins <= requests, this is naturally <= 100. So `Math.min(100, ...)` in `efficiencyScore` is redundant because `(raw.wins / raw.requests) * 100` can never exceed 100. However, is it possible for wins > requests? In the data model, wins are incremented separately from requests. A provider could theoretically have more wins than requests if `recordProviderWin` is called without `recordProviderCall`? Looking at `recordProviderWin`, if no existing entry, it creates one with `requests: 0, wins: 1`. So yes, wins can exceed requests. Therefore `Math.min(100, ...)` is not redundant. Wait, but `winRate` uses the same formula without cap. If wins > requests, winRate could exceed 100. Is that intended? Maybe. But the efficiencyScore is capped. So not redundant.

- In `getProviderStats`, `healthScore`: `raw.requests > 0 ? Math.round(Math.round((raw.successes / raw.requests) * 100) * 0.7 + (raw.wins > 0 ? 30 : 0)) : 0`. The inner `Math.round` on the success rate seems redundant because it's then multiplied by 0.7 and rounded again. But it's not dead code, just slightly odd.

- In `getProviderStats`, `currentStreak: raw.currentStreak ?? 0`. Since `currentStreak` is always initialized to a number in both `store.set` branches (0), the `?? 0` is redundant but safe. However, is it high-confidence dead? It's a redundant fallback. The user asked for "redundant conditions". This qua

---

## DEA-019 — deadcode — `innomcp-node/src/services/mcpClient.ts` [zai-org/GLM-5.1]
| Location | What | Why-safe-to-remove |
|---|---|---|
| `catch` block, `err as { name?: string; status?: number; message?: string }` | `name` property in type assertion | Only `message` and `status` are ever read from `e`; `name` is asserted but never accessed — pure dead type member |
| Module-level `let defaultClient` + `export function getDefaultMcpClient()` | Singleton mutable state and getter | File explicitly documents it is "NOT YET wired"; no caller exists. Adds module-level mutable state (`let … = null`) for zero benefit — consumers already instantiate via `new McpClient()` per the file's own usage example. Re-introduce when/if a singleton is actually needed. |

---

## DEA-020 — deadcode — `innomcp-node/src/services/mdesModelCache.ts` [MiniMaxAI/MiniMax-M3]
# Dead/Unused Code Audit: `mdesModelCache.ts`

After thorough review, this module is **tight and well-used internally**. No dead code, commented-out blocks, unreachable branches, or duplicate logic were found. Below are observations, including items considered and rejected.

## Findings

| # | Location | What | Why safe to remove / status |
|---|----------|------|------------------------------|
| — | — | — | **No high-confidence dead code found.** |

## Considered & Rejected (not flagged)

| Candidate | Reason rejected |
|-----------|-----------------|
| `// 5 minutes` comment on `TTL_MS` | Useful inline documentation, not commented-out code. |
| `// go to reasoning fallback` and `// generic largest selection below` comments inside `getBestModelForTask` switch cases | Intentional flow documentation explaining the shared tail; not dead branches. |
| `// lack of quantization_level counts as 0` comment in `fast` case | Explains non-obvious default; not commented-out code. |
| `// default to a large number if unrecognized` comment in `sizeValue` | Documents a deliberate sentinel value. |
| `// If cache exists, return stale cache to avoid service disruption` comment | Explains intentional resilience behavior, not dead logic. |
| `MDESModel.details.parameter_size` / `family` / `quantization_level` optional fields | All consumed in `getModelFamilies` and `getBestModelForTask`. |
| `getStats().ttlRemaining` field | Public API surface; cannot determine external usage of this shape from the file alone. |
| `mdesModelCache` exported singleton | Standard pattern; usage outside this module isn't visible here. |
| `OllamaTagsResponse` interface (not exported) | Used internally by `getModels`; not dead. |
| `warmUp()` | Could be unused if not called at server start, but it's a public method that documents an intended lifecycle hook — flagging would not be high-confidence. |
| `isModelAvailable` and `getModel` convenience methods | Single-line wrappers, but they form part of the module's public surface; usage can't be verified from this file alone. |

## Recommendation

**No removals warranted.** The module has no commented-out code blocks, no unreachable branches, no redundant conditions, and no duplicate logic. All exports, methods, and fields are referenced either internally or form a coherent public API whose external consumers cannot be determined from this file in isolation.

If you want a **secondary review** that flags *speculative* cleanup (e.g., consolidating `getModel`/`isModelAvailable` into inline `.find`/`.some` at call sites, or inlining `sizeValue` if only used twice), let me know and I can produce a lower-confidence list separately.

---

## DEA-021 — deadcode — `innomcp-node/src/services/memoryRagHook.ts` [deepseek/deepseek-v4-pro]
1 | function `extractEntities` (parameters) | Unused parameter `toolResult?: any` declared but never referenced inside the function body | Safe to remove: parameter is optional, never read, and the function is module-private; the sole caller in `recordTurnAndGetMeta` also passes a `toolResult` argument that will be ignored, so both the parameter and the passing argument can be cleaned up without affecting any other code.

---

## DEA-022 — deadcode — `innomcp-node/src/services/metricsCollector.ts` [Qwen/Qwen3.7-Max]
| location | what | why-safe-to-remove |
| :--- | :--- | :--- |
| `Histogram` class (type definition & `observe` method) | `buckets` property in the metric data object and its initialization (`buckets: [...this.buckets]`) | The property is allocated but never read. `exportLines` and other methods reference `this.buckets` from the class instance, making the per-label copy dead code. |
| `Counter.inc` and `Gauge.inc` methods | Redundant `const k = this.key(labels);` computation | `this.key(labels)` is already computed internally by `this.getOrCreate(labels, ...)` on the preceding line. The duplicate call can be removed by refactoring `getOrCreate` to return the key or by inlining the map lookup. |
| `formatLabels` function | `.filter(([, v]) => v !== undefined)` condition | `LabelValues` is strictly typed as `Record<string, string>`, meaning values are guaranteed to be strings. The undefined check is always true and type-redundant. |
| `Counter`, `Gauge`, and `Histogram` `exportLines` methods | Duplicated logic for reconstructing `labelObj` from `JSON.parse(key)` | The exact same 4-line block parsing the map key back into a `LabelValues` object is copy-pasted in all three subclasses. It can be safely extracted into a shared protected helper method (e.g., `parseKey`) in the base `Metric` class. |

---

## DEA-023 — deadcode — `innomcp-node/src/services/modelLoadBalancer.ts` [moonshotai/Kimi-K2.6]
The user wants a dead/unused code audit for the provided TypeScript module `innomcp-node/src/services/modelLoadBalancer.ts`.

 I need to look for:
 1. Unused exports
 2. Unreachable branches
 3. Redundant conditions
 4. Commented-out blocks
 5. Duplicate logic

 I need to output a list with columns: location | what | why-safe-to-remove
 And be conservative — flag only high-confidence items.

 Let's analyze the code carefully.

 **1. Unused exports:**
 - `ModelConfig` is exported. Is it used elsewhere? The module is a service file. Since I don't have other files, I need to check if it's used within this file. It's used in `addModel`, `selectModel`, etc. But is it exported unnecessarily? The prompt asks for unused exports. Without knowing the whole project, I should be careful. However, if an interface is exported but only used internally, it might be safe to un-export, but I can't be sure it's unused by other modules. The prompt says "Conservative — flag only high-confidence". So I should probably skip export analysis unless it's clearly only used internally and the module is clearly a private implementation detail... but actually, `ModelConfig`, `ModelStats`, `Strategy` are all exported. They are likely used by consumers of this service. I won't flag these as unused exports without seeing the rest of the codebase.

 Wait, the prompt says "unused exports". In a single-file audit, I can only see if an export is used *within* the file. If it's not used within the file, it might still be imported elsewhere. But if it's exported and not used in the file, and the file is a service implementation, there's a chance it's part of the public API. However, `ModelLoadBalancer` is a default export. The other exports are type exports. It's common to export types that are used as parameters/return types of the public methods. `ModelConfig` is used in `addModel` (public method). `ModelStats` is used in `getStats` (public method). `Strategy` is used in `selectModel` and `setStrategy` (public methods). So these are likely intentionally exported for consumers. I won't flag them.

 **2. Unreachable branches / Redundant conditions:**
 - In `addModel`:
   ```typescript
   state.config = { ...config };
   ```
   But `config` might not have `weight` or `tags` set. However, when updating, it just replaces the config. But wait, in the `else` branch (new model), it does:
   ```typescript
   config: { ...config, weight: config.weight ?? 1, tags: config.tags ?? [] },
   ```
   In the update branch (`if (this.models.has(config.id))`), it does:
   ```typescript
   state.config = { ...config };
   ```
   This means if you update a model and don't provide `weight` or `tags`, they become `undefined` instead of keeping previous defaults. This is inconsistent but not dead code. Not a removal candidate.

 - In `selectModel`, `weighted` case:
   ```typescript
   const totalWeight = eligible.reduce((sum, m) => sum + (m.config.weight ?? 1), 0);
   ```
   Then:
   ```typescript
   for (const m of eligible) {
     rand -= m.config.weight ?? 1;
     if (rand <= 0) {
       selected = m;
       break;
     }
   }
   // Fallback (should never happen)
   if (!selected) selected = eligible[0];
   ```
   Is the fallback redundant? Let's think. `rand` starts at `Math.random() * totalWeight`. `totalWeight` is the sum of weights. If `totalWeight` is 0 (all weights are 0 or undefined and treated as 1... wait, if weight is explicitly 0, `m.config.weight ?? 1` would be 1 because `??` only catches null/undefined. So if weight is 0, it's treated as 0. If all weights are 0, totalWeight is 0. Then `rand` is 0. The loop subtracts 0, `rand <= 0` is true immediately for the first element? Wait, if `rand` is 0, and we subtract `m.config.weight ?? 1` (which is 0), `rand` stays 0. `rand <= 0` is true, so first element is selected. If eligible is empty, we already returned null. So the loop always selects something because `rand` starts in `[0, totalWeight)`, and we subtract weights until we

---

## DEA-024 — deadcode — `innomcp-node/src/services/motherExportService.ts` [zai-org/GLM-5.1]
| location | what | why-safe-to-remove |
|---|---|---|
| *(none)* | — | — |

**Assessment:** This module is clean — no high-confidence dead/unused code was found.

- **No commented-out blocks.**
- **No unreachable branches.** The `if (history.length === 0)` early-return in `exportToCSV` is a valid runtime guard, not a redundant condition.
- **No unused exports** determinable from this module alone. Both `exportToJSON`/`exportToCSV` are individually exported *and* re-exposed via `motherExportService`, which is a redundancy risk — but without cross-module import analysis, neither can be confidently flagged as dead.
- **No duplicate logic** beyond the shared `motherHistory.get(options.limit)` call, which is a trivial single-line read that doesn't warrant extraction.
- **No redundant conditions.**

---

## DEA-025 — deadcode — `innomcp-node/src/services/motherHistory.ts` [deepseek/deepseek-v4-pro]
No high-confidence dead code issues found in this module. The exported interfaces and functions form a coherent public API; there are no internal redundancies, unreachable branches, commented-out blocks, or duplicate logic that can be safely removed without additional usage context.

---

## DEA-026 — deadcode — `innomcp-node/src/services/motherProviderToggle.ts` [deepseek/deepseek-v4-flash]
| location | what | why-safe-to-remove |
|---|---|---|
| `innomcp-node/src/services/motherProviderToggle.ts` | No dead/unused code identified | All exports are intentionally exposed as API for external use; no redundant branches, commented-out blocks, or duplicate logic exist within the module. Each function serves a distinct toggle/query purpose and is reachable. No high-confidence findings. |

---

## DEA-027 — deadcode — `innomcp-node/src/services/naturalnessGuard.ts` [Qwen/Qwen3.7-Max]
| location | what | why-safe-to-remove |
|---|---|---|
| *Module-wide* | No high-confidence dead/unused code, unreachable branches, or redundant conditions found. | The module is concise and well-structured. All exports are actively tied to the main function's signature, runtime type guards are defensively sound, and regex/logic branches are fully reachable and distinct. |

---

## DEA-028 — deadcode — `innomcp-node/src/services/notificationService.ts` [moonshotai/Kimi-K2.6]
The user wants a dead/unused code audit for the provided TypeScript module `notificationService.ts`.

 I need to look for:
 1. Unused exports
 2. Unreachable branches
 3. Redundant conditions
 4. Commented-out blocks
 5. Duplicate logic

 I need to output a list with columns: `location | what | why-safe-to-remove`
 And be conservative - only flag high-confidence items.

 Let's analyze the code carefully.

 ```typescript
 type NotificationType = 'task_complete' | 'agent_done' | 'error' | 'system' | 'mdes_alert';

 interface Notification {
   id: string;
   type: NotificationType;
   title: string;
   message?: string;
   sessionId?: string;
   broadcast?: boolean;
   timestamp: number;
   data?: unknown;
 }

 interface SessionNotificationSubscription {
   subscribe(callback: (n: Notification) => void): () => void;
   getRecentNotifications(limit?: number): Notification[];
 }

 class NotificationService {
   private static readonly MAX_HISTORY = 1000;
   private listeners = new Map<string, (n: Notification) => void>();
   private history: Notification[] = [];

   subscribe(sessionId: string, callback: (n: Notification) => void): () => void {
     this.listeners.set(sessionId, callback);
     return () => {
       if (this.listeners.get(sessionId) === callback) {
         this.listeners.delete(sessionId);
       }
     };
   }

   notify(notification: Omit<Notification, 'id' | 'timestamp'>): void {
     const fullNotification: Notification = {
       ...notification,
       id: crypto.randomUUID(),
       timestamp: Date.now(),
     };
     this.addToHistory(fullNotification);
     const callback = this.listeners.get(notification.sessionId!);
     if (callback) {
       callback(fullNotification);
     }
   }

   broadcast(notification: Omit<Notification, 'id' | 'timestamp' | 'sessionId'>): void {
     const fullNotification: Notification = {
       ...notification,
       id: crypto.randomUUID(),
       timestamp: Date.now(),
       broadcast: true,
     };
     this.addToHistory(fullNotification);
     for (const [, callback] of this.listeners) {
       try {
         callback(fullNotification);
       } catch (err) {
         console.error('Notification listener error:', err);
       }
     }
   }

   notifyTaskComplete(sessionId: string, taskSummary: string): void {
     this.notify({
       type: 'task_complete',
       title: 'งานเสร็จสมบูรณ์',
       message: taskSummary,
       sessionId,
     });
   }

   notifyMDESAlert(message: string): void {
     this.broadcast({
       type: 'mdes_alert',
       title: 'การแจ้งเตือนจาก MDES',
       message,
     });
   }

   notifyAgentDone(sessionId: string, agentId: string, model: string, elapsed: number): void {
     this.notify({
       type: 'agent_done',
       title: 'เอเจนต์ทำงานเสร็จสิ้น',
       message: `Agent ${agentId} (${model}) ทำงานเสร็จใน ${elapsed}ms`,
       sessionId,
     });
   }

   getRecentNotifications(sessionId: string, limit = 50): Notification[] {
     return this.history
       .filter(n => n.sessionId === sessionId)
       .sort((a, b) => b.timestamp - a.timestamp)
       .slice(0, limit);
   }

   private addToHistory(notification: Notification): void {
     this.history.push(notification);
     if (this.history.length > NotificationService.MAX_HISTORY) {
       this.history = this.history.slice(-NotificationService.MAX_HISTORY);
     }
   }
 }

 export const notificationService = new NotificationService();
 ```

 Observations:

 1. **Unused export/interface**: `SessionNotificationSubscription` is defined but never used anywhere in this file, and since it's not exported (wait, is it exported? No, it's not exported. But the user asked for unused exports. Let me check what is exported. Only `notificationService` is exported. `SessionNotificationSubscription` is not exported, but it's defined and unused. Is it safe to remove? If it's not exported and not used in this file, yes. But wait - could it be used by other files via some ambient module declarati

---

## DEA-029 — deadcode — `innomcp-node/src/services/presenceService.ts` [deepseek/deepseek-v4-pro]
| location | what | why-safe-to-remove |
|----------|------|---------------------|
| (none) | No high-confidence dead/unused code, unreachable branches, redundant conditions, commented-out blocks, or duplicate logic detected in this module. | All exports appear to serve defined API functions; internal logic is straightforward and free of dead paths. |