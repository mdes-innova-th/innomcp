<!-- cc-team deliverable
 group: G2 (Doc generation)
 member: D030 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1987,"completion_tokens":653,"total_tokens":2640,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 16s
 generated: 2026-06-13T11:23:55.701Z -->
- **`WSEnhancer` (class)** — Enhances a `ws` `WebSocketServer` with client registration, room membership, heartbeat keep-alive, per-client offline message queuing, and broadcast helpers. Attach it to a server with `attachToServer`, then drive clients via `register`-/`join`-typed JSON messages.

- **`WSEnhancer#attachToServer(wss: WebSocketServer): void`** — Wires the enhancer to an existing `WebSocketServer` by listening for `"connection"` events and initializing heartbeat, system greeting, and message/pong/close handlers for each new socket.

- **`WSEnhancer#broadcast(message: unknown, except?: WebSocket): void`** — Sends `message` to every currently connected client (only sockets whose `clientId` has been registered and which are in the `OPEN` state), optionally excluding one socket. `message` is stringified via `JSON.stringify` unless already a string; pushes a timestamp for metrics when at least one send succeeds.

- **`WSEnhancer#sendToRoom(roomId: string, message: unknown): void`** — Sends `message` to every member of `roomId`. For room members whose `WebSocket` is not currently open, the message is buffered in `messageQueues` and will be flushed on the next successful re-registration of that `clientId`. No-op if the room is empty or unknown.

- **`WSEnhancer#joinRoom(ws: WebSocket, roomId: string): void`** — Adds the `clientId` associated with `ws` to `roomId` in both `clientRooms` and `roomClients` maps. Silently no-ops if the socket has not been registered yet (clients must send a `register` message first); called automatically on reconnect to re-join prior rooms.

Caveats / non-obvious behavior:
- Clients must identify themselves with a JSON message like `{ "type": "register", "clientId": "..." }` before `joinRoom` or targeted `sendToRoom` delivery to that client works; otherwise they are treated as anonymous and excluded from broadcasts/room delivery.
- Heartbeat terminates any socket that has not pong'd within 60s; pings are sent every 30s. The interval is cleared on `close`.
- On disconnect, the `clientId`'s room membership is preserved (in `clientRooms`) so a reconnecting socket with the same `clientId` is automatically re-added to its previous rooms and has its queued messages flushed. The dead `WebSocket` reference is removed from `roomClients` via `removeFromAllRooms`.
- Non-JSON inbound messages are silently dropped (caught and ignored in `handleClientMessage`).
- System messages are hard-coded Thai strings: `"กำลังเชื่อมต่อ..."` on connect and `"เชื่อมต่อสำเร็จ"` after successful registration.
- `messageTimestamps` is populated only on successful `broadcast`/`sendToRoom` sends and grows unboundedly — useful for a rolling-rate metric but not auto-pruned.
