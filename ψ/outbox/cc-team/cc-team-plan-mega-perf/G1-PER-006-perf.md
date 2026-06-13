<!-- cc-team deliverable
 group: G1 (perf division)
 member: PER-006 role=perf model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":1440,"completion_tokens":3235,"total_tokens":4675,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2922,"image_tokens":0},"cache_creation_input_tokens":0} | 51s
 generated: 2026-06-13T11:59:35.657Z -->
| severity | location | issue | fix |
|----------|----------|-------|-----|
| Medium | `drain()` method (line ~94) | Memory leak: `drainResolvers` array grows unbounded when `drain()` is called repeatedly while tasks are still pending (i.e., the queue never fully empties). Each call pushes a new resolver that is only removed when `checkDrain()` fires, so repeated `drain()` calls without a complete drain will accumulate promises indefinitely. | Replace the array with a single internal promise that is replaced on each `drain()` call, or use an event-emitter pattern with a limited number of listeners. For example, store a single `drainPromise` and its `resolve` function; if a new `drain()` is called while the queue is non‑empty, reject the old promise and create a new one. |
| Low | `insertSorted()` and `queue.shift()` | Inefficient O(n) operations due to use of Array `splice` (insertion) and `shift` (dequeue). Although `MAX_QUEUE_SIZE` is only 100, repeated enqueue/dequeue cycles cause unnecessary array reindexing overhead, which can become significant under high throughput. | Replace the array-based queue with a proper priority queue (e.g., a binary heap) for O(log n) insertion and O(1) removal, or use a linked list with a head pointer to avoid `shift` reindexing. |
