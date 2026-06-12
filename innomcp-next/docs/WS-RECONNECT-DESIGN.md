# WS-RECONNECT-DESIGN.md

## Overview
The WebSocket reconnection layer decouples connection state management from UI presentation. Three primitives—`ReconnectManager`, `useWSStatus`, and `WSStatusBanner`—collaborate to detect unexpected drops, orchestrate exponential-backoff retries, and surface status to users without leaking transport logic into presentational components.

## Components

**ReconnectManager** is a singleton transport wrapper that owns the raw WebSocket instance. It monitors `onclose` and `onerror` events, applies an exponential-backoff retry strategy with jitter, and attempts to re-establish the socket. It exposes a minimal event emitter interface so that state changes—connecting, open, closed, and waiting—can be observed by subscribers without importing React or DOM APIs.

**useWSStatus** is a React hook that subscribes to the `ReconnectManager` event emitter. It maintains local state for the current connection phase (`'connected' | 'reconnecting' | 'disconnected'`) and the number of seconds until the next retry attempt. By isolating subscription logic in a hook, any component can access live status declaratively without directly touching the WebSocket or managing its own listeners.

**WSStatusBanner** is a pure presentational component. It consumes the object returned by `useWSStatus` and conditionally renders a dismissible banner. It shows a "Reconnecting in Ns..." message during backoff, an error notice if the retry limit is exhausted, and a brief success indicator when the socket recovers, then auto-hides after a timeout.

## Composition
`ReconnectManager` lives at the application root and is instantiated once. Any view that needs awareness simply calls `useWSStatus()`, which registers a listener on mount and cleans up on unmount. `WSStatusBanner` is typically placed near the top of the layout tree and remains idle until the hook reports a non-connected state. This separation keeps the transport layer framework-agnostic while letting the UI react declaratively to connection health.

## Reconnect Flow


sequenceDiagram
    participant WS as WebSocket
    participant RM as ReconnectManager
    participant Hook as useWSStatus
    participant Banner as WSStatusBanner

    WS->>RM: onclose / onerror
    RM->>RM: Start exponential backoff
    RM->>Hook: emit status: reconnecting (delay: 5s)
    Hook->>Banner: setState({ status: 'reconnecting', delay: 5 })
    Banner->>Banner: Render "Reconnecting in 5s..."
    RM->>WS: Attempt new connection
    WS-->>RM: onopen
    RM->>Hook: emit status: connected
    Hook->>Banner: setState({ status: 'connected' })
    Banner->>Banner: Show "Connected" then auto-hide

