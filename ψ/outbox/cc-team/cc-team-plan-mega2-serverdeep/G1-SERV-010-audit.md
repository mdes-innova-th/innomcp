<!-- cc-team deliverable
 group: G1 (serverdeep division)
 member: SERV-010 role=audit model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":802,"completion_tokens":1350,"total_tokens":2152,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 31s
 generated: 2026-06-13T12:10:42.168Z -->
# Deep Bug Audit: `law.ts`

| Severity | Location | Issue | Fix |
|----------|----------|-------|-----|
| 🔴 **High** | `ThaiLawEntitySchema.sections` (line ~52) | `z.custom<LawSection>()` is a **zero-validation escape hatch** — Zod will accept *any* value (including `undefined` casts, wrong shapes, primitives). Combined with `.optional()`, this means malformed section data silently passes schema validation and propagates into MCP tool responses, violating the contract advertised by the TypeScript interface. | Define `LawSectionSchema = z.object({ no: z.string(), title: z.string().optional(), content: z.string(), keywords: z.array(z.string()).optional() })` and use `z.array(LawSectionSchema).optional()`. Add `.strict()` to reject unknown keys, or `.passthrough()` only if intentional. |
| 🟠 **Medium** | `ThaiLawEntitySchema.published_date` & `last_updated` (line ~56-58) | Date fields are typed as bare `z.string()` with no format check. A malformed `published_date` (e.g. `"not-a-date"`, `"2025-13-40"`) passes validation and later breaks downstream consumers (sorting, MCP `isError` envelopes, legal citation logic). | Use `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` or `z.string().datetime()` for `last_updated`. Add refinement: `.refine(d => !isNaN(Date.parse(d)), ...)`. |
| 🟠 **Medium** | `ThaiLawEntitySchema.id` (line ~47) | No length/format constraint. Empty string `""` or arbitrary user input accepted as canonical law ID, risking ID collisions and broken cache keys in the MCP resource layer. | Add `z.string().min(1).max(128)` and ideally `.regex(/^[a-z0-9_-]+$/i)` to enforce a stable ID namespace. |
| 🟠 **Medium** | `ThaiLawToolInputSchema` (line ~63) | **No `limit`/`max_length` on `query`**. A 10MB query string passes validation, causing memory pressure / DoS in the search handler (unhandled rejection risk in the async tool runtime). | Add `query: z.string().min(1).max(512)` and reject oversized inputs with a structured MCP error before hitting the search backend. |
| 🟡 **Low** | `LawDomain` export (line ~8) | Exported as a single-value `z.literal("LAW")` named `LawDomain` (looks like an enum, acts like a constant). Consumers expecting enum-like behavior will get surprising type errors; comment claims "will be used in main union" but no consumers exist yet. | Either make it a proper `z.enum([...])` placeholder for future domains, or rename to `LAW_DOMAIN_LITERAL` to make the intent unambiguous. |
| 🟡 **Low** | `ThaiLawToolInputSchema.type` (line ~65) | `default("search")` is applied *before* downstream validation; if a tool runner mutates parsed input, the default leaks. Also, no `.refine` to require `section_no` when `type === "section_lookup"` — invalid combinations silently pass. | Either freeze via `z.preprocess` or add a top-level `.refine()` cross-field rule: `if (type === 'section_lookup' && !section_no) throw ...`. |
| 🟡 **Low** | `LawType` & `LawStatus` enums (lines ~12-25) | TypeScript `enum` is a known source of runtime bloat and bundler quirks. More importantly, **no `as const` mirror** is used for Zod, creating a dual source of truth — drift between `LawType` and `z.nativeEnum(LawType)` is undetectable at compile time. | Replace with `as const` objects + derived types: `export const LawType = { ACT: 'ACT', ... } as const; type LawType = typeof LawType[keyof typeof LawType];` and use `z.enum(Object.values(LawType) as [LawType, ...LawType[]])`. Single source of truth. |
| 🔵 **Info** | `ThaiLawEntitySchema` (line ~46) | No `.strict()` / `.strip()` policy explicit. Zod default `.strip()` silently drops unknown keys, which can mask upstream MCP serialization bugs (e.g. duplicate `sections` key with typo'd name). | Add `.strict()` during development to surface contract violations; relax to `.strip()` in production. |
| 🔵 **Info** | `LawSection.content` (line ~31) | No upper bound. Thai legal text can be large (multi-KB sections) but a 50MB blob will exhaust MCP stdio buffers and trigger transport-level unhandled rejection on `JSON.stringify`. | Add `.max(64 * 1024)` (64KB) and split very long sections at the data layer, not the schema layer. |

## Cross-Cutting Concerns (MCP Protocol)

- **Error envelope correctness**: Because `z.custom<LawSection>()` is a passthrough, the tool's *output* won't trigger Zod's `safeParse` failure path — meaning malformed sections reach the client as "valid" results, bypassing MCP's `isError: true` envelope. The fix in row 1 directly addresses this.
- **Unhandled rejection risk**: Combined with the missing `query` length cap (row 4), a malicious caller can craft an input that passes schema validation here but explodes inside the async search handler — producing an unhandled promise rejection on the MCP server process.
- **Resource leak**: No `AbortSignal` threading through these schemas, but downstream tool handlers must propagate `ctx.signal` into the search call to avoid leaking in-flight fetches when the MCP client disconnects mid-query.

## Recommended Priority Order
1. Replace `z.custom<LawSection>()` with a real `LawSectionSchema` (High)
2. Add string bounds/format checks to `query`, `id`, date fields (Medium)
3. Cross-field refine for `section_lookup` ↔ `section_no` (Medium)
4. Migrate enums to `as const` pattern (Low, but high-leverage cleanup)
