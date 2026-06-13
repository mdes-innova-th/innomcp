<!-- cc-team deliverable
 group: G1 (Doc generation)
 member: D005 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1346,"completion_tokens":418,"total_tokens":1764,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-13T11:19:39.132Z -->
- **`QueueItem`** — Internal task descriptor. `execute` is the work to run; `priority` controls dequeue order (higher first); `addedAt` is set by the handler at enqueue time.

- **`BackpressureHandler` (class, exported via `backpressureHandler`)** — Bounded, priority-ordered concurrency limiter. Caps concurrent executions (`MAX_CONCURRENT`, default 10) and pending queue length (`MAX_QUEUE_SIZE`, default 100), rejecting excess tasks immediately.

  - **`enqueue(item)`** — Queues a task and returns a promise that settles with its result/error. Starts immediately if a concurrency slot is free, otherwise waits in descending-priority order (ties preserve insertion order). Rejects synchronously with `Error('Queue overflow: backpressure – too many pending requests')` if the queue is full; the `rejected` stat is incremented.

  - **`getStats()`** — Returns a snapshot of `{ running, queued, rejected, processed, avgWaitMs }`. `avgWaitMs` is 0 when nothing has been waited on (avoids division by zero).

  - **`drain()`** — Resolves when both the running count and the queue are empty. Resolves immediately if already idle. Caveat: only reflects state at the moment it's called — tasks enqueued *after* `drain()` resolves will not be awaited by that promise; a subsequent `drain()` call may be needed.

  - **`clear()`** — Rejects every queued (not yet started) task with `Error('Queue cleared by backpressure handler')` and empties the queue. Does **not** cancel in-flight tasks and does **not** alter `running`, `processed`, `rejected`, or wait-time statistics.

  - **`setMaxConcurrent(n)`** — Adjusts the concurrency ceiling at runtime. Throws `Error('MAX_CONCURRENT must be non-negative')` for `n < 0`. Increasing the limit triggers `processNext()`, so waiting tasks will start without further calls.
