/**
 * Universal Tool interface for the Manus AI system.
 * Tools are defined by their specification and an asynchronous run method.
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: object;
  run(
    input: any,
    ctx: any,
  ): Promise<{
    ok: boolean;
    output?: any;
    error?: string;
    artifacts?: { name: string; mime: string; content: string }[];
  }>;
}
