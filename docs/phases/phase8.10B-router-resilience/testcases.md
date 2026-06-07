# Phase 8.10B Test Cases (Verifier targets)

1. **Test: DB Fail triggers Snapshot**
   - _Action:_ Sever DB connection internally (or mock `query()` to throw). Query a known snapshot keyword.
   - _Expect:_ Query routes correctly, output contains `__meta.keywordSource: "snapshot"`.

2. **Test: Hard DB Down limits Retries**
   - _Action:_ Keep DB down and fire 10 queries rapidly.
   - _Expect:_ Router pings DB only once (or hits circuit breaker limits), using the snapshot for the rest without flooding `stdout` with Connection errors.

3. **Test: GeneralGate Unaffected**
   - _Action:_ Send a generic greeting while the DB is offline.
   - _Expect:_ `GeneralGate` bypasses tool routing within < 100ms. No DB connection hangs the response.

4. **Test: Recovery**
   - _Action:_ Restore DB mock to success state and wait for the circuit breaker reset window.
   - _Expect:_ Next query successfully uses the DB and emits `__meta.keywordSource: "db"`.
