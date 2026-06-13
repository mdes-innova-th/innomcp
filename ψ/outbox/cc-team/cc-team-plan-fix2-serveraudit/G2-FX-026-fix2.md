<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-026 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":769,"completion_tokens":3489,"total_tokens":4258,"prompt_tokens_details":{"cached_tokens":768,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3203,"image_tokens":0},"cache_creation_input_tokens":0} | 39s
 generated: 2026-06-13T12:03:50.045Z -->
FILE: innomcp-server-node/src/mcp/tools/schemaWrapper.ts
<<<<<<< SEARCH
export function wrapSchema<T extends z.ZodType>(schema: T): any {
  const wrapped = schema as any;
  
  // Add typeName if it doesn't exist
  if (!wrapped.typeName && wrapped._def) {
    wrapped.typeName = wrapped._def.typeName || "ZodObject";
  }
  
  return wrapped;
}
=======
export function wrapSchema<T extends z.ZodType>(schema: T): any {
  // Guard against falsy schema
  if (!schema) {
    return schema;
  }

  const typeName = schema._def?.typeName;
  if (!typeName) {
    throw new Error(
      `wrapSchema: unable to determine Zod type for schema; schema._def.typeName is missing`
    );
  }

  // Return a Proxy that exposes typeName without mutating the original schema
  return new Proxy(schema, {
    get(target, prop, receiver) {
      if (prop === 'typeName') {
        return typeName;
      }
      return Reflect.get(target, prop, receiver);
    },
    has(target, prop) {
      if (prop === 'typeName') return true;
      return Reflect.has(target, prop);
    }
  });
}
>>>>>>> REPLACE
