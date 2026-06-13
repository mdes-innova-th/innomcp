<!-- cc-team deliverable
 group: G2 (concurrency division)
 member: CONC-039 role=concurrency model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":879,"completion_tokens":2923,"total_tokens":3802,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2126,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 46s
 generated: 2026-06-13T12:17:59.454Z -->
# Concurrency/Async-Safety Audit: `roomService.ts`

| severity | location | race/issue | fix |
|----------|----------|------------|-----|
| **High** | `joinRoom` / `leaveRoom` | **Unawaited promises** — `presenceService.join()` and `.leave()` may return Promises (likely async if backed by Redis/DB). Errors are silently swallowed; broadcast fires before presence state is consistent, so REST queries can return stale data. | Make `joinRoom`/`leaveRoom` `async`; `await presenceService.join/leave(…)`; surface errors to caller or log them. |
| **High** | `leaveRoom` | **Double-leave → presence undercount** — `room.delete(ws)` returns `boolean` (whether the element existed) but the return is ignored. If `leaveRoom` is called twice for the same socket (common on `"close"` + `"error"` events), `presenceService.leave()` fires twice, decrementing the presence count below zero. | Guard: `const wasPresent = room.delete(ws); if (!wasPresent) return;` — only call `presenceService.leave()` when the socket was actually removed. |
| **Medium** | `broadcastToRoom` | **`send()` errors not caught** — `ws.send()` queues synchronously; actual I/O errors emit as async `"error"` events on the socket. The `try/catch` only catches synchronous throws. Unhandled `"error"` events will **crash the process** (`Unhandled 'error' event`). | Use the callback form: `client.send(payload, err => { if (err) { /* log or schedule cleanup */ } })`, or attach a no-op `client.onerror` to every socket on join. |
| **Medium** | `joinRoom` / room Sets | **Dead-socket memory leak** — If a socket disconnects without `leaveRoom` being called (unclean close, missing event handler), the dead `WebSocket` object stays in the Set forever. `broadcastToRoom` skips non-`OPEN` sockets but never prunes them. | On `joinRoom`, register `ws.on("close", …)` and `ws.on("error", …)` handlers that call `leaveRoom`. Alternatively, add a periodic sweep that removes `readyState !== OPEN` sockets from each room. |
| **Medium** | `joinRoom` → `broadcastToRoom` | **Ordering assumption** — `presenceService.join()` is called, then `broadcastToRoom` fires `user_joined`. If `presenceService.join` is async, the broadcast arrives before the presence layer is updated. A client receiving `user_joined` and immediately querying the REST presence API may not see the new user. | `await presenceService.join()` before broadcasting. |
| **Low** | `getOrCreateRoom` | **Check-then-act** — `has()` then `set()` is a TOCTOU pattern. Currently safe because Node.js is single-threaded and both ops are synchronous, but a future refactor that makes `presenceService.join` async between the two calls would open a race where two concurrent `joinRoom` calls could both create a new Set (one overwriting the other). | Use `projectRooms.setdefault(projectId, new Set())` or refactor to `const room = projectRooms.get(projectId) ?? (projectRooms.set(projectId, new Set()), projectRooms.get(projectId)!);` to make the get-or-create atomic. |
| **Low** | `cleanupRoom` | **Check-then-act on room deletion** — Checks `room.size === 0` then `delete`s. If an async `joinRoom` is ever interleaved (after an `await`), the room could be deleted with new members. | Same fix as above: make `joinRoom`/`leaveRoom` async and ensure `cleanupRoom` runs synchronously after `room.delete` with no intervening `await`. |

---

### Key Takeaways

1. **The highest-risk bug is the double-leave / presence undercount.** WebSocket servers commonly emit both `"close"` and `"error"` for the same disconnect, and any retry/dedup logic in the caller can also call `leaveRoom` twice. The one-line guard (`if (!wasPresent) return`) eliminates this class of bug entirely.

2. **Unawaited `presenceService` calls are the second-highest risk.** Even if they happen to be synchronous today, the lack of `await` means the function signature can silently become async tomorrow, introducing both error-swallowing and ordering bugs. Making the functions `async` now is cheap insurance.

3. **The `send()` try/catch is a false sense of security.** It catches nothing in practice. The callback form or an `on("error")` handler is required to prevent unhandled-exception process crashes.
