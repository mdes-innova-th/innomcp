# Phase 8.8 Log Hygiene Spec

## Objective

Implement strict redaction rules on logging logic without modifying routing or core feature logic.

## Scope Lock

- NO routing/logic changes.
- Logging only.
- Strict redaction rules must be enforced across all observability entry points.

## Redaction & Truncation Rules

- Eliminate raw API responses that could leak secrets (e.g., `process.env.*res.json`, `DETECT_DB_PASSWORD.*res.json`).
- Exclude authorization headers (`Authorization` and `Bearer` prefixes) from outgoing and incoming logs.
- Identify and strip specific URL query strings and payloads containing `ukey=` and `uid=`.
- Redact the entire `requestInfo.headers` payload to prevent leaking ambient cookies/tokens.
- Ensure test placeholders (e.g., `โหมดทดสอบ`, `เพื่อการทดสอบระบบ`) do not leak into production-level logging outputs.
