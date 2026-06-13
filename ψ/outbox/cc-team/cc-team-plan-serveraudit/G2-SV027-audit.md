<!-- cc-team deliverable
 group: G2 (Server-node module audit)
 member: SV027 role=audit model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":266,"completion_tokens":2134,"total_tokens":2400,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1774,"image_tokens":0},"cache_creation_input_tokens":0} | 29s
 generated: 2026-06-13T11:29:09.143Z -->
| severity | location | issue | proposed fix |
|----------|----------|-------|---------------|
| MEDIUM | `wrapSchema` line `const wrapped = schema as any;` | Mutates the input schema by adding `typeName` directly to the original object. If the schema is shared across multiple tools, this can cause unexpected side effects (e.g., MCP SDK behaviour changes for other tools). | Clone the schema before modification, or return a new wrapper object that exposes the desired `typeName` without altering the original. |
| MEDIUM | `wrapped.typeName = wrapped._def.typeName \|\| "ZodObject"` | Fallback to `"ZodObject"` is incorrect for non‑object schemas (e.g., `ZodString`, `ZodNumber`) when `_def.typeName` is unexpectedly missing. This can cause MCP SDK to treat the schema as an object, leading to runtime validation errors or misleading tool definitions. | Remove the hardcoded fallback; either throw an error for unknown types or derive the type from the schema’s own introspection (e.g., `z.ZodFirstPartySchemaTypes` or a mapping) instead of assuming object. |
| LOW | function body | No null/undefined guard on `schema`; passing a falsy value (e.g., by unsafe cast) would throw `TypeError` at the `!wrapped.typeName` check. | Add a guard: `if (!schema) return schema;` (or throw a controlled error) at the start. |

**Risk verdict:** Mutation of shared schemas combined with an incorrect hardcoded type fallback introduces subtle, hard-to-diagnose runtime failures in multi-tool setups.
