<!-- cc-team deliverable
 group: G1 (concurrency division)
 member: CONC-011 role=concurrency model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":739,"completion_tokens":2219,"total_tokens":2958,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1639,"image_tokens":0},"cache_creation_input_tokens":0} | 27s
 generated: 2026-06-13T12:09:32.162Z -->
| Severity | Location | Race/Issue | Fix |
|----------|----------|-----------|------------|-----|
| High | `innomcp-node/src/services/eventBus.ts` | **Unawaited async handler promises** – `emit` calls handlers synchronously without awaiting returned promises. If a handler is `async` and throws after an `await`, the error becomes an unhandled promise rejection (caught only synchronous errors). | In `emit`, check if the return value of `handler(data)` is a `Promise`. If so, attach a `.catch()` to log/report the error (or wrap in `Promise.resolve().then()` to ensure async errors are captured). Alternatively, make `emit` `async` and `await` all handlers, but keep API synchronous by returning immediately; this requires careful design. Example fix: 
```typescript
handlers.forEach((handler) => {
  try {
    const result = handler(data);
    if (result instanceof Promise) {
      result.catch((err) => console.error(...));
    }
  } catch (error) { ... }
});
``` |
| Medium | `innomcp-node/src/services/eventBus.ts`, `emit` method | **Check-then-act / iteration modification** – `emit` iterates the live `Set` of handlers via `forEach`. If a handler calls `off()` (removing itself or another handler) or `on()` (adding a handler) during emission, the iteration may skip, repeat, or cause unexpected behavior. This is a classic shared-mutable-state race due to synchronous reentrancy. | Iterate over a snapshot of the handler set. Clone the set before looping: 
```typescript
const handlers = this.listeners.get(event);
if (!handlers) return;
[...handlers].forEach((handler) => { ... });
```
This prevents modifications during iteration from affecting the current emit cycle. | 
| Low | `innomcp-node/src/services/eventBus.ts` (design) | **Shared mutable state without locks** – The `listeners` map is a global mutable object. While JavaScript is single-threaded, any asynchronous code (e.g., in an `async` handler that does `await`) could cause interleaved modifications to the event bus between microtasks, leading to data races (e.g., two async handlers modifying the listener set concurrently). | Use a simple mutex or queue if concurrent modifications are expected. For most event-bus use cases in Node.js, this is not a practical issue if handlers are either synchronous or use the snapshot fix above. Document that handlers should not mutate the event bus during emission, or apply a reentrancy guard (e.g., `let emitting = false`; if `emitting`, defer mutations to a queue). |
