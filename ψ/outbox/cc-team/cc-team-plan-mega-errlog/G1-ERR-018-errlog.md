<!-- cc-team deliverable
 group: G1 (errlog division)
 member: ERR-018 role=errlog model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":2052,"completion_tokens":5000,"total_tokens":7052,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 63s
 generated: 2026-06-13T12:03:05.167Z -->
The user wants an error-handling & logging audit of the provided TypeScript module `leaderboardMetrics.ts`. I need to output a table with columns: severity | location | issue | fix |.

Let me analyze the code for the specific issues mentioned:
1. Unhandled promise rejections
2. Swallowed errors (empty catch)
3. Missing error context
4. Inconsistent log levels
5. Secrets/PII in logs
6. Missing timeouts

Let me go through the code carefully.

**1. `persistLeaderboardStats` function:**
```typescript
function persistLeaderboardStats(operation: () => void | Promise<void>): void {
  if (process.env.NODE_ENV === "test") return;
  setImmediate(() => {
    Promise.resolve(operation()).catch(() => {
      // DB unavailable - in-memory stays authoritative
    });
  });
}
```
- Issue: Empty catch block swallowing errors. No logging at all. Missing error context (what failed?).
- Also: `setImmediate` doesn't have a timeout, but that's not exactly a "missing timeout" in the traditional sense. However, the DB operations inside could hang indefinitely because there's no timeout on the DB connection/query.
- Actually, looking at `withDbConnection` usage - if `withDbConnection` doesn't have internal timeouts, then DB operations could hang forever.

**2. `recordProviderCall` function:**
```typescript
  persistLeaderboardStats(() => {
    withDbConnection(async (conn) => {
      await conn.query(
        `INSERT INTO provider_stats (provider_id, requests, successes, total_latency)
         VALUES (?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE
           requests      = requests + 1,
           successes     = successes + VALUES(successes),
           total_latency = total_latency + VALUES(total_latency),
           last_seen     = NOW()`,
        [providerId, success ? 1 : 0, latencyMs]
      );
    }).catch(() => {
      // DB unavailable — in-memory stays authoritative
    });
  });
```
- Issue: Nested empty catch. The inner `withDbConnection(...).catch(() => {})` swallows errors silently.
- Issue: The outer `persistLeaderboardStats` also has a catch. So errors are swallowed at two levels.
- Issue: `providerId` is inserted into DB. If `providerId` contains sensitive info? Probably not PII but could be identifying. Not necessarily a secret/PII issue unless providerId is sensitive. I'll skip unless obvious.
- Issue: No timeout on DB operations. `withDbConnection` and `conn.query` don't specify query timeouts. If DB hangs, the connection/promise may never resolve, causing resource leaks and unhandled promises (though wrapped in setImmediate, the process might keep running).

**3. `recordProviderWin` function:**
The code is truncated but we can see:
```typescript
  persistLeaderboardStats(() => {
    withDbConnection(async (conn) => {
      await conn.query(
        `INSERT INTO provider_stats (provider_id, wins)
         VALUES (?, 1)
         ON DUPLICATE KEY UPDATE wins = wins + 1`,
        [pr
```
- Same issues as above: empty catch (implied by pattern), missing error context, missing timeouts.

**4. Missing error context:**
- All catch blocks are empty or have generic comments. No error object is logged, no stack trace, no providerId in the log context.

**5. Inconsistent log levels:**
- There are no logs at all in this file! So technically there are zero log levels, which is inconsistent with any logging strategy. But the prompt asks for "inconsistent log levels". Since there are no logs, maybe I should note "missing logs" or "no error logging". But the prompt specifically lists "inconsistent log levels" as something to check. If there are no logs, there are no levels to be inconsistent. However, the complete absence of logging for DB failures could be framed as "silent error swallowing" rather than inconsistent levels. I'll focus on the empty catches.

Wait, let me reconsider. The prompt says: "Error-handling & logging audit: unhandled promise rejections, swallowed errors (empty catch), missing error context, inconsistent log levels, secrets/PII in logs, missing timeouts."

So I need to find instances of these categories.

Let me map them:

**Unhandled promise rejections:**
- `persistLeaderboardStats` wraps in `Promise.resolve(operation()).catch(...)` so it handles rejection. But inside `recordProviderCall`, the `withDbConnection(...).catch(...)` handles it. However, if `withDbConnection` itself throws synchronously? Unlikely. But if `operation()` throws a synchronous error, `Promise.resolve()` catches it. So no unhandled rejections per se, but the pattern is risky.
- Actually, `setImmediate(() => { Promise.resolve(operation()).catch(...) })` - if `operation` is synchronous and throws, `Promise.resolve` will turn it into a rejection. So that's handled.
- But what if `withDbConnection` callback throws before returning a promise? The `.catch` on the outside of `withDbConnection` would catch it because `withDbConnection` likely returns a promise. So probably no unhandled promise rejections, but the risk is there if the pattern is broken.

**Swallowed errors (empty catch):**
- `persistLeaderboardStats`: `.catch(() => {})` - empty catch.
- `recordProviderCall`: `.catch(() => {})` after `withDbConnection` - empty catch.
- `recordProviderWin`: likely same pattern (truncated but implied).

**Missing error context:**
- All catch blocks discard the error argument. No logging of `error.message`, `error.stack`, or relevant context like `providerId`, `latencyMs`, etc.

**Inconsistent log levels:**
- There are no log statements at all in the file. This means errors are not logged. But "inconsistent log levels" usually means mixing `console.log`, `console.error`, `logger.info`, etc., or using wrong levels. Since there are none, maybe I should say "N/A" or note that the absence of any logging means there's no level consistency to audit, but the real issue is silent swallowing. However, to satisfy the prompt, I could note that the file uses no structured logging (but that's not exactly inconsistent levels). Let me think if there's any implicit logging... no.
- Actually, maybe I should flag: "No structured logging — errors swallowed silently instead of being logged at appropriate levels (error/warn)". This kind of fits.

**Secrets/PII in logs:**
- The SQL queries use parameterized values, but if logged, `providerId` could be sensitive depending on context. However, the code doesn't log anything, so no secrets are leaked in logs. But wait: if someone adds logging, `providerId` might be PII? Not really. The query parameters are `[providerId, success ? 1 : 0, latencyMs]`. `providerId` is not typically PII. I'll skip this unless I can argue that `providerId` could be considered identifying information in some contexts. But the prompt asks to audit for secrets/PII *in logs*. Since there are no logs, I can say "None found" or note that if logging is added, query parameters should be sanitized. But probably better to omit from table if not found, or explicitly state no issues found. The user wants the audit table. I'll include a row if I find something, otherwise focus on the actual issues.

**Missing timeouts:**
- `withDbConnection` and `conn.query` don't have timeouts. If the DB connection hangs, the promise never resolves. Node.js `setImmediate` doesn't help. The process could accumulate hanging DB operations.
- Specifically: `persistLeaderboardStats` uses fire-and-forget without any timeout on the DB operation. If `withDbConnection` pools are exhausted or DB is slow, this could pile up.
- Also, `computeP95` and `computeStdDev` are synchronous and operate on bounded arrays (100 and 50 samples), so no timeout issues there.

**Other issues I notice:**
- `recordProviderCall` has a potential division by zero? No, `requests` is at least 1 when `existing` is updated, and in `getProviderStats` it checks `raw.requests > 0`.
- `getProviderStats` computes `avgLatency` as `Math.round(raw.totalLatency / raw.requests)`. If `raw.requests` is 0 (possible for new provider created via `recordProviderWin` before any calls), this would be NaN? Wait, `recordProviderWin` creates an entry with `requests: 0`. Then `getProviderStats` checks `raw.requests > 0` for `successRate`, `winRate`, `efficiencyScore`, `healthScore`, but NOT for `avgLatency`. So if a provider has a win but no calls (possible if `recordProviderWin` is called before `recordProviderCall`), `avgLatency` would be `Math.round(0 / 0)` = `NaN`. This is a bug, but not in the requested audit categories. I'll stick to the requested categories.

Let me structure the table rows:

1. **High/Critical** - `persistLeaderboardStats` lines ~45-50 - Empty catch swallows all DB persistence errors silently; no logging or monitoring. Fix: Log error with context (providerId, operation) at `error` level; emit metric.
2. **High** - `recordProviderCall` lines ~85-90 - Nested empty catch on `withDbConnection` swallows DB errors without context; missing timeout on query. Fix: Add `.catch(err => logger.error({err, providerId}, 'DB persist failed'))`; add query timeout to `conn.query`.
3. **Medium** - `recordProviderCall` / `recordProviderWin` - Fire-and-forget DB operations lack timeouts; hanging queries can exhaust connection pool. Fix: Wrap `withDbConnection` or `conn.query` with a timeout (e.g., `Promise.race` with `setTimeout` or use DB driver timeout options).
4. **Medium** - `persistLeaderboardStats` / `recordProviderCall` - Missing error context in catch blocks; discarded error object prevents debugging. Fix: Capture `err` in catch and include `providerId`, `intent`, `latencyMs` in structured log.
5. **Low/Info** - Entire module - No logging infrastructure used; errors are silently swallowed rather than logged at appropriate levels (error/warn). Fix: Inject structured logger (e.g., pino/winston) and log DB failures at `error` level, operational events at `debug`/`info`.

Wait, the prompt asks specifically for: unhandled promise rejections, swallowed errors (empty catch), missing error context, inconsistent log levels, secrets/PII in logs, missing timeouts.

Let me make sure each row maps to one of these.

Row 1: Swallowed errors + missing error context. Location: `persistLeaderboardStats` catch block.
Row 2: Swallowed errors + missing error context + missing timeouts. Location: `recordProviderCall` inner catch + DB query.
Row 3: Missing timeouts. Location: `recordProviderWin` (and `recordProviderCall`) DB persistence.
Row 4: Inconsistent log levels / absent logging. Location: module-wide. Actually, "inconsistent" might not be the right word. Let's say "No error logging" — but the prompt says "inconsistent log levels". Hmm. Maybe I can say: "Silent error swallowing (no logs)" and frame it as "missing log levels". Or I can skip if not applicable. But the user listed it as a category to check. I should probably mention it. Maybe: "No structured logging — errors are swallowed silently instead of being logged at error/warn levels". Severity: Medium.
Row 5: Unhandled promise rejections? Is there any? Let's look again.
- `setImmediate(() => { Promise.resolve(operation()).catch(() => {}) });`
If `operation()` returns a promise that rejects, it's caught. If `operation` throws synchronously, `Promise.resolve` turns it into a rejection and catches it. So no unhandled rejection here.
- However, in `recordProviderCall`:
```typescript
  persistLeaderboardStats(() => {
    withDbConnection(async (conn) => {
      await conn.query(...)
    }).catch(() => {})
  });
```
`withDbConnection` returns a promise. The `.catch` handles it. But what if `withDbConnection` itself is not promise-returning or throws? Usually it returns a promise. So no unhandled rejection.
- But wait: the code is truncated at the end. The `recordProviderWin` function is cut off. Maybe there's an unhandled rejection there? No, the pattern looks the same.
- Actually, there is a subtle one: `persistLeaderboardStats` does not return the promise from `setImmediate`, so if `operation()` rejects after the `setImmediate` callback finishes, it's caught by the inner `.catch`. So no unhandled rejection.
- I think there are no true "unhandled promise rejections" because they intentionally catch everything. But the *risk* of unhandled rejections is present if the catch is removed or refactored. However, I should not invent issues. The empty catches actually *prevent* unhandled rejections, which is the problem (they swallow them). So I'll not list unhandled promise rejections as a separate issue unless I find one.

Wait, is there any place where a promise is floating?
`recordProviderCall` itself is synchronous (`export function recordProviderCall(...): void`). It doesn't await the persist. That's by design.

So maybe no row for unhandled promise rejections. But the prompt lists it as a category. I can state that the code uses empty catches to suppress unhandled rejections, which is an anti-pattern. Or I can say "N/A - all rejections are swallowed". But the user wants the audit table. I'll include a row noting that the empty catch blocks mask potential unhandled rejections, preventing proper crash detection.

Actually, let me reconsider the timeout issue. Is there a missing timeout on `setImmediate`? No, `setImmediate` is fine. The timeout should be on the DB operation. The `withDbConnection` utility might already have a timeout. But from the code, we can't see it. The audit is based on what we see. If `withDbConnection` doesn't accept a timeout option, that's an issue. I'll flag it as missing timeout on the persistence operation.

Let me also check for secrets/PII. The SQL parameters include `providerId`. Is `providerId` PII? Probably not inherently, but in some contexts it could identify a user (e.g., if provider is tied to a user). However, the code doesn't log it, so no leak. I'll add a note: "Potential PII in query parameters if providerId is user-correlated; not currently logged but risky if debug logging is added." But maybe that's overreaching. The prompt says "secrets/PII in logs". Since there are no logs, there are none. I'll skip this category or note "None identified" in a row? The user wants the table. I'll only include rows where issues exist.

Let me draft the table:

| severity | location | issue | fix |
|---|---|---|---|
| high | `persistLeaderboardStats` catch (line ~48) | Swallowed error: empty `.catch(() => {})` discards all DB persistence failures silently | Log at `error` level with structured logger; include stack trace and operation name |
| high | `recordProviderCall` inner catch (line ~87) | Swallowed error + missing context: nested empty catch on `withDbConnection` hides DB errors | Capture `err` object; log with `providerId`, `latencyMs`, `success` context; do not swallow |
| medium | `recordProviderCall` / `recordProviderWin` DB queries | Missing timeout: fire-and-forget DB queries via `withDbConnection` have no explicit timeout; can hang indefinitely | Add `Promise.race` with `setTimeout` or pass `{ timeout: ms }` to DB driver / `withDbConnection` |
| medium | `persistLeaderboardStats` / `recordProviderCall` | Missing error context: catch blocks discard error argument, preventing root-cause analysis | Include original `error` object and relevant identifiers (providerId, intent) in every log line |
| low | Module-wide (all catch blocks) | Inconsistent/absent log levels: errors are not logged at all (silent swallowing) instead of using `error`/`warn` levels | Adopt structured logger (e.g., Pino); log persistence failures at `error`, transient DB unavailability at `warn` |
| low | `recordProviderCall` SQL params | Potential secrets/PII exposure risk: `providerId` could be sensitive if user-linked; currently not logged but unsafe for future debug logs | Sanitize parameters in any debug/audit logs; avoid logging raw SQL bound values |

Wait, the "unhandled promise rejections" category. The empty catches actually *handle* the rejections by swallowing them. So technically there are no unhandled promise rejections. But the anti-pattern is that they prevent the process from crashing on unhandled rejections, which is bad. I think I can skip this or frame it differently. The prompt says "Error-handling & logging audit: unhandled promise rejections...". This is the *scope* of the audit. It doesn't mean I must find one of each. So it's okay if some categories have no findings.

Let me refine the rows to be precise and accurate.

Row 1:
- severity: high
- location: `persistLeaderboardStats`, line ~48 (the `.catch(() => {})`)
- issue: Swallowed error (empty catch) — all async DB persistence errors are silently discarded, masking DB outages or schema issues.
- fix: Replace empty catch with structured logging: `.catch(err => logger.error({ err, operation: 'persistLeaderboardStats' }, 'Leaderboard persistence failed'))`.

Row 2:
- severity: high
- location: `recordProviderCall`, inner `.catch(() => {})` after `withDbConnection` (line ~87)
- issue: Swallowed error + missing error context — nested empty catch hides `conn.query` failures and discards the error object and stack trace.
- fix: Capture and log the error with full context: `.catch(err => logger.error({ err, providerId, latencyMs, success }, 'Provider call DB persist failed'))`.

Row 3:
- severity: medium
- location: `recordProviderCall` and `recordProviderWin` `persistLeaderboardStats` callbacks
- issue: Missing timeout — fire-and-forget DB operations have no deadline; a hung query can leak DB connections or exhaust the pool.
- fix: Enforce a timeout on the DB operation (e.g., `Promise.race([dbPromise, rejectAfterMs(5000)])`) or configure driver-level `queryTimeout`.

Row 4:
- severity: medium
- location: `recordProviderWin` (truncated, lines after ~165) and `persistLeaderboardStats`
- issue: Missing error context — the error argument is omitted from all catch blocks, making it impossible to distinguish network errors from SQL syntax errors.
- fix: Always capture the `err` parameter in catch handlers and forward it to the logger with relevant tags (providerId, intent).

Row 5:
- severity: low / info
- location: Module-wide
- issue: Inconsistent log levels — the module contains no logging calls; failures are silently swallowed rather than emitted at `error`/`warn` levels.
- fix: Introduce a consistent structured logger; log unexpected DB failures at `error` level and transient unavailability at `warn`.

Row 6:
- severity: low
- location: `recordProviderCall` SQL parameters (line ~80)
- issue: Potential future PII/secrets exposure — `providerId` is passed as a query parameter; if debug logging is added, it could be written to logs.
- fix: Ensure any SQL debug/audit logging redacts or hashes bound identifiers; never log raw query parameters at `info` or higher levels.

Actually, I want to make sure about line numbers. The code doesn't have line numbers in the snippet, but I can reference function names and approximate locations.

Let me reconsider the "unhandled promise rejections" aspect. Is there any promise that could be unhandled?
- `setImmediate(() => { Promise.resolve(operation()).catch(() => {}) });`
The `setImmediate` callback returns undefined. The promise chain is internal. It's handled.
- In `recordProviderCall`, the `withDbConnection(...).catch(...)` is handled.
So no unhandled promise rejections. I will not include a row for it.

What about the `computeP95` and `computeStdDev`? They are fine.

One more thing: `recordProviderCall` and `recordProviderWin` use `persistLeaderboardStats` which is fire-and-forget. If the Node process exits before `setImmediate` runs, the DB write is lost. That's by design ("in-memory always authoritative"). Not an error-handling issue per se.

Let me check if there are any other swallowed errors. The `persistLeaderboardStats` catch is empty. The `recordProviderCall` catch is empty. The `recordProviderWin` catch is presumably empty (truncated). So that's three locations.

I should also check: in `recordProviderCall`, the `withDbConnection` is called with an async callback. If `conn.query` throws synchronously (unlikely with async/await but possible if `conn` is undefined), the async function turns it into a rejection, caught by `.catch`. So okay.

Let me finalize the table. I'll make it markdown.

| severity | location | issue | fix |
|---|---|---|---|
| high | `persistLeaderboardStats` `.catch` block | Swallowed error: empty catch silently discards all DB persistence failures, preventing detection of outages or schema errors. | Capture `err` and log with structured logger at `error` level; include operation name and stack trace. |
| high | `recordProviderCall` inner `.catch` (after `withDbConnection`) | Swallowed error & missing context: nested empty catch hides `conn.query` failures and drops the error object, providerId, and latency context. | Log the caught error with full context: `logger.error({ err, providerId, latencyMs, success }, 'DB persist failed')`. |
| medium | `recordProviderCall` / `recordProviderWin` DB callbacks | Missing timeout: fire-and-forget DB operations have no deadline; hung queries can exhaust the connection pool. | Add a timeout wrapper (e.g., `Promise.race` with 5s) or pass `queryTimeout` to the DB driver. |
| medium | All catch blocks module-wide | Missing error context: every catch handler discards the error argument (`() => {}`), making root-cause analysis impossible. | Always capture `(err)` in catch blocks and include it in log metadata. |
| low | Module-wide logging strategy | Inconsistent/absent log levels: errors are not logged at any level; silent swallowing replaces proper `error`/`warn` logging. | Adopt a structured logger (e.g., Pino); log DB failures at `error`, transient issues at `warn`. |
| low | `recordProviderCall` query parameters | Potential PII/secrets leak risk: `providerId` is a query parameter; future debug logging could write it to disk. | Sanitize bound parameters in any SQL debug/audit logs; avoid logging raw identifiers above `debug` level. |

This looks solid. It covers:
- Sw
