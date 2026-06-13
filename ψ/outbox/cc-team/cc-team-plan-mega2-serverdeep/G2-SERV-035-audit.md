<!-- cc-team deliverable
 group: G2 (serverdeep division)
 member: SERV-035 role=audit model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":344,"completion_tokens":1738,"total_tokens":2082,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 37s
 generated: 2026-06-13T12:19:32.481Z -->
# Deep Bug Audit: `schemaWrapper.ts`

## Summary

This wrapper has **8 distinct issues** spanning type safety, mutability, protocol correctness, and silent failure modes. The most critical is that it mutates a shared schema object, causing cross-call contamination in MCP servers where the same schema is reused across tool registrations.

## Issue Table

| Severity | Location | Issue | Fix |
|---|---|---|---|
| 🔴 **CRITICAL** | `wrapped = schema as any` (line 9) | **Shared mutable state / cross-call contamination.** Schemas registered with MCP are typically module-level singletons. Mutating `schema.typeName` permanently mutates the shared object — re-registration, hot-reload, or duplicate `wrapSchema` calls operate on a corrupted singleton. Zod's frozen `_def` is bypassed, breaking Zod's internal invariants (e.g., `ZodObject` and `ZodString` have different parsing semantics but share `typeName: "ZodObject"` here). | Return a new object via `Object.create(Object.getPrototypeOf(schema))` or `structuredClone`-style shallow copy, or use a `Proxy` that forwards reads and only synthesizes `typeName` on access. Never mutate the input. |
| 🔴 **CRITICAL** | `wrapped._def.typeName \|\| "ZodObject"` (line 12) | **Silently lies about schema type.** Zod's internal `typeName` values include `"ZodString"`, `"ZodNumber"`, `"ZodArray"`, `"ZodEnum"`, etc. Coercing all of them to `"ZodObject"` makes MCP SDK 1.22.0 treat strings, enums, and arrays as objects. The SDK's JSON Schema converter (which dispatches on `typeName`) will emit malformed schemas to clients — e.g., a `ZodEnum` becomes `{"type": "object"}` with no `enum`, breaking LLM tool calls. | Read the actual `_def.typeName` and only fall back to a sentinel if `_def` is genuinely missing. If the SDK truly requires a single string, reject unknown types explicitly: `throw new Error(\`wrapSchema: unsupported Zod type ${def.typeName}\`)`. |
| 🟠 **HIGH** | Return type `any` (line 8) | **Type-safety hole.** Discards generic `T extends z.ZodType` — callers get no autocomplete, no errors on misuse, and downstream code can't infer input/output types. A tool author writing `wrapSchema(MyToolArgsSchema)` has no guarantee `MyToolArgs` is the parsed type. | Return a `Branded<McpCompatible<T>>` or at minimum `T & { typeName: string }`. Better: return `T as unknown as McpSchema<T>` so the consumer must opt into the MCP-narrowed type. |
| 🟠 **HIGH** | `if (!wrapped.typeName && wrapped._def)` (line 11) | **Non-atomic check is racy and order-dependent.** If `wrapped._def` is undefined (e.g., a stripped/transformed schema from a third-party lib), the `typeName` is never set and the function returns a schema with no `typeName` at all — silent failure. The MCP SDK will then throw an opaque "invalid schema" error far from the source. | Validate up-front and throw a descriptive error: `if (!wrapped._def) throw new Error("wrapSchema: schema is missing _def; cannot attach typeName")`. |
| 🟡 **MEDIUM** | Function signature (line 8) | **No defensive copy of `_def`.** Even if you fix the top-level mutation, `wrapped._def` is the same reference as the original. If MCP SDK ever mutates `_def` (it does in some versions during schema normalization), you contaminate the original. | Deep-clone the schema: `const wrapped = { ...schema, _def: { ...schema._def } }` or use `zod`'s `schema.parse` round-trip via `z.toJSONSchema` if available. |
| 🟡 **MEDIUM** | `wrapped.typeName = ...` (line 12) | **Property descriptor mismatch.** `typeName` is being added as an own enumerable property on the instance, but Zod defines it on the prototype chain via `_def`. The MCP SDK's `instanceof` checks (e.g., `schema instanceof ZodFirstPartyTypeKind`) will fail because the new own property shadows the prototype lookup differently across runtimes (V8 vs. JSC). | Set on `_def.typeName` only (the canonical location), or define via `Object.defineProperty(wrapped, 'typeName', { value, enumerable: false, configurable: true })` to match the prototype semantics. |
| 🟡 **MEDIUM** | `export function wrapSchema` (line 8) | **No idempotency guard.** Calling `wrapSchema(wrapSchema(s))` produces a wrapped schema where `_def` is now the *original* schema's `_def` (shared, good), but `typeName` overwrite is a no-op — *unless* the first call mutated `_def.typeName`, in which case the second call sees a now-truthy value and short-circuits, skipping whatever fix the second call was supposed to apply. Re-wrapping after Zod upgrades silently breaks. | Track wrapping with a `WeakSet` or a `Symbol` brand, and short-circuit *explicitly*: `if (wrapped[WRAPPED] === WRAP_VERSION) return wrapped;` |
| 🔵 **LOW** | Top of file | **No version pin / no detection of SDK upgrade.** Comment says "MCP SDK 1.22.0" but `package.json` may differ. The whole function exists *only* because of an SDK version bug — if 1.23.0 fixes it, this wrapper becomes dead code that lies about types. | Add a runtime guard: `if (McpSchemaVersion >= "1.23.0") return schema as any;` so the wrapper self-disables on the fix, and add a `// TODO(remove-when-sdk>=1.23)` for tech-debt tracking. |

## Recommended Rewrite (sketch)

```typescript
const WRAP = Symbol.for("innomcp.schemaWrapper.v1");

export function wrapSchema<T extends z.ZodType>(schema: T): T & { typeName: string } {
  // Idempotency
  if ((schema as any)[WRAP] === WRAP) return schema as any;

  const def = (schema as any)._def;
  if (!def) {
    throw new Error("wrapSchema: schema is missing _def; not a valid Zod schema");
  }
  const typeName = def.typeName as string | undefined;
  if (!typeName) {
    throw new Error(`wrapSchema: _def.typeName is empty for ${schema.constructor?.name}`);
  }

  // Non-mutating: clone with original prototype
  const wrapped = Object.create(Object.getPrototypeOf(schema)) as any;
  for (const k of Object.getOwnPropertyNames(schema)) {
    const d = Object.getOwnPropertyDescriptor(schema, k);
    if (d) Object.defineProperty(wrapped, k, d);
  }
  Object.defineProperty(wrapped, "typeName", {
    value: typeName, enumerable: false, configurable: true, writable: false,
  });
  Object.defineProperty(wrapped, WRAP, { value: WRAP });
  return wrapped as T & { typeName: string };
}
```

## Key Risks If Shipped As-Is

1. **Tool-call corruption in production** (issue #2): LLMs receive `{"type": "object"}` for enums/strings and emit invalid arguments.
2. **Flaky tests / hot-reload crashes** (issue #1): Re-registering a tool after a Zod version bump mutates a frozen `_def` in some Zod patch releases → `TypeError: Cannot redefine property`.
3. **Silent SDK compat loss** (issue #8): Bump MCP SDK → wrapper lies for one release cycle before anyone notices.
