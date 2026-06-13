<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-020 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1172,"completion_tokens":3755,"total_tokens":4927,"prompt_tokens_details":{"cached_tokens":1152,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3055,"image_tokens":0},"cache_creation_input_tokens":0} | 38s
 generated: 2026-06-13T12:00:09.114Z -->
FILE: innomcp-server-node/src/mcp/tools/mcpSchema.ts
<<<<<<< SEARCH
export function createObjectSchema(
  properties: Record<string, McpSchemaProperty>
): McpSchema {
  const required: string[] = [];
  
  // Extract required fields
  Object.entries(properties).forEach(([key, prop]) => {
    if (!prop.optional) {
      required.push(key);
    }
  });

  return {
    typeName: "ZodObject",
    type: "object",
    properties,
    required: required.length > 0 ? required : undefined,
    _def: {
      typeName: "ZodObject",
    },
  };
}
=======
export function createObjectSchema(
  properties: Record<string, McpSchemaProperty>
): McpSchema {
  if (typeof properties !== 'object' || properties === null) {
    throw new TypeError('properties must be an object');
  }

  const required: string[] = [];
  const cleanedProperties: Record<string, McpSchemaProperty> = {};

  // Deep-clean: recursively strip optional flag and clone to avoid mutation
  const stripOptional = (prop: McpSchemaProperty): McpSchemaProperty => {
    const { optional, items, properties: nestedProps, ...rest } = prop;
    const cleaned: McpSchemaProperty = { ...rest };
    if (items) {
      cleaned.items = stripOptional(items);
    }
    if (nestedProps) {
      cleaned.properties = {};
      for (const [key, p] of Object.entries(nestedProps)) {
        cleaned.properties[key] = stripOptional(p);
      }
    }
    return cleaned;
  };

  Object.entries(properties).forEach(([key, prop]) => {
    if (!prop.optional) {
      required.push(key);
    }
    cleanedProperties[key] = stripOptional(prop);
  });

  return {
    typeName: "ZodObject",
    type: "object",
    properties: cleanedProperties,
    required: required.length > 0 ? required : undefined,
    _def: {
      typeName: "ZodObject",
    },
  };
}
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/mcpSchema.ts
<<<<<<< SEARCH
  array: (items: McpSchemaProperty, description?: string, optional = false): McpSchemaProperty => ({
    type: "array",
    items,
    description,
    optional,
  }),
=======
  array: (items: McpSchemaProperty, optional = false, description?: string): McpSchemaProperty => ({
    type: "array",
    items,
    description,
    optional,
  }),
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/mcpSchema.ts
<<<<<<< SEARCH
  object: (properties: Record<string, McpSchemaProperty>, description?: string, optional = false): McpSchemaProperty => ({
    type: "object",
    properties,
    description,
    optional,
  }),
=======
  object: (properties: Record<string, McpSchemaProperty>, optional = false, description?: string): McpSchemaProperty => ({
    type: "object",
    properties,
    description,
    optional,
  }),
>>>>>>> REPLACE
