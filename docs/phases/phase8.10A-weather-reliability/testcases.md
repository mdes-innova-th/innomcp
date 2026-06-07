# Phase 8.10A Test Cases (Verifier targets)

1. **Test: Key-safe Log Masking**
   - _Action:_ Trigger a weather fetch requiring TMD keys.
   - _Expect:_ Fetch succeeds (200 OK), but the log reads `GET https://data.tmd.go.th/...&uid=***&ukey=***`.

2. **Test: Station Cache HIT validation**
   - _Action:_ Query `หลักสี่ วันนี้` twice consecutively within 5 seconds.
   - _Expect:_ Call 1 emits `[WeatherCache] SET`. Call 2 emits `[WeatherCache] HIT` and HTTP calls = 0.

3. **Test: Timeout Professional Fallback**
   - _Action:_ Mock TMD endpoint to hang for 8000ms.
   - _Expect:_ Engine gracefully aborts and outputs UX with `ERR:WX_TIMEOUT` instead of crashing the pipeline.

4. **Test: Evidence Log Hygiene Check**
   - _Action:_ Run full suite with `CHAT_TRACE_QA=1`.
   - _Expect:_ Regex sweep of the resulting `evidence/*.log` finds 0 occurrences of `uid=[\w\d]+` or `requestInfo.headers`.
