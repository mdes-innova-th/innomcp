import { z } from "zod";

/**
 * Wrapper function to make Zod schema compatible with MCP SDK 1.22.0
 * Adds typeName property that MCP SDK expects
 */
export function wrapSchema<T extends z.ZodType>(schema: T): any {
  const wrapped = schema as any;
  
  // Add typeName if it doesn't exist
  if (!wrapped.typeName && wrapped._def) {
    wrapped.typeName = wrapped._def.typeName || "ZodObject";
  }
  
  return wrapped;
}
