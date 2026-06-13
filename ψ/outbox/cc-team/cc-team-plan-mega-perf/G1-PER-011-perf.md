<!-- cc-team deliverable
 group: G1 (perf division)
 member: PER-011 role=perf model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":733,"completion_tokens":1591,"total_tokens":2324,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1390,"image_tokens":0},"cache_creation_input_tokens":0} | 21s
 generated: 2026-06-13T12:00:35.410Z -->
| severity | location | issue | fix |
|----------|----------|-------|-----|
| Medium   | `innomcp-node/src/services/eventBus.ts` | **Memory retention/leaks**: Listeners added via `on()` or `once()` persist indefinitely unless explicitly removed. If callers forget to unsubscribe (e.g., in component lifecycles or long‑running processes), handler references prevent garbage collection, causing memory growth over time. The `once` wrapper also remains in the set if the event never fires. | • Return a cleanup function from `on()` (already done) and document its mandatory use. <br>• For `once`, consider removing the wrapper after a timeout or using `Set` with weak references (e.g., `WeakRef`) to allow GC when the handler is otherwise unreachable. <br>• Add a configurable max listener warning (like Node’s `EventEmitter.setMaxListeners`) to detect accidental leaks early. |
