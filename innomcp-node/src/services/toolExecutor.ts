```ts
// toolExecutor.ts
// Safe MCP tool execution wrapper for innomcp-node
// Part of INNOMCP Thailand government AI platform by MDES

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  elapsed: number; // ms
  toolName: string;
  timestamp: number; // Unix ms
}

interface ExecuteOptions {
  timeout?: number; // ms, default 30000
  retries?: number; // number of retry attempts, default 1 (total attempts = retries + 1)
  signal?: AbortSignal;
}

// Internal error types
class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

class AbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AbortError';
  }
}

/**
 * Safe MCP tool execution wrapper with timeout, retries, abort, and Thai error messages.
 * Implements singleton pattern for INNOMCP.
 */
class ToolExecutor {
  private registry = new Map<
    string,
    {
      handler: (args: Record<string, unknown>) => Promise<unknown>;
      description: string;
    }
  >();

  /**
   * Execute a single tool with safety net.
   */
  async execute(
    toolName: string,
    args: Record<string, unknown>,
    opts?: ExecuteOptions
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const timeout = opts?.timeout ?? 30000;
    const maxRetries = opts?.retries ?? 1;
    const signal = opts?.signal;

    if (signal?.aborted) {
      return this.createErrorResult(toolName, startTime, 'ABORTED', this.getThaiError('ABORTED'));
    }

    const handlerEntry = this.registry.get(toolName);
    if (!handlerEntry) {
      return this.createErrorResult(
        toolName,
        startTime,
        'TOOL_NOT_FOUND',
        this.getThaiError('TOOL_NOT_FOUND')
      );
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Check abort before each attempt
      if (signal?.aborted) {
        return this.createErrorResult(toolName, startTime, 'ABORTED', this.getThaiError('ABORTED'));
      }

      try {
        const result = await this.executeWithTimeout(
          handlerEntry.handler,
          args,
          timeout,
          signal
        );
        const elapsed = Date.now() - startTime;
        return {
          success: true,
          data: result,
          elapsed,
          toolName,
          timestamp: Date.now(),
        };
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Do not retry if the operation was explicitly aborted
        if (lastError instanceof AbortError) {
          return this.createErrorResult(
            toolName,
            startTime,
            'ABORTED',
            this.getThaiError('ABORTED')
          );
        }

        // If this was the last attempt, break out
        if (attempt === maxRetries) {
          break;
        }
      }
    }

    // All attempts exhausted – determine error code
    const errorCode = lastError instanceof TimeoutError ? 'TIMEOUT' : 'EXECUTION_ERROR';
    const elapsed = Date.now() - startTime;
    return this.createErrorResult(toolName, startTime, errorCode, this.getThaiError(errorCode));
  }

  /**
   * Batch execute multiple tools in parallel.
   * Each tool is executed independently; failures do not block others.
   */
  async executeAll(
    tools: Array<{ name: string; args: Record<string, unknown> }>
  ): Promise<ToolResult[]> {
    return Promise.all(tools.map((tool) => this.execute(tool.name, tool.args)));
  }

  /**
   * Check if a tool is registered and ready.
   */
  isAvailable(toolName: string): boolean {
    return this.registry.has(toolName);
  }

  /**
   * Retrieve metadata of a tool (name and Thai description).
   */
  getToolInfo(toolName: string): { name: string; description: string } | undefined {
    const entry = this.registry.get(toolName);
    if (!entry) return undefined;
    return {
      name: toolName,
      description: entry.description,
    };
  }

  /**
   * Register a custom tool.
   * The handler must accept a Record of arguments and return a Promise.
   * Description is automatically set to a generic Thai string.
   */
  register(name: string, handler: (args: Record<string, unknown>) => Promise<unknown>): void {
    this.registry.set(name, {
      handler,
      description: 'เครื่องมือที่ลงทะเบียนโดยผู้ใช้',
    });
  }

  /**
   * Optional: register a tool with a custom Thai description.
   */
  registerWithDescription(
    name: string,
    handler: (args: Record<string, unknown>) => Promise<unknown>,
    description: string
  ): void {
    this.registry.set(name, { handler, description });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Race the handler against a timeout and abort signal.
   */
  private async executeWithTimeout(
    handler: (args: Record<string, unknown>) => Promise<unknown>,
    args: Record<string, unknown>,
    timeout: number,
    signal?: AbortSignal
  ): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const onAbort = () => reject(new AbortError('Operation aborted'));

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }

      const handlerPromise = handler(args);
      const timeoutId = setTimeout(() => {
        reject(new TimeoutError(`Execution timed out after ${timeout}ms`));
      }, timeout);

      const cleanup = () => {
        clearTimeout(timeoutId);
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
      };

      handlerPromise
        .then((result) => {
          cleanup();
          resolve(result);
        })
        .catch((error) => {
          cleanup();
          reject(error);
        });
    });
  }

  /**
   *