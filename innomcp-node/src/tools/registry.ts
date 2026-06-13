export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolRegistry {
  getToolSpecs(): ToolSpec[];
  execute(name: string, input: unknown): Promise<unknown>;
}

export function createRegistry(): ToolRegistry {
  return {
    getToolSpecs: () => [],
    execute: async (name, input) => {
      console.warn(`Tool ${name} not implemented yet`);
      return { error: 'Tool not implemented' };
    },
  };
}
