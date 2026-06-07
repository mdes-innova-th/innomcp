# Phase 8.10B Spec: Router Resilience (DB Snapshot Fallback)

## Objective

Ensure the Keyword routing system (GodTier DB) does not crash or spam the remote server when the MariaDB container fails. Implement a deterministic fallback via in-memory snapshots while maintaining fast general responses.

## Core Mandates

1. **GodTier DB Fail -> Snapshot Fallback**
   - **MUST:** If the primary Keyword DB ping fails, the router must seamlessly degrade to an embedded `keywords.snapshot.json` to sustain operations.
   - **MUST:** Log a clean warning rather than throwing a catastrophic unhandled promise rejection.

2. **Metadata Transparency (`keywordSource`)**
   - **MUST:** Inject `__meta.keywordSource = "db" | "snapshot" | "defaults"` into the routed payload so observability layers are aware of the fallback state.

3. **Retry Limits & Spam Protection**
   - **MUST:** Limit database reconnection retries within the router logic. Implement a circuit breaker (e.g., attempt reconnect every 60 seconds, not on every user message).

4. **GeneralGate Performance**
   - **MUST:** Reconnection or fallback logic must be asynchronous or strictly timeout-bounded (e.g., 500ms max) to prevent blocking the `GeneralGate` evaluation for standard chatter.
