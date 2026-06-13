<!-- cc-team deliverable
 group: G1 (deadcode division)
 member: DEA-023 role=deadcode model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":1925,"completion_tokens":5000,"total_tokens":6925,"prompt_tokens_details":{"cached_tokens":53,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 45s
 generated: 2026-06-13T12:03:56.666Z -->
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
   Is the fallback redundant? Let's think. `rand` starts at `Math.random() * totalWeight`. `totalWeight` is the sum of weights. If `totalWeight` is 0 (all weights are 0 or undefined and treated as 1... wait, if weight is explicitly 0, `m.config.weight ?? 1` would be 1 because `??` only catches null/undefined. So if weight is 0, it's treated as 0. If all weights are 0, totalWeight is 0. Then `rand` is 0. The loop subtracts 0, `rand <= 0` is true immediately for the first element? Wait, if `rand` is 0, and we subtract `m.config.weight ?? 1` (which is 0), `rand` stays 0. `rand <= 0` is true, so first element is selected. If eligible is empty, we already returned null. So the loop always selects something because `rand` starts in `[0, totalWeight)`, and we subtract weights until we go <= 0. Since totalWeight > 0 unless all weights are 0. If all weights are 0, the first element gets selected because `rand` is 0 and `rand <= 0` is true immediately. Actually, if `rand` is 0 and weight is 0, `rand -= 0` => 0, `0 <= 0` true. So first element selected. If eligible is non-empty, `selected` will always be set. So the fallback `if (!selected) selected = eligible[0];` is indeed unreachable/redundant if `eligible.length > 0`. But is it high-confidence safe to remove? Yes, mathematically it cannot happen. However, if `totalWeight` is 0 because eligible is empty, we already returned null above. So yes, inside the `if (eligible.length === 0) return null;` block, the fallback is unreachable. This is a good candidate.

   Wait, what if `Math.random()` returns exactly 1.0? No, `Math.random()` returns `[0, 1)`. So `rand` is `[0, totalWeight)`. If `totalWeight` is positive, and we subtract weights summing to `totalWeight`, we must cross 0 by the end of the loop at the latest. So yes, `selected` is always assigned. The fallback is dead code.

 - In `selectModel`, `round-robin` case:
   ```typescript
   if (this.roundRobinIndex >= eligible.length) {
     this.roundRobinIndex = 0;
   }
   selected = eligible[this.roundRobinIndex];
   this.roundRobinIndex = (this.roundRobinIndex + 1) % eligible.length;
   ```
   The check `if (this.roundRobinIndex >= eligible.length)` is redundant because the next line uses modulo: `this.roundRobinIndex = (this.roundRobinIndex + 1) % eligible.length;`. But wait, the *selection* uses `this.roundRobinIndex` *before* the modulo adjustment. If `this.roundRobinIndex >= eligible.length`, then `eligible[this.roundRobinIndex]` is `undefined`. So the check is necessary to prevent out-of-bounds access! Because `this.roundRobinIndex` could be, say, 5, and eligible length is 2. Without the check, `eligible[5]` is undefined. So the check is NOT redundant. It's necessary.

   However, we could rewrite it to avoid the check, but as written, it's needed. So not dead code.

 - In `recordLatency`:
   ```typescript
   state.activeRequests = Math.max(0, state.activeRequests - 1);
   ```
   Is it possible `activeRequests` is already 0? Yes, if `recordLatency` is called without a corresponding `selectModel`, or called multiple times. But this is defensive programming, not dead code.

 - In `recordError`:
   ```typescript
   state.activeRequests = Math.max(0, state.activeRequests - 1);
   ```
   Same as above.

 - In `getStats`:
   ```typescript
   const errorRate = st.totalRequests > 0 ? st.totalErrors / st.totalRequests : 0;
   ```
   This is used. Not dead.

 - In `startHealthProbes`:
   ```typescript
   if (this.healthProbeTimer) return;
   ```
   This is a guard. Not dead.

 - In `runHealthProbes`:
   ```typescript
   if (state.disabledUntil && state.disabledUntil <= now) {
   ```
   This is reachable.

 **3. Commented-out blocks:**
 I don't see any `//` commented-out code blocks or `/* */` blocks containing code. There is a `/* …truncated… */` at the end, but that's just an artifact of the prompt. I should ignore that.

 **4. Duplicate logic:**
 - Latency average calculation appears twice:
   1. In `selectModel` (`least-latency` case):
      ```typescript
      const bestAvg = best.latencyWindow.length > 0
        ? best.latencyWindow.reduce((a, b) => a + b, 0) / best.latencyWindow.length
        : 0;
      ```
   2. In `getStats`:
      ```typescript
      const avgLatency =
        st.latencyWindow.length > 0
          ? st.latencyWindow.reduce((a, b) => a + b, 0) / st.latencyWindow.length
          : 0;
      ```
   This is duplicate logic. Is it safe to remove? Not exactly "remove", but "extract to helper". The prompt asks for "duplicate logic" in the audit list. The output format is `location | what | why-safe-to-remove`. For duplicate logic, it's not about removing the logic entirely, but extracting it. However, the prompt says "Output list | location | what | why-safe-to-remove". Maybe for duplicate logic, the "why-safe-to-remove" explains that it's duplicated elsewhere and can be centralized. Or maybe I should flag it as "extractable". Let's see. The user wants "Dead/unused code audit". Duplicate logic isn't strictly dead code, but it's in the prompt's list of things to look for. I'll include it and frame it as "extract to shared helper — safe to consolidate".

   Wait, is there a helper already? No. So I should flag the two locations.

   Actually, looking at the prompt again: "Dead/unused code audit: unused exports, unreachable branches, redundant conditions, commented-out blocks, duplicate logic. Output list | location | what | why-safe-to-remove |. Conservative — flag only high-confidence."

   For duplicate logic, "safe to remove" means "safe to remove the inline duplication in favor of a shared helper". I'll include it.

 - Also, the `avgLatency` calculation in `getStats` and the latency calculation in `selectModel` are identical patterns.

 - Another duplicate: `state.activeRequests = Math.max(0, state.activeRequests - 1);` appears in both `recordLatency` and `recordError`. This is duplicate logic. Could be extracted to a private helper like `decrementActiveRequests(state)`. But is it high-confidence safe to remove? It's a one-liner. Extracting might be overkill. But it is duplicate logic. I'll mention it but maybe note it as "minor duplication". Actually, the prompt asks to be conservative. A one-liner duplication is low impact. The latency window average is a more significant duplication (3 lines each). I'll flag the latency average.

 - Also, `m.config.weight ?? 1` appears twice in the `weighted` case. That's minor.

 **5. Redundant conditions:**
 - In `addModel`, the `else` branch:
   ```typescript
   config: { ...config, weight: config.weight ?? 1, tags: config.tags ?? [] },
   ```
   But `ModelConfig` interface already defines `weight?: number` and `tags?: string[]`. The defaults are applied here. But in the `if` branch (update), it does:
   ```typescript
   state.config = { ...config };
   ```
   This doesn't apply defaults. So if you call `addModel({ id: 'x', endpoint: 'y', model: 'z' })` on an existing model, it will wipe out the previous `weight` and `tags` to `undefined`. This is inconsistent, but not a redundant condition.

 - In `selectModel`, the `eligible` filter:
   ```typescript
   if (st.disabledUntil && st.disabledUntil > now) return false;
   ```
   `st.disabledUntil` is typed as `number | null`. The check `st.disabledUntil` is truthy handles `null` and `0`. If `disabledUntil` is `0`, it's in the past (epoch), so it's effectively expired. `0` is falsy, so it would pass through and be considered not disabled. That's correct. If `disabledUntil` is some positive number > now, it's disabled. This is fine.

   ```typescript
   if (st.config.maxConcurrent && st.activeRequests >= st.config.maxConcurrent) return false;
   ```
   If `maxConcurrent` is 0, it's falsy, so it doesn't block. That's probably intentional (0 means unlimited? or not set?). But if `maxConcurrent` is explicitly 0, it might mean no capacity. However, `maxConcurrent?: number` suggests optional. So this is fine.

 - In `recordLatency` and `recordError`:
   ```typescript
   if (!state) return;
   ```
   These are guards. Not redundant.

 **6. Unreachable branches:**
 - The `default` case in `selectModel`:
   ```typescript
   default:
     throw new Error(`Unknown strategy: ${strat}`);
   ```
   Is this unreachable? `strat` is typed as `Strategy`, which is `'round-robin' | 'least-latency' | 'weighted' | 'random'`. If TypeScript is strict, and `strategy` parameter is typed as `Strategy`, then `strat` can only be one of those four values. However, at runtime, someone could pass an invalid string. But the function signature `selectModel(strategy?: Strategy)` means TypeScript would complain at compile time if someone passed an invalid literal. But at runtime, if called from JS or with a cast, it could happen. Is this unreachable? In pure TS usage, yes. But being conservative, I might not flag this because it's a runtime safety net. However, the prompt says "unreachable branches". In strict TS, the default case is indeed unreachable if the switch is exhaustive. But many coding standards keep the default throw as a defensive measure. Is it "safe to remove"? If we trust the type system, yes. But conservative means I should probably skip this, because runtime type violations are possible.

   Actually, wait. The `strat` is `strategy ?? this.currentStrategy`. `this.currentStrategy` is typed as `Strategy`. So `strat` is always `Strategy`. The switch is exhaustive over `Strategy`. So the default is unreachable at compile time. But is it safe to remove? If someone does `balancer.setStrategy('bad' as Strategy)`, it could hit default. But that's a deliberate bypass. I'll skip this to be conservative.

 - The fallback in `weighted` case:
   ```typescript
   // Fallback (should never happen)
   if (!selected) selected = eligible[0];
   ```
   As analyzed above, this is mathematically unreachable given the preceding logic and the fact that `eligible.length > 0`. This is high-confidence dead code. The comment even says "should never happen". I'll flag this.

 **7. Unused private members:**
 - `private healthProbeTimer: NodeJS.Timeout | null = null;` is used in `startHealthProbes`.
 - `private roundRobinIndex` is used.
 - `private models` is used.
 - `private currentStrategy` is used.

 **8. Imports:**
 - `import { EventEmitter } from 'events';` — Is `EventEmitter` used? Looking through the code... I don't see `EventEmitter` being used anywhere in the class. The class doesn't extend it, doesn't instantiate it. This is an unused import! High confidence. Safe to remove.

 **9. Commented-out blocks:**
 None visible.

 **10. Other observations:**
 - In `selectModel`, `round-robin` case: `selected = eligible[this.roundRobinIndex];` — if `this.roundRobinIndex` is 0 and eligible length is 1, fine. The check before handles out-of-bounds. But what if `eligible` is empty? We already returned null. So it's safe.

 - In `runHealthProbes`, the method is `private async`, but `startHealthProbes` calls it without awaiting:
   ```typescript
   this.healthProbeTimer = setInterval(() => this.runHealthProbes(), 30_000);
   ```
   The return value of `runHealthProbes` is ignored by `setInterval`, which is fine. But `runHealthProbes` is async. Not dead code.

 - The `EventEmitter` import is definitely unused. That's the strongest candidate.

 - The weighted fallback is the second strongest.

 - Duplicate latency average calculation is the third.

 Let me double-check if `EventEmitter` is used anywhere. The class definition is:
 `export default class ModelLoadBalancer {`
 It doesn't extend EventEmitter. No `new EventEmitter()`. No reference to `EventEmitter` in the file. Yes, unused import.

 Let me check if there are any other unused things.
 - `ModelConfig` properties: `id`, `endpoint`, `model`, `weight`, `maxConcurrent`, `tags`. All used.
 - `ModelStats`: all used in `getStats` return type and mapping.
 - `ModelState` interface: all properties used.

 Wait, in `addModel`, when updating:
 ```typescript
 state.config = { ...config };
 ```
 This spreads `config`. But `config` doesn't have defaults applied. However, the `ModelState` interface expects `config: ModelConfig`. So if `weight` or `tags` were previously defaulted and now become undefined, the state might have `undefined` values where it previously had defaults. But this is a bug, not dead code.

 Is there any unreachable code due to early returns?
 - `selectModel`: if eligible.length === 0, return null. Then switch. The switch always returns a selected model (or throws). Then after switch:
   ```typescript
   if (selected) {
     selected.activeRequests++;
   }
   return selected ? { ...selected.config } : null;
   ```
   Wait. `selected` is initialized to `null`. In every case of the switch (except default which throws), `selected` is assigned a non-null value. So `selected` is never null after the switch (assuming no throw). Therefore:
   ```typescript
   if (selected) {
     selected.activeRequests++;
   }
   ```
   The `if (selected)` check is redundant because `selected` is always truthy here. But is it safe to remove? Yes, because all paths through the switch assign a non-null `selected`, and the only exit before the switch is `if (eligible.length === 0) return null;`. The `default` case throws. So `selected` is guaranteed to be non-null. Therefore the `if (selected)` wrapper is redundant. However, it's defensive. If someone later adds a case and forgets to assign `selected`, the check helps. But strictly speaking, it's redundant. Is it "safe to remove"? Yes, high confidence. But is it "dead code"? It's a redundant condition. The prompt asks for "redundant conditions". This fits.

   Actually, looking at the `weighted` case, there's a fallback `if (!selected) selected = eligible[0];`. If I remove that fallback, `selected` is still always assigned. If I keep it, it's still always assigned. So yes, `selected` is always non-null after the switch.

   But wait, what if `eligible` is not empty, but in `weighted`, `rand` is NaN? No, `Math.random()` * `totalWeight`. If `totalWeight` is NaN? That would require a weight to be NaN, which is possible if someone passes `weight: NaN`. Then `rand` is NaN. `NaN <= 0` is false. So the loop wouldn't select anything. Then `selected` remains null. Then the fallback `eligible[0]` would catch it. If I remove the fallback, `selected` would be null. Then `if (selected)` would prevent incrementing activeRequests. Then `return selected ? ... : null` would return null.

   Is `weight: NaN` a realistic concern? Probably not. But to be conservative, maybe I shouldn't flag the `if (selected)` as redundant because of potential weird runtime values. However, the prompt asks to be conservative. I'll skip flagging the `if (selected)` because there is a theoretical path (NaN weights) where it's needed, and the fallback explicitly handles a "should never happen" case.

   Actually, the fallback is commented as "should never happen". If we trust that, then `selected` is always set. But the fallback itself is the safety net. If we remove the fallback, then `if (selected)` becomes needed in the NaN case. So I should either flag both or neither. Since the fallback is clearly dead code under normal operation, and the `if (selected)` is only redundant if we assume no NaN, I'll flag the fallback but not the `if (selected)`.

   Wait, there's another issue. In `weighted`, the loop:
   ```typescript
   for (const m of eligible) {
     rand -= m.config.weight ?? 1;
     if (rand <= 0) {
       selected = m;
       break;
     }
   }
   ```
   If `totalWeight` is calculated with `(m.config.weight ?? 1)`, and `rand` is `Math.random() * totalWeight`. If all weights are positive, `rand` is in `[0, totalWeight)`. The loop subtracts each weight. By the time we've iterated all, the total subtracted is `totalWeight`. Since `rand < totalWeight`, `rand - totalWeight < 0`, so by the end of the loop (or before), `rand <= 0` must be true. So `selected` must be assigned. The only edge case is if `eligible` is empty, but we already checked that. So yes, the fallback is unreachable. The `if (!selected)` is redundant.

   What if `totalWeight` is 0? That means all weights are 0 or null/undefined (treated as 1 by `??`). Wait, if all are null/undefined, `?? 1` makes them 1, so totalWeight > 0. If some are 0 and others are positive? If all are explicitly 0, then `totalWeight` is 0. `rand` is 0. Loop: subtract 0, `rand <= 0` is true immediately. First element selected. So still selected.

   What if `eligible` contains an element with `weight: -1`? Then `totalWeight` could be less than the sum of absolute values? No, `totalWeight` would be smaller. `rand` is in `[0, totalWeight)`. If `totalWeight` is negative? No, if some weights are negative, `totalWeight` could be negative (if sum < 0). Then `rand` is negative (since Math.random() >= 0). `rand <= 0` is true immediately. First element selected. So still selected.

   So mathematically, `selected` is always assigned. The fallback is dead code. I'll flag it.

   Is there any other unreachable branch?
   In `selectModel`, `round-robin`:
   ```typescript
   if (this.roundRobinIndex >= eligible.length) {
     this.roundRobinIndex = 0;
   }
   ```
   As discussed, this is needed for correctness, not unreachable.

 **Summary of
