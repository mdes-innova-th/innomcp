<!-- cc-team deliverable
 group: G1 (errlog division)
 member: ERR-003 role=errlog model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":875,"completion_tokens":5000,"total_tokens":5875,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 83s
 generated: 2026-06-13T11:59:23.808Z -->
The user wants an error-handling & logging audit of the provided TypeScript module `innomcp-node/src/services/answerContract.ts`.

 I need to analyze the code for:
 1. Unhandled promise rejections
 2. Swallowed errors (empty catch blocks)
 3. Missing error context
 4. Inconsistent log levels
 5. Secrets/PII in logs
 6. Missing timeouts

 Looking at the code:
 - It's a pure TypeScript module defining types and a pure function `buildAnswerContract`.
 - There are no async operations.
 - There are no try/catch blocks.
 - There are no logging statements (no console.log, no logger calls).
 - There are no network calls, database calls, or external I/O that would need timeouts.
 - There are no promise-based operations.

 However, I should still audit for potential issues:
 1. **Unhandled promise rejections**: None present, but if this code were used in an async context, errors thrown here (e.g., if params is null) could become unhandled if not caught by caller. But the code itself doesn't create promises.
 2. **Swallowed errors**: No catch blocks at all.
 3. **Missing error context**: No error handling/logging to add context.
 4. **Inconsistent log levels**: No logs exist.
 5. **Secrets/PII in logs**: No logs exist, but the `RetrievalSource` interface has `path` which could contain PII/secrets. If logged elsewhere, it's a risk. The `buildAnswerContract` function copies `sources` into the returned object, which includes `path`. If this contract is later logged, PII/secrets could leak.
 6. **Missing timeouts**: No async operations.

 Wait, I need to be careful. The audit is specifically about this file. Let me look closely:

 - `params.sources.map((s) => s.id)` - if `params.sources` is undefined, this throws. No validation.
 - `params.toolsUsed` - assumed to exist.
 - `params.route` - assumed to exist.
 - `Math.max(0, Math.min(1, params.confidence))` - if confidence is undefined, this becomes NaN (since Math.min(1, undefined) is NaN, Math.max(0, NaN) is NaN). This is a data integrity issue but not directly an error-handling/logging issue unless logged.

 Actually, looking at the prompt, they want a table with columns: severity | location | issue | fix.

 Since this file has no logging, no async code, no catch blocks, and no timeouts, the audit might come up mostly clean, but I should identify structural risks:

 1. **Missing input validation / silent data corruption**: `params.confidence` could be undefined leading to `NaN`. If this contract is passed to a logger later, `NaN` might be logged but more importantly, the function doesn't throw or log, it silently produces invalid state. However, the prompt specifically asks about: unhandled promise rejections, swallowed errors, missing error context, inconsistent log levels, secrets/PII in logs, missing timeouts.

 Let me reconsider if there are any implicit issues:
 - **Unhandled promise rejections**: Not applicable directly, but if callers use this in async chains and throw, they need to handle it. But that's not in this file.
 - **Swallowed errors**: None.
 - **Missing error context**: No errors are caught, so no context is added. But there are no errors being caught.
 - **Inconsistent log levels**: No logging.
 - **Secrets/PII in logs**: The `RetrievalSource.path` field could contain sensitive data. The `buildAnswerContract` function propagates `sources` (including `path`) and `memoryEntities` (could be PII) into the returned object. If the returned `AnswerContract` is logged downstream, this is a PII/secrets leak risk. This is a valid audit finding: "Potential PII/Secrets propagation - `path` and `memoryEntities` fields may contain sensitive data and are passed through without sanitization; if the contract is logged downstream, sensitive data may be exposed."
 - **Missing timeouts**: No async operations.

 Also, `new Date().toISOString()` relies on system clock. Not really a timeout issue.

 What about `params.sources.length` if `params.sources` is undefined? That would throw `TypeError: Cannot read properties of undefined (reading 'length')`. If this function is called from an async route handler without try/catch, it becomes an unhandled rejection or uncaught exception. But the issue is in the caller, not this file. However, I can note that the function lacks defensive validation, which could lead to runtime errors that, if called from async contexts, become unhandled rejections.

 Actually, the prompt is specifically asking to audit THIS module. I should be honest: most categories are N/A or clean, but I can identify risks that originate here and manifest elsewhere.

 Let me structure the findings:

 1. **Severity: Medium** | **Location: `buildAnswerContract` function, `params.confidence` normalization** | **Issue: Silent data corruption - `params.confidence` undefined yields `NaN` without error or log, leading to invalid contract state that may be logged/persisted downstream.** | **Fix: Validate `params.confidence` is a number; throw or log an error if invalid; default to 0 with explicit log if logger available.**
    - Wait, the file has no logger. Should I suggest adding one? The prompt asks for fixes. I can suggest adding validation and throwing a descriptive error.

 2. **Severity: High** | **Location: `RetrievalSource.path` and `AnswerContract` return object** | **Issue: Secrets/PII in logs (downstream risk) - `path` field in `RetrievalSource` and `memoryEntities` may contain file paths, URLs with tokens, or personal identifiers. The function passes these through unsanitized into the contract object, which is likely logged elsewhere.** | **Fix: Add a `sanitize()` helper to strip query parameters (credentials) from `path` and redact `memoryEntities` before returning; or mark contract fields with a `sensitive` flag for downstream loggers to respect.**
    - Actually, the issue is about logs. Since there are no logs IN this file, is this valid? The prompt says "secrets/PII in logs". If this module doesn't log, but exports data structures that are likely to be logged, it's a relevant audit finding for the module's design. I'll include it as a design-level finding.

 3. **Severity: Low/Medium** | **Location: `buildAnswerContract`, `params.sources` access** | **Issue: Missing defensive validation - `params.sources` and `params.toolsUsed` are accessed without null-checks; if called from an async handler without boundary try/catch, this generates unhandled exceptions/rejections in callers with no error context from this module.** | **Fix: Add runtime validation (e.g., `if (!params.sources) throw new Error('Missing sources')`) to fail fast with descriptive context.**

 4. **Severity: Info** | **Location: Module level** | **Issue: No logging instrumentation - the module contains zero log statements, making production debugging impossible (no error context, no log levels).** | **Fix: Inject a structured logger (e.g., `logger: Logger`) and add `logger.debug` for contract construction, `logger.warn` for degraded states, and `logger.error` for validation failures.**

 5. **Severity: N/A or Info** | **Location: N/A** | **Issue: Missing timeouts / Swallowed errors / Empty catch blocks** | **Fix: Not applicable - module is synchronous and contains no try/catch or async operations. Ensure callers wrap async boundaries with timeouts.**

 Wait, the user might expect me to find issues even if the file is simple. But I must be accurate. Let me reconsider if there are ANY swallowed errors or unhandled rejections I missed.

 The code:
 ```typescript
 const hotSources = params.sources.filter(...);
 const coldSources = params.sources.filter(...);
 ```
 If `params.sources` is undefined, this throws immediately. Not swallowed.

 There are no `.catch()` blocks.
 There are no `await` statements.
 There are no `setTimeout` or `fetch` calls.

 So for "swallowed errors (empty catch)" and "missing timeouts", I should explicitly state "None found" or mark as clean. But the user asked for a table. I can include rows saying "None" or just omit them? Usually, an audit table lists findings. If there are no findings in a category, I can note it in text, or include a row with severity "None" or "Clean". But the prompt says "Output table | severity | location | issue | fix |". It doesn't say I must find issues in every category. I should only list actual findings.

 However, to be thorough and helpful, I can include:
 - The PII/secrets propagation risk (because `path` could have secrets).
 - The missing validation leading to potential unhandled exceptions in callers (stretching the definition of "unhandled promise rejections" but related to error boundaries).
 - The silent NaN generation (not exactly swallowed error, but silent failure).
 - The complete absence of logging (missing error context).

 Let me refine the findings to be strictly about the categories mentioned:

 **Unhandled promise rejections**: The code itself doesn't create promises. But if `params` is malformed, the thrown `TypeError` or `RangeError` (none here) in an async caller becomes an unhandled rejection if the caller doesn't await/sync catch. I can phrase this as: "Missing input validation in sync function can surface as unhandled exceptions/rejections in async callers without contextual error messages."

 **Swallowed errors (empty catch)**: None found. I will not include a row for this unless I state "No issues found". But the table format suggests findings. I'll skip if none.

 **Missing error context**: The function throws generic JS errors if inputs are bad (e.g., `Cannot read properties of undefined`). It doesn't wrap with domain-specific context. This fits "missing error context".

 **Inconsistent log levels**: There are no logs. This is a finding: "Module lacks any logging instrumentation, preventing observability." But is that "inconsistent log levels"? Maybe more "missing log levels". I'll frame it as "No structured logging — inconsistent/missing log levels across the service boundary."

 **Secrets/PII in logs**: The `path` field. Even though this file doesn't log, it structures data that will be logged. I'll include it.

 **Missing timeouts**: No async operations. I can note "Not applicable" or skip. But to show I checked, maybe I include a row: "No async operations present; timeouts must be enforced by callers invoking I/O upstream." But that's not a finding in this file. I'll skip or mention in a note.

 Let's craft the table rows:

 Row 1:
 - severity: Medium
 - location: `buildAnswerContract` (confidence normalization line)
 - issue: Silent data corruption — `params.confidence` undefined or non-numeric yields `NaN` (no error thrown or logged), producing an invalid contract that may be serialized downstream.
 - fix: Validate `params.confidence` at entry; throw `TypeError` with context (e.g., `Invalid confidence: expected number, got ${typeof params.confidence}`) or clamp to `[0,1]` with explicit default and log warning if logger injected.

 Row 2:
 - severity: High
 - location: `RetrievalSource.path` / `AnswerContract.sources` return value
 - issue: Secrets/PII propagation risk — `path` may contain query strings with API keys or PII; `memoryEntities` may contain personal identifiers. Passed unsanitized into contract, likely to be logged by downstream consumers.
 - fix: Sanitize `path` (strip query params / auth tokens) before including in `sources`; consider redacting `memoryEntities` or adding a `[sensitive]` metadata flag so downstream loggers can mask them.

 Row 3:
 - severity: Medium
 - location: `buildAnswerContract` (sources array access)
 - issue: Missing error context / unhandled rejection risk — `params.sources` and `params.toolsUsed` are dereferenced without validation. If undefined, a generic JS `TypeError` is thrown without domain context; when called from async handlers this surfaces as an unhandled rejection/exception with no actionable trace.
 - fix: Add defensive validation at the top of the function: `if (!Array.isArray(params.sources)) throw new Error(`[AnswerContract] Invalid sources for route ${params.route}: expected array`);` to fail fast with rich context.

 Row 4:
 - severity: Low
 - location: Module-level / `buildAnswerContract`
 - issue: Missing logging instrumentation — zero log statements mean degraded states, validation failures, and contract construction events are invisible in production; no log levels to tune.
 - fix: Accept a structured `logger` parameter (or use a module-level logger); emit `logger.debug` on contract build, `logger.warn` when `degraded` is true, and `logger.error` on invalid inputs.

 Row 5:
 - severity: Info
 - location: `buildAnswerContract` (timestamp generation)
 - issue: Missing timeout / clock skew not accounted for — `new Date().toISOString()` relies on host system clock; no timeout or deadline enforcement for contract assembly (though sync, slow callers may hold event loop).
 - fix: This is less relevant. Maybe skip.

 Actually, I think 4 solid rows are enough. The user asked for an audit across those categories. I should make sure the rows map to the categories.

 Let me re-read the prompt carefully: "Error-handling & logging audit: unhandled promise rejections, swallowed errors (empty catch), missing error context, inconsistent log levels, secrets/PII in logs, missing timeouts. Output table | severity | location | issue | fix |."

 So the user wants me to check for those specific things. I will produce a table that covers the findings related to these categories.

 Refined rows:

 1. **Unhandled promise rejections / Missing error context**:
    - severity: Medium
    - location: `buildAnswerContract`, lines accessing `params.sources` and `params.toolsUsed`
    - issue: Unhandled rejection risk — missing input validation means malformed `params` (e.g., `sources` undefined) throws low-level `TypeError`s without domain context; when called from unguarded async boundaries these become unhandled rejections.
    - fix: Add explicit validation at function entry (e.g., `if (!params.route || !Array.isArray(params.sources)) throw new Error(`[AnswerContract] Invalid build params: route=${params.route}, sources=${typeof params.sources}`)`); ensure callers use `try/catch`.

 2. **Secrets/PII in logs**:
    - severity: High
    - location: `RetrievalSource.path` and `memoryEntities` fields (returned contract object)
    - issue: Potential secrets/PII in downstream logs — `path` can contain URLs with embedded tokens/query params; `memoryEntities` may hold personal data. The function propagates these raw values into the contract, which is typically logged or serialized by upstream services.
    - fix: Sanitize `path` by parsing and stripping query strings/auth tokens before embedding; redact or hash `memoryEntities`; add a `toLoggable()` helper on `AnswerContract` that returns a PII-safe view.

 3. **Missing error context / Inconsistent log levels**:
    - severity: Low
    - location: Module-level (`buildAnswerContract`)
    - issue: Missing error context & log levels — function contains zero log/telemetry instrumentation; failures (validation, NaN confidence, degraded state) produce no observable signal, making production debugging impossible.
    - fix: Inject a structured logger; log `logger.debug('Building answer contract', { route: params.route })` at start, `logger.warn('Degraded answer contract built', { reasons: params.degradedReasons })` if degraded, and `logger.error` on invalid inputs.

 4. **Swallowed errors**:
    - severity: Clean / None
    - location: N/A
    - issue: No empty catch blocks or swallowed errors detected in this module.
    - fix: N/A — maintain current practice; ensure any future async wrappers do not use empty catch blocks.

 5. **Missing timeouts**:
    - severity: Info
    - location: N/A
    - issue: No async operations or external I/O in this module; timeout concerns are not applicable here but must be handled by upstream async callers (e.g., route handlers).
    - fix: N/A for this file; ensure upstream services use `Promise.race` / `AbortController` with timeouts when awaiting operations that eventually call this builder.

 Wait, should I include "Clean" rows? The prompt says "audit". Usually, you list findings. But to prove I checked the categories, it's helpful to explicitly state "None found" for swallowed errors and timeouts. However, the table format with "fix" is weird for "None found". I can add a note below the table: "Categories with no findings: swallowed errors (empty catch), missing timeouts (module is synchronous)." This is cleaner.

 Let me double-check the `confidence` issue. `Math.max(0, Math.min(1, params.confidence))`. If `params.confidence` is `undefined`, `Math.min(1, undefined)` is `NaN`. `Math.max(0, NaN)` is `NaN`. This is indeed silent data corruption. It fits "missing error context" because it doesn't throw or log. I'll include it.

 Row for confidence:
 - severity: Medium
 - location: `buildAnswerContract`, `confidence: Math.max(...)` line
 - issue: Missing error context — invalid/undefined `confidence` silently becomes `NaN` instead of failing or logging, producing a corrupt contract that breaks downstream consumers.
 - fix: Validate `typeof params.confidence === 'number'` before normalization; throw `RangeError` or log error and default to `0` with explicit context.

 Let's finalize the table. I'll aim for 4-5 substantive rows and a note about clean categories.

 Actually, looking at the code again:
 ```typescript
 const hotSources = params.sources.filter((s) => s.type === "tool" || s.type === "api" || s.type === "database");
 const coldSources = params.sources.filter((s) => s.type === "document");
 ```
 If `params.sources` is undefined, it throws before the return. This is an unhandled exception in sync code. If this is used in an Express route or similar, it could crash the process or be caught by an error handler. It's not an "unhandled promise rejection" unless it's in an async function without await. But the prompt lumps "unhandled promise rejections" with general error handling audit. I'll phrase it carefully.

 Also, `sourceIds: params.sources.map((s) => s.id)` — same issue.

 Let's write the final response.

 Table:

 | severity | location | issue | fix |
 |---|---|---|---|
 | High | `RetrievalSource.path` / returned `AnswerContract` | Secrets/PII in logs (downstream) — `path` may contain credentials/query strings; `memoryEntities` may hold PII. Passed raw into contract and likely logged upstream. | Sanitize `path` (strip query params/tokens) before embedding; add `toLoggable()` method to return a redacted view for logging; mask `memoryEntities`. |
 | Medium | `buildAnswerContract` — `params.sources` / `params.toolsUsed` access | Unhandled rejection / exception risk — missing validation means `undefined` inputs throw generic `TypeError` without domain context; in async callers this surfaces as an unhandled rejection with no actionable trace. | Add defensive validation at function entry (e.g., `if (!Array.isArray(params.sources)) throw new Error(`[AnswerContract] sources required, got ${typeof params.sources}`)`); ensure callers wrap invocations in `try/catch`. |
 | Medium | `buildAnswerContract` — `confidence` normalization | Missing error context — `params.confidence` undefined/non-numeric silently becomes `NaN`, producing an invalid contract state. | Validate `typeof params.confidence === 'number'` before `Math.min/max`; throw `RangeError` with field context or default to `0` and emit a warning log. |
 | Low | Module-level (`buildAnswerContract`) | Inconsistent / missing log levels — module has zero instrumentation; degraded states, input anomalies, and contract assembly are invisible in production. | Inject a structured logger; use `logger.debug` for normal build, `logger.warn` for degraded contracts, `logger.error` for invalid inputs. |
 | Info | `buildAnswerContract` — `timestamp` | Missing timeout / clock skew — relies on unvalidated system clock (`new Date()`); no enforcement of build deadline. | Accept an optional `clock`/`deadline` parameter for testability; upstream async callers should enforce overall request timeouts. |

 Wait, the "Missing timeout" one is weak. I'll replace it with something better or just drop it and add the note. The prompt specifically asked for missing timeouts. Since there are no async operations, I should just state in a note that no timeouts are applicable. Or I can say: "N/A - synchronous module". But the user wants a table. I'll include the note after the table.

 Actually, I can frame the timestamp/deadline thing differently. No, it's too weak.

 Let's reconsider if there is ANY timeout issue. The function does `.filter` and `.map` on arrays. If `params.sources` is extremely large, this could block the event loop. But that's not a "timeout" in the traditional sense. I'll just add a note: "No async operations detected; timeout findings N/A."

 Let me refine the rows to be exactly 4 strong ones.

 Row 1: Secrets/PII
 Row 2: Unhandled rejection risk (validation)
 Row 3: Missing error context (NaN confidence)
 Row 4: Missing log levels / instrumentation

 And a note: "No empty catch blocks or swallowed errors found. No asynchronous calls requiring timeouts found."

 Is there anything else?
 `params.degradedReasons` is passed through. Could be long strings. Not really PII necessarily.

 What about `sourceIds: params.sources.map((s) => s.id)`? If `s.id` is missing, it maps to `undefined`. That's fine.

 What about `freshness` logic? It's fine.

 I think the 4 rows are solid.

 Let me check the exact wording for severity. I'll use: Critical, High, Medium, Low, Info.

 - PII/Secrets: High (or Critical?). If `path` contains an API key and gets logged, it's a Critical leak. I'll make it **High** or **Critical**. Let's say **High** because it's a propagation risk, not an active leak in this file.
 - Unhandled rejection risk: Medium.
 - NaN confidence: Medium.
 - Missing logs: Low.

 Let's write the markdown table.

 One more check: The user provided the file path: `innomcp-node/src/services/answerContract.ts`. I should reference locations relative to this, e.g., `buildAnswerContract (confidence normalization)` or line-approximate descriptions since I don't have line numbers. I'll use function + description.

 Final check on "fix" column: Should be actionable.

 1. **PII/Secrets**:
    - Fix: Implement a `sanitizeSource(source)` helper that redacts query parameters from `path` (e.g., replace `?api_key=...` with
