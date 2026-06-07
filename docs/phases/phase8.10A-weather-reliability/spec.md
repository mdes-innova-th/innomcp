# Phase 8.10A Spec: Weather Reliability (Station Cache & Key-Safe Logs)

## Objective

Establish a robust caching mechanism for 3-hour station data and enforce strict log redaction to prevent secret leakage during upstream API communication.

## Core Mandates

1. **Key-safe logging**
   - **MUST:** Sanitize `uid` and `ukey` query parameters **only** when writing to standard out or evidence logs.
   - **MUST NOT:** Mutate or strip the actual URL dispatched via `fetch()`. The upstream request must contain the valid credentials.

2. **Station Cache Requirement**
   - **MUST:** Implement an LRU or TTL-based cache for TMD Station 3-Hour endpoints to reduce redundant external calls within a 15-minute window.
   - **MUST:** Emit explicit `[WeatherCache] HIT` or `[WeatherCache] SET` in the trace logs to prove cache utilization.

3. **Professional Fallback**
   - **MUST:** If a station query completely times out or exhausts retries, the system must degrade safely using the 2-block / 5-field standard UX format.
   - **MUST NOT:** Guess or hallucinate data. Render `ERR:WX_TIMEOUT` or `ERR:WX_UPSTREAM` cleanly within the accepted Thai layout.

4. **Evidence Rule (Zero Leakage)**
   - **MUST NOT:** Emit `uid=...`, `ukey=...`, `Authorization: Bearer ...`, or `requestInfo.headers` in raw Trace v3 or standard logs.
