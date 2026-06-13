<!-- cc-team deliverable
 group: G1 (deadcode division)
 member: DEA-003 role=deadcode model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":868,"completion_tokens":5000,"total_tokens":5868,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 66s
 generated: 2026-06-13T11:59:11.695Z -->
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
 What if `hasLive` is false, `hasStale` is true, and includes "recent"? Then it stays "stale" because the `else if (freshnessValues.includes("recent"))` is only reached if `hasLive` is false. Wait, if hasLive is false and hasStale is true, and there is "recent", the code reaches `else if (freshnessValues.includes("recent"))` and sets to "recent". But should it be "stale" or "mixed"? The logic says if hasLive && hasStale -> mixed. If only stale and recent, it goes to "recent". Is that intended? Maybe, but not "unreachable".

 Wait, is there a redundant condition?
 Look at:
 ```typescript
 const hotSources = params.sources.filter((s) => s.type === "tool" || s.type === "api" || s.type === "database");
 ```
 And the `RetrievalSource` type:
 ```typescript
 type: "tool" | "document" | "database" | "api";
 ```
 So hotSources filters for everything except "document". coldSources filters for "document". They are mutually exclusive and exhaustive based on the current type definition. Is this duplicate logic? Not exactly, but it's a partition.

 Is there commented-out code? No.

 Is there dead code in the sense of unused variables?
 - `now` is used.
 - `freshness` is used.
 - `hotSources`, `coldSources` are used.

 What about `sourceIds`? It's computed and returned. Is it redundant because `sources` is also returned and contains `id`? The audit asks for "dead/unused code", not "redundant data in a data structure". But `sourceIds` could be considered redundant because you can derive it from `sources`. However, removing it would change the API. The prompt says "Conservative — flag only high-confidence". So I should not flag API fields as dead code unless they are truly unused.

 Wait, let me re-read the freshness logic carefully.
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

 Consider the case: `params.sources.length > 0`, `hasLive = false`, `hasStale = true`, and `freshnessValues` contains only "stale".
 Then:
 - `hasLive && hasStale` -> false
 - `else if (hasLive)` -> false
 - `else if (freshnessValues.includes("recent"))` -> false
 - `freshness` remains "stale". Correct.

 Consider case: `params.sources.length > 0`, `hasLive = false`, `hasStale = false`, `freshnessValues` contains only "recent".
 Then:
 - `hasLive && hasStale` -> false
 - `else if (hasLive)` -> false
 - `else if (freshnessValues.includes("recent"))` -> true, freshness = "recent". Correct.

 Consider case: `params.sources.length > 0`, `hasLive = false`, `hasStale = true`, `freshnessValues` contains "recent" and "stale".
 Then:
 - `hasLive && hasStale` -> false (because hasLive is false)
 - `else if (hasLive)` -> false
 - `else if (freshnessValues.includes("recent"))` -> true, freshness = "recent".
 But wait, there is stale and recent. Should it be "mixed"? The definition of "mixed" is only when hasLive && hasStale. If there is stale and recent but no live, it becomes "recent". Is that a bug? Maybe, but not dead code.

 Actually, is there an unreachable branch?
 What if `params.sources.length > 0` and all sources are "stale"? Then `hasStale = true`, `hasLive = false`. The condition `hasLive && hasStale` is false. `else if (hasLive)` is false. `else if (freshnessValues.includes("recent"))` is false. Freshness remains "stale". That's reachable.

 What about the `else if (params.answerMode === "deterministic")` branch? It's reachable when `params.sources.length === 0`.

 Hmm. Let me look for truly dead code.

 What about the `RetrievalMode` type values: `"hot" | "cold" | "both" | "none"`.
 In `buildAnswerContract`, `params.retrievalUsed` is passed through directly. No logic branches on it. So no dead branches there.

 Is there any unused import? No imports at all.

 Is there any commented-out block? No.

 Is there duplicate logic? The `sourceIds` field is derived from `params.sources.map((s) => s.id)`, and `sources` is also included. This is not duplicate logic, just derived data.

 Wait, I need to be more creative. Let's look at the `AnswerContract` interface.
 ```typescript
 export interface AnswerContract {
   // ...
   hotSources?: RetrievalSource[];
   coldSources?: RetrievalSource[];
   // ...
 }
 ```
 And in the builder:
 ```typescript
 hotSources: hotSources.length > 0 ? hotSources : undefined,
 coldSources: coldSources.length > 0 ? coldSources : undefined,
 ```
 Is there any dead code here? Not really.

 Let me reconsider "unused exports". The module exports `AnswerMode`, `RetrievalMode`, `RetrievalSource`, `AnswerContract`, `buildAnswerContract`.
 If this is a service module, perhaps some of these are only used internally within the module and don't need to be exported? But they are all used in the public interface of the module. `buildAnswerContract` returns `AnswerContract` which uses `RetrievalSource` and `AnswerMode` and `RetrievalMode`. So they need to be exported for consumers to type their variables.

 Unless... `buildAnswerContract` is the only thing used, and the types are inferred? But consumers might need the type names.

 Let's look at the prompt again. "Dead/unused code audit: unused exports, unreachable branches, redundant conditions, commented-out blocks, duplicate logic."

 Maybe I missed a redundant condition. Let's look at:
 ```typescript
 const hotSources = params.sources.filter((s) => s.type === "tool" || s.type === "api" || s.type === "database");
 ```
 Given `type: "tool" | "document" | "database" | "api"`, this is equivalent to `s.type !== "document"`. Is that a redundant condition? No, it's explicit.

 What about `Math.max(0, Math.min(1, params.confidence))`? That's standard clamping. Not dead.

 Hmm. Is it possible that the entire `sourceIds` field is dead because it's never read? The prompt says "unused exports, unreachable branches...". If `sourceIds` is never read by any consumer, it's dead data. But I don't know the consumers. However, within the module, it's constructed and returned. I can't know if consumers use it.

 Wait, maybe there's something in the `freshness` logic.
 ```typescript
 if (hasLive && hasStale) freshness = "mixed";
 else if (hasLive) freshness = "live";
 else if (freshnessValues.includes("recent")) freshness = "recent";
 ```
 If `hasLive` is true, we know there is at least one "live". If `hasStale` is also true, it's "mixed". If not, it's "live".
 What if `hasLive` is false and `hasStale` is true? We skip to `else if (freshnessValues.includes("recent"))`.
 But what if `freshnessValues` includes "stale" and "recent"? Then `hasStale` is true, `hasLive` is false. It will check `includes("recent")` and set to "recent". But there is also stale. Should it be "mixed"? The type allows "mixed". But the code only mixes live+stale, not stale+recent. This is potentially a bug, but not dead code.

 Let me think about "unreachable branches" again.
 Is there any branch that is impossible due to types?
 `params.degraded ?? false` — if `params.degraded` is `boolean | undefined`, the `?? false` handles undefined. Not dead.

 What about `memoryEntities`? It's optional in params and optional in contract. Passed through. Not dead.

 Maybe the issue is with `sourceIds` being derivable from `sources` and thus the mapping logic is duplicate? The prompt mentions "duplicate logic". Computing `sourceIds` from `sources` while also returning `sources` is duplicate in the sense that the information is duplicated. But is it "logic"? It's a simple map. And it's not safe to remove if consumers rely on `sourceIds`.

 Actually, I think I found something.
 Look at `RetrievalMode` type: `"hot" | "cold" | "both" | "none"`.
 And `AnswerContract` has:
 ```typescript
 retrievalUsed: RetrievalMode;
 hotSources?: RetrievalSource[];
 coldSources?: RetrievalSource[];
 ```
 But `buildAnswerContract` doesn't use `params.retrievalUsed` to decide whether to populate `hotSources`/`coldSources`. It always partitions `params.sources`. So if `retrievalUsed` is "none", it still might return hot/cold sources if sources are passed. That's an inconsistency, but not dead code.

 Let's reconsider the `freshness` logic. Is there a redundant condition?
 ```typescript
 const hasLive = freshnessValues.includes("live");
 const hasStale = freshnessValues.includes("stale");
 if (hasLive && hasStale) freshness = "mixed";
 else if (hasLive) freshness = "live";
 else if (freshnessValues.includes("recent")) freshness = "recent";
 ```
 If `hasLive` is true, the second condition `else if (hasLive)` is checked. But if `hasLive && hasStale` was true, the first block executes and the second is skipped. So no redundancy.

 What if `hasLive` is false? Then `else if (hasLive)` is false. Then `else if (freshnessValues.includes("recent"))`.
 If `freshnessValues` includes "recent", it sets to "recent".
 If not, it stays "stale".
 Is there any case where `freshnessValues.includes("recent")` is checked but we already know it's false? No.

 Hmm. Maybe I'm overthinking. Let's look for truly obvious things.

 Is `sourceIds` array used? It's returned. But is it possible that `sourceIds` is redundant because `sources` contains the same IDs? If the contract is only consumed internally and we know `sourceIds` is never read, it could be dead. But I don't have that information.

 Wait, the user says "Conservative — flag only high-confidence". So if I'm not sure, I shouldn't flag it.

 Are there any unused types/interfaces within the module? No, all are used.

 Are there any variables declared but not used?
 - `now` used.
 - `freshness` used.
 - `hotSources` used.
 - `coldSources` used.
 - `hasLive` used.
 - `hasStale` used.
 - `freshnessValues` used.

 What about the JSDoc comment `/** Answer Contract — structured metadata... */`? Not dead code.

 Maybe the `RetrievalMode` type has a value `"both"` that is never used in any logic branch? But it's a type definition. The builder accepts it. Not dead.

 Let's look at the `buildAnswerContract` parameter `degraded?: boolean`. It defaults to `false` with `??`. Not dead.

 Is there any duplicate logic between `hotSources` and `coldSources` filters?
 ```typescript
 const hotSources = params.sources.filter((s) => s.type === "tool" || s.type === "api" || s.type === "database");
 const coldSources = params.sources.filter((s) => s.type === "document");
 ```
 These two filters partition the sources. If the `RetrievalSource.type` union changes, both might need updating. But that's not duplicate logic, it's complementary logic.

 Actually, wait. Is there an unreachable branch in the freshness logic?
 Consider: `params.sources.length > 0`, and all sources have `freshness: "stale"`.
 Then `hasLive = false`, `hasStale = true`.
 `if (hasLive && hasStale)` -> false.
 `else if (hasLive)` -> false.
 `else if (freshnessValues.includes("recent"))` -> false.
 Freshness remains "stale". Reachable.

 Consider: `params.sources.length > 0`, all sources have `freshness: "recent"`.
 `hasLive = false`, `hasStale = false`.
 `if (hasLive && hasStale)` -> false.
 `else if (hasLive)` -> false.
 `else if (freshnessValues.includes("recent"))` -> true. Freshness = "recent". Reachable.

 Consider: `params.sources.length > 0`, sources have `freshness: "live"` and `freshness: "recent"`.
 `hasLive = true`, `hasStale = false`.
 `if (hasLive && hasStale)` -> false.
 `else if (hasLive)` -> true. Freshness = "live". Reachable.

 Consider: `params.sources.length > 0`, sources have `freshness: "stale"` and `freshness: "recent"`.
 `hasLive = false`, `hasStale = true`.
 `if (hasLive && hasStale)` -> false.
 `else if (hasLive)` -> false.
 `else if (freshnessValues.includes("recent"))` -> true. Freshness = "recent".
 But there is a stale source! So it's not "mixed" (which requires live), but it has stale and recent. The result is "recent". Is that correct? Maybe not, but it's reachable.

 Hmm. What if `params.sources.length === 0` and `params.answerMode === "deterministic"`?
 Then `freshness = "live"`. Reachable.

 What if `params.sources.length === 0` and `params.answerMode !== "deterministic"`?
 Then freshness remains "stale". Reachable.

 So no unreachable branches.

 Is there any commented-out block? No.

 Is there any unused export? Let's reconsider. The file is `answerContract.ts`. It exports 5 symbols. If `buildAnswerContract` is used by other modules, the types might be needed. But what if `RetrievalMode` is exported but never used by consumers? I can't know.

 However, there is one thing: `sourceIds` in the interface and the builder. If the consumers only use `sources`, then `sourceIds` is dead data. But I can't be high-confidence about that.

 Wait, maybe I should look at the `RetrievalSource` interface. It has `path?: string`. Is `path` ever assigned? In `buildAnswerContract`, `sources` comes from `params.sources`, which is typed as `RetrievalSource[]`. So `path` could be present. Not dead.

 Let me reconsider the `hotSources`/`coldSources` logic.
 ```typescript
 const hotSources = params.sources.filter((s) => s.type === "tool" || s.type === "api" || s.type === "database");
 const coldSources = params.sources.filter((s) => s.type === "document");
 ```
 If a new type is added to `RetrievalSource.type`, say `"cache"`, it would fall into neither hot nor cold. That's a potential bug, but not dead code.

 Actually, I think I need to look at this from a different angle. The user might expect me to find something subtle.

 Look at the `AnswerContract` interface:
 ```typescript
 export interface AnswerContract {
   // Route info
   route: string;
   toolsUsed: string[];
   
   // Source tracking
   sourceIds: string[];
   sources: RetrievalSource[];
   grounded: boolean;
   
   // Answer classification
   answerMode: AnswerMode;
   fallbackReason?: string;
   
   // Freshness
   freshness: "live" | "recent" | "stale" | "mixed";
   confidence: number;
   
   // Memory integration
   memoryUsed: boolean;
   memoryEntities?: string[];
   
   // Retrieval
   retrievalUsed: RetrievalMode;
   hotSources?: RetrievalSource[];
   coldSources?: RetrievalSource[];
   
   // Timing
   timestamp: string;
   latencyMs?: number;
   
   // Degraded state
   degraded: boolean;
   degradedReasons?: string[];
 }
 ```

 And the builder:
 ```typescript
 return {
   route: params.route,
   toolsUsed: params.toolsUsed,
   sourceIds: params.sources.map((s) => s.id),
   sources: params.sources,
   grounded: params.grounded,
   answerMode: params.answerMode,
   fallbackReason: params.fallbackReason,
   freshness,
   confidence: Math.max(0, Math.min(1, params.confidence)),
   memoryUsed: params.memoryUsed,
   memoryEntities: params.memoryEntities,
   retrievalUsed: params.retrievalUsed,
   hotSources: hotSources.length > 0 ? hotSources : undefined,
   coldSources: coldSources.length > 0 ? coldSources : undefined,
   timestamp: now,
   latencyMs: params.latencyMs,
   degraded: params.degraded ?? false,
   degradedReasons: params.degradedReasons,
 };
 ```

 Is `sourceIds` redundant given `sources`? Yes, it's derived data. But is it "dead/unused code"? Only if no consumer reads it. I can't be sure.

 Is there a redundant condition in the clamping? `Math.max(0, Math.min(1, params.confidence))`. If `params.confidence` is already typed as `number`, and maybe validated elsewhere, this could be redundant. But it's defensive programming, not dead code.

 What about `params.degraded ?? false`? If `params.degraded` is optional boolean, and the interface requires `boolean`, this is necessary. Not redundant.

 Hmm. Let me look at the `freshness` logic one more time.
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

 Wait. `freshnessValues` is an array. `includes("recent")` is O(n). But that's not dead code.

 Is there any
