<!-- cc-team deliverable
 group: P3B (Phase 3.2 â€” WS reconnection banner in ChatPage)
 member: P3B-7 role=doc model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":44,"completion_tokens":733,"total_tokens":777,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":76,"image_tokens":0},"cache_creation_input_tokens":0} | 10s
 generated: 2026-06-12T03:42:25.177Z -->
# WebSocket Reconnect Architecture

This document outlines a resilient WebSocket reconnect pattern using three key components: `WSStatusBanner`, `useWSStatus`, and `ReconnectManager`. They work together to provide a robust user interface and automatic reconnection logic.

## ASCII Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        App Component                            │
│                                                                 │
│  ┌──────────────────────┐        ┌──────────────────────────┐   │
│  │    WSStatusBanner    │        │    useWSStatus() hook    │   │
│  │  (displays status)   │◄───────│  (manages UI state)     │   │
│  └──────────────────────┘        └───────────┬──────────────┘   │
│                                              │                  │
│                                              ▼                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   ReconnectManager                       │   │
│  │  (connection logic, exponential backoff, event emitter)  │   │
│  └────────────────────────��─────────────────────────────────┘   │
│                                              │                  │
│                                              ▼                  │
│                                        WebSocket Server        │
└─────────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### `ReconnectManager`
Core connection handler. Manages WebSocket lifecycle:
- Connects with configurable URL/options.
- On `close` (non‑clean) or `error`, schedules reconnect using exponential backoff (e.g., 1s, 2s, 4s, max 30s).
- Emits `status` events (`connected`, `connecting`, `disconnected`, `reconnecting`) and raw `message` events.
- Exposes methods: `connect()`, `disconnect()`, `send()`.

### `useWSStatus` (custom hook)
Consumes `ReconnectManager` events and maps them to React state:
- Returns `{ status, latestMessage, connectionAttempts }`.
- Automatically subscribes/unsubscribes on mount/unmount.
- Provides `reconnectNow()` to force immediate retry.

### `WSStatusBanner` (UI component)
Reads data from `useWSStatus`:
- Shows a dismissible banner when status is `disconnected` or `reconnecting`.
- Displays connection attempt count and live status indicator.
- Contains a "Retry Now" button that calls `reconnectNow()`.

## Composition Flow

1. App initializes `ReconnectManager` (singleton or context).
2. `WSStatusBanner` calls `useWSStatus()` to observe state changes.
3. On network failure, `ReconnectManager` starts backoff and emits `reconnecting`.
4. `useWSStatus` updates → `WSStatusBanner` renders the retry indicator.
5. User clicks "Retry Now" → `reconnectNow()` resets the backoff timer and attempts immediate connection.

This separation ensures UI concerns do not pollute connection logic, and the reconnect strategy remains testable and reusable.
