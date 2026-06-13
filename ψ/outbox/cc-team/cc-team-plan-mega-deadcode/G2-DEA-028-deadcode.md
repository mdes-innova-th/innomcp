<!-- cc-team deliverable
 group: G2 (deadcode division)
 member: DEA-028 role=deadcode model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":887,"completion_tokens":5000,"total_tokens":5887,"prompt_tokens_details":{"cached_tokens":53,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 51s
 generated: 2026-06-13T12:04:57.393Z -->
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

 1. **Unused export/interface**: `SessionNotificationSubscription` is defined but never used anywhere in this file, and since it's not exported (wait, is it exported? No, it's not exported. But the user asked for unused exports. Let me check what is exported. Only `notificationService` is exported. `SessionNotificationSubscription` is not exported, but it's defined and unused. Is it safe to remove? If it's not exported and not used in this file, yes. But wait - could it be used by other files via some ambient module declaration? No, it's a regular interface in a module file. If it's not exported, other files can't import it. So it's dead code. But is it an "unused export"? No, it's not exported at all. But it's still unused code. The prompt says "unused exports, unreachable branches, redundant conditions, commented-out blocks, duplicate logic". It might be worth mentioning as unused interface, but since the prompt specifically asks for unused exports, and this isn't exported... Hmm. But the user also said "Dead/unused code audit". So unused declarations count. However, I should be conservative. Is it possible this interface is meant to be exported and used elsewhere? The file exports only the instance. If the interface is not exported, it's definitely dead code in this module. But maybe it's used for type checking elsewhere? No, unexported means inaccessible. I'll flag it but note it's unexported.

 Wait, actually, looking again: `interface SessionNotificationSubscription` - this is NOT exported. It's local to the module. And it's not referenced anywhere in the module. So it's dead code. But the prompt asks for "unused exports". This isn't an export. I'll mention it as unused declaration.

 2. **Redundant condition / Unreachable?**: In `subscribe`, the unsubscribe function checks `if (this.listeners.get(sessionId) === callback)`. This is not redundant; it prevents deleting a different callback if one was overwritten. But wait, `subscribe` uses `set`, which overwrites any existing listener for that sessionId. So if a session subscribes twice, the first callback is lost from the map. The first unsubscribe function would then compare, see it's not the same callback, and not delete. This is actually correct behavior to avoid deleting the second callback. So not redundant.

 3. **In `notify`**: `const callback = this.listeners.get(notification.sessionId!);` - uses non-null assertion. If `sessionId` is undefined, `get(undefined)` returns undefined, and `if (callback)` handles it. The `!` is a bit dangerous but not dead code.

 4. **In `getRecentNotifications`**: `.sort((a, b) => b.timestamp - a.timestamp)` - Since `addToHistory` pushes to the end of the array, and we only slice from the end in the overflow case, the history is roughly chronological. However, `notify` and `broadcast` can be called from anywhere, and timestamps are generated via `Date.now()`. If two notifications have out-of-order timestamps (e.g., system clock adjustments), sorting ensures order. But is it redundant? The array is built in insertion order, and timestamps are generated sequentially in the same process, so they should already be sorted by timestamp ascending. Sorting here is technically redundant if we trust the monotonicity of `Date.now()` and single-threaded execution. However, `Date.now()` is not strictly monotonic (system clock can skew). But in practice, for recent notifications, it's likely redundant. Is this high-confidence safe to remove? Not really, because it provides a correctness guarantee. I should probably not flag this as safe to remove because it affects behavior if timestamps are not perfectly ordered (e.g., broadcast vs notify race? No, JS is single-threaded. But Date.now() can go backwards if NTP adjusts). Actually, in Node.js, `Date.now()` can jump backwards. So sorting is defensive. I'll skip this.

 5. **Duplicate logic**: `notify` and `broadcast` both create a `fullNotification` and call `addToHistory`. The object creation is slightly different (broadcast sets `broadcast: true` and omits sessionId from the type, but actually `...notification` would not include sessionId since the type omits it, though runtime could have it? No, TypeScript would complain if you passed sessionId to broadcast, but at runtime the object is whatever is passed). The pattern is similar but not exactly duplicate logic that can be easily extracted without complicating types. Not high-confidence.

 6. **Unused `data` field**: In `Notification` interface, `data?: unknown` is defined. Is it used? Not in this file. But it's part of the public API shape. Other modules might use it when calling `notify` or `broadcast`. Since `Notification` is not exported (wait, is it? No, `interface Notification` is not exported!). Actually, looking at the code, `interface Notification` is NOT exported. Only `notificationService` is exported. So external code cannot reference the `Notification` type directly. However, they can pass objects to `notify` and `broadcast` that conform to the shape. The `data` field is optional. If no caller uses it, it's dead. But I don't know if callers use it. Since the interface is not exported, I can't know from this file alone. So I should not flag it.

 7. **Unused `error` and `system` in `NotificationType`**: These are literal types. Are they used? Not in this file. But callers of `notify` could pass them. Since `NotificationType` is not exported, callers can't easily use it, but they can pass string literals. The convenience methods don't use them. But they might be used by external callers via `notify({type: 'error', ...})`. I can't verify from this file alone. Not safe to flag.

 8. **Unused `broadcast` property in `Notification`**: It's set in `broadcast()` method, but never read in this file. `getRecentNotifications` doesn't filter by it. Is it used by consumers? The `Notification` interface isn't exported, but consumers receive notification objects via callbacks. They might check `broadcast`. I can't know. Not safe to flag.

 9. **Commented-out blocks**: None visible.

 10. **Unreachable branches**: None obvious.

 11. **Unused export**: Only `notificationService` is exported. Is it unused? I can't tell from this file alone. The audit is module-level, so I assume exports are used by other modules unless this is the entry point. I should not flag the export itself as unused.

 12. **Interface `SessionNotificationSubscription`**: This is really suspicious. It looks like a leftover from a previous design where the service returned a subscription object. It's defined but never used, not exported. High confidence dead code.

 13. **Type `NotificationType`**: Not exported, not used in type annotations beyond `Notification`. But `Notification` uses it. So it's used.

 14. **Interface `Notification`**: Not exported, but used extensively within the module. Not dead.

 15. **In `notify`**: `notification.sessionId!` non-null assertion. If `notification.sessionId` is undefined, `this.listeners.get(undefined)` returns undefined, and the `if (callback)` block is skipped. The notification is still added to history. Is this a bug? Maybe, but not dead code.

 16. **In `getRecentNotifications`**: The `limit` parameter defaults to 50. The function is not called anywhere in this file. But it's a public method on the exported singleton, so it's part of the public API. Not dead.

 17. **In `subscribe`**: The returned unsubscribe function captures `sessionId` and `callback`. As noted earlier, the identity check is actually necessary because `subscribe` overwrites. Wait, is it necessary? Let's trace:
 - Call subscribe(A, cb1). Map: {A: cb1}. Return unsub1.
 - Call subscribe(A, cb2). Map: {A: cb2}. Return unsub2.
 - Call unsub1(). `this.listeners.get(A) === cb1`? No, it's cb2. So it doesn't delete. Good.
 - Call unsub2(). `this.listeners.get(A) === cb2`? Yes. Deletes.
 So the check is necessary. Not redundant.

 18. **Potential duplicate logic in convenience methods**: `notifyTaskComplete`, `notifyMDESAlert`, `notifyAgentDone` all follow a pattern. But they are convenience methods with different semantics. Not duplicate logic in the "safe to remove" sense.

 19. **Unused `id` in `Notification`**: It's generated and added, but never used in this file. However, consumers likely use it as a React key or for deduplication. Not safe to remove.

 20. **MAX_HISTORY**: Used in `addToHistory`. Not dead.

 Let me reconsider `SessionNotificationSubscription`. It's definitely unused. Location: lines 14-17 (approx). What: unused interface. Why safe to remove: declared but never referenced in this module and not exported, so it cannot be consumed externally.

 Are there any other high-confidence items?

 What about the `sort` in `getRecentNotifications`? Let me think again. The history is maintained as a queue. `addToHistory` pushes to the end. Overflow slices from the end, preserving the most recent. So the array is always in chronological order (oldest first, newest last). `getRecentNotifications` filters by `sessionId`, which can pick items out of order if the history has interleaved session IDs. But the resulting filtered array still preserves the relative chronological order of the original array because `filter` preserves order. So the filtered array is sorted by timestamp ascending (oldest first). Then `.sort((a, b) => b.timestamp - a.timestamp)` reverses it to get newest first. Then `.slice(0, limit)` takes the first 50.

 Is the sort redundant? If the history array is strictly chronological (which it is, based on insertion order and the fact that `timestamp` is generated at insertion time in the same synchronous block), then the filtered array is already in chronological order. To get "most recent first", we could simply reverse the filtered array instead of sorting. But `sort` is O(n log n) while `reverse` is O(n). However, is the sort redundant in terms of correctness? Only if we can guarantee timestamps are monotonic with insertion order. Since `Date.now()` is called synchronously before `addToHistory`, and JS is single-threaded, yes, timestamps are monotonic with insertion order unless the system clock jumps backward between two calls. If the system clock jumps backward, the sort corrects the order. Is that a realistic concern? `Date.now()` can indeed jump. But in a single event loop, between two consecutive statements, it's extremely unlikely. However, `notify` and `broadcast` could be called from different async contexts. If context 1 starts, gets timestamp T1, then yields, context 2 starts, gets timestamp T2 > T1, then context 1 resumes and pushes to history. Wait, no: `Date.now()` and `addToHistory` are in the same synchronous block in both `notify` and `broadcast`. So for a single notification, the timestamp is generated and pushed atomically (relative to other JS code). But two different notifications from different async tasks: Task A calls notify, gets T1=1000, pushes to history. Task B calls notify, gets T2=1001, pushes. History is [T1, T2]. If clock jumps backward between tasks, T2 could be 999. Then history is [T1=1000, T2=999]. The insertion order is T1 then T2, but timestamps are 1000, 999. The sort would reorder them to T2, T1. Is this important? Probably not for most use cases, but removing the sort would change behavior in edge cases. So not safe to remove.

 What about the `broadcast` property in `Notification`? It's set in `broadcast()` but not in `notify()`. Wait, `notify()` takes `Omit<Notification, 'id' | 'timestamp'>`. The caller could pass `broadcast: true` in the notification object, and it would be spread into `fullNotification`. But the type omits it from the required fields, not necessarily from the passed object at runtime. Actually, TypeScript would allow it if the caller passes a Notification-like object. But in `broadcast`, it explicitly sets `broadcast: true`. In `notify`, it doesn't set it, so it would be `undefined` or whatever the caller passed (but the type signature doesn't include it, so callers shouldn't pass it). This is fine.

 Let me look for commented-out blocks. None.

 Let me look for unreachable branches. None.

 Let me look for unused exports again. Only `notificationService` is exported. So no unused exports.

 What about the `SessionNotificationSubscription` interface? It's not exported. But it's dead code. The user asked for "Dead/unused code audit: unused exports...". The interface is unused code. I should include it.

 Is there anything else?

 The `error` and `system` literals in `NotificationType` are not used by any convenience method, but the type is used by `Notification`. Since `Notification` is not exported, external callers can't easily use it, but they interact with the service. I can't be sure these types are unused externally. Not safe.

 What about `message?: string` in `Notification`? All convenience methods provide it. External callers might omit it. Not safe.

 What about `data?: unknown`? Not used in this file. But external callbacks might read it. Not safe.

 So the only high-confidence item is the unused `SessionNotificationSubscription` interface.

 Wait, let me double-check if `SessionNotificationSubscription` is perhaps meant to be the return type of `subscribe`? The `subscribe` method returns `() => void`. The interface has a `subscribe` method that returns `() => void`, and a `getRecentNotifications` method. It looks like an interface for a session-specific object, not for the service itself. It's completely orphaned.

 Is there any other subtle thing?

 In `notify`, `notification.sessionId!` uses a non-null assertion. If `sessionId` is missing, the notification goes to history but not to any listener. This might be intentional for broadcast-like notifications sent via `notify`, but `broadcast` is the method for that. However, the type allows `sessionId?: string`. So `notify` can be called without a sessionId. Is that an unreachable branch? No, it's a valid code path.

 Actually, looking at `getRecentNotifications`: it filters by `n.sessionId === sessionId`. If a notification was broadcast (no sessionId), it won't appear in any session's recent notifications. That might be intentional (broadcasts are global). But the method is public. Not dead code.

 What about `console.error` in `broadcast`? It's a side effect. Not dead.

 I think the only item is the unused interface.

 But wait, the user might consider `NotificationType`, `Notification`, and `SessionNotificationSubscription` as types that should be exported. If they are not exported, they are effectively private. But `Notification` is used internally. `NotificationType` is used by `Notification`. `SessionNotificationSubscription` is used by nothing.

 Let me reconsider the `sort`. Is it possible that `getRecentNotifications` is only called with `limit` and the array is always small enough that sort doesn't matter? No, that's not a reason to remove it.

 What about the `if (this.history.length > NotificationService.MAX_HISTORY)` block? It's used. Not dead.

 What about the `try/catch` in `broadcast`? Used. Not dead.

 Hmm. Is there duplicate logic between `notify` and `broadcast`?
 ```typescript
 const fullNotification: Notification = {
   ...notification,
   id: crypto.randomUUID(),
   timestamp: Date.now(),
   // broadcast: true, // only in broadcast
 };
 this.addToHistory(fullNotification);
 ```
 The object creation is almost identical. Could be extracted to a private method. But that's refactoring, not dead code removal. The prompt asks for "duplicate logic" as a category of dead/unused code. But is it safe to remove? If I extract it, I'm not removing it, I'm deduplicating. The prompt says "Output list | location | what | why-safe-to-remove". So for duplicate logic, I'd need to say "remove duplicate block from X and use shared helper". But is that conservative? The user might not want refactoring suggestions, only removal. And "why-safe-to-remove" would be tricky because you'd be removing code from one location and replacing it with a call. I'll skip this unless it's a clear case of exact duplication.

 Actually, there is no exact duplication because one sets `broadcast: true` and the other doesn't (and has different type spreads).

 Let me check if `crypto.randomUUID()` is available in the environment. The code uses it. Not dead.

 Okay, I'm fairly confident the only high-confidence dead code is the `SessionNotificationSubscription` interface.

 Wait, one more thing: the `subscribe` method returns an unsubscribe function. The `SessionNotificationSubscription` interface has a `subscribe` method. Could it be that `SessionNotificationSubscription` was intended to be returned by some method, but that method was removed? Yes, likely. It's orphaned.

 Let me also check if `Notification` or `NotificationType` should be exported. They are not. If other modules need to type their variables with `Notification`, they can't import it. But that's a design choice, not dead code. The instances are passed through callbacks.

 Actually, is `Notification` used as a type in any exported member's signature?
 - `subscribe(sessionId: string, callback: (n: Notification) => void): () => void;` - The callback parameter type uses `Notification`. Since the class is exported as an instance, and the method is public, the type `Notification` is part of the public API surface. TypeScript will infer/emit the type in `.d.ts` files even if not explicitly exported? Actually, if the class is not exported as a type (only the instance is exported as a value), TypeScript might still need the type. But since the class itself is not exported, and only the instance is, the type of the instance is available via `typeof notificationService`. The `Notification` interface would appear in the type declarations for the callback parameter. TypeScript will include it in the emitted `.d.ts` even if not explicitly exported, or it might inline it. But it's used.

 So, final decision: only flag `SessionNotificationSubscription`.

 But let me be extra careful. Is there any commented-out block I missed? No.

 Is there any unreachable branch?
 - `if (this.listeners.get(sessionId) === callback)` - reachable.
 - `if (callback)` - reachable.
 - `if (this.history.length > NotificationService.MAX_HISTORY)` - reachable.

 Is there any redundant condition?
 - In `notify`: `if (callback)` - if `sessionId` is undefined, `get(undefined)` is undefined, so false. If sessionId is defined but no listener, undefined, false. If listener exists, true. Not redundant.

 What about `notification.sessionId!`? The non-null assertion is not a condition, it's a type assertion. Not relevant.

 I think I should present just one item. But the user asked for a list. A list can have one item.

 Let me reconsider if there are any other "unused exports". The module exports only `notificationService`. Is it possible that `notificationService` is unused in the rest of the codebase? The user said "Module: innomcp-node/src/services/notificationService.ts". An audit of this module alone cannot determine if the export is unused globally. The prompt says "Cons
