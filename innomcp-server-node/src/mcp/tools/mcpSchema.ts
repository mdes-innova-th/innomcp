/**
 * MCP-compatible schema creator
 * Creates schema objects with typeName property that MCP SDK expects
 */

export interface McpSchemaProperty {
  type: string;
  description?: string;
  items?: McpSchemaProperty;
  properties?: Record<string, McpSchemaProperty>;
  optional?: boolean;
}

export interface McpSchema {
  typeName: string;
  type: string;
  properties?: Record<string, McpSchemaProperty>;
  required?: string[];
  _def?: {
    typeName: string;
  };
}

/**
 * Create an MCP-compatible object schema
 */
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

/**
 * Property builders for common types
 */
export const prop = {
  string: (description?: string, optional = false): McpSchemaProperty => ({
    type: "string",
    description,
    optional,
  }),
  
  number: (description?: string, optional = false): McpSchemaProperty => ({
    type: "number",
    description,
    optional,
  }),
  
  boolean: (description?: string, optional = false): McpSchemaProperty => ({
    type: "boolean",
    description,
    optional,
  }),
  
  array: (items: McpSchemaProperty, description?: string, optional = false): McpSchemaProperty => ({
    type: "array",
    items,
    description,
    optional,
  }),
  
  object: (properties: Record<string, McpSchemaProperty>, description?: string, optional = false): McpSchemaProperty => ({
    type: "object",
    properties,
    description,
    optional,
  }),
};
