# Phase 8.7: Weather Log Hygiene & Resolver Accurancy

## 1. Goal

Ensure predictable weather resolution for edge cases (Bangkok districts, abbreviations) and enforce strict, singular accounting for MCP request logging to avoid misleading metrics.

## 2. Resolver Normalization Rules

To prevent wasted network calls and inaccurate fallback handling, the province resolver must securely map variations to their canonical Thai forms before initiating the forecast pipeline:

- Abbreviation expansion: "กทม" -> "กรุงเทพมหานคร"
- Region/Prefix normalization: Safely stripping "จ.", "จังหวัด", "แขวง", "เขต" without corrupting the geographic name.
- Bangkok District inclusion: If a query contains only a sub-district or district known to be in Bangkok (e.g., "บางเขน", "ปทุมวัน"), it must map correctly to Bangkok data if no specific match exists, ensuring `resolvedProvinces` is never `[]` inappropriately for known domains.

## 3. Finalize-Once Logging Rule (Cancel Accounting)

Cancelled or finished MCP requests must reflect true lifecycle boundaries.

- **Problem Avoided:** Previously, logging bound to the socket `close` event resulted in keep-alive or proxy closures emitting a late "completed" log with heavily skewed durations (> 60s).
- **Enforcement:** The MCP server must log completion exclusively on `res.finish` (the true end of the HTTP response lifecycle). Early `res.close` events without a `finish` denote an immediate client disconnect/abort.
- **Idempotency Guard:** A strict guard must be in place to ensure a single request UUID never emits a duplicate "completed" or "failed" log line.
