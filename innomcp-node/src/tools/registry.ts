// innomcp-node/src/tools/registry.ts
// Standalone ToolRegistry: manages tool definitions and exports OpenAI-compatible function-calling specs.
// No external dependencies – intended to be wired later into the existing innomcp-node project.

import { Tool } from '../types/tool';

/**
 * Specifications for a tool as seen by the LLM.
 */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Registry for all available tools.
 */
export class ToolRegistry {
  private readonly tools: Map<string, Tool> = new Map();

  /**
   * Add a tool to the registry. Throws if a tool with the same name already exists.
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Retrieve a tool by name, or undefined if not found.
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Return all registered tools.
   */
  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Return the specifications of all registered tools.
   * Used by agentLoop.ts for tool discovery.
   */
  getToolSpecs(): ToolSpec[] {
    return this.list().map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema as Record<string, unknown>,
    }));
  }

  /**
   * Execute a tool by name with the given input.
   * Returns the result of the tool's run method.
   */
  async execute(name: string, input: unknown, context: any = {}): Promise<any> {
    const tool = this.get(name);
    if (!tool) {
      console.warn(`Tool ${name} not implemented yet`);
      return { ok: false, error: 'Tool not implemented' };
    }
    return await tool.run(input, context);
  }

  /**
   * Convert the registered tools into the array shape expected by OpenAI's function-calling API.
   * Each element follows the pattern: `{ type: "function", function: { name, description, parameters: inputSchema } }`.
   */
  toOpenAIToolSpecs(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    return this.getToolSpecs().map((spec) => ({
      type: 'function' as const,
      function: {
        name: spec.name,
        description: spec.description,
        parameters: spec.parameters,
      },
    }));
  }
}

/**
 * Factory function to create and return a ToolRegistry instance.
 * Maintains compatibility with existing system bootstraps.
 */
export function createRegistry(): ToolRegistry {
  return new ToolRegistry();
}
