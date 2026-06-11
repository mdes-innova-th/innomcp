```ts
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Custom error classes for specific failure types
// ---------------------------------------------------------------------------

/**
 * Thrown when a tool times out. The message is a Thai error string.
 */
export class ToolTimeoutError extends Error {
  constructor() {
    super('เครื่องมือหมดเวลา กรุณาลองใหม่อีกครั้ง');
    this.name = 'ToolTimeoutError';
  }
}

/**
 * Thrown when a tool detects invalid parameters. The message is a Thai error string.
 * Tool implementors should throw this to signal parameter problems.
 */
export class ToolParamError extends Error {
  constructor() {
    super('พารามิเตอร์ไม่ถูกต้อง');
    this.name = 'ToolParamError';
  }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Definition of a tool that can be executed by the executor. */
export interface ToolDefinition {
  /** Unique tool name (case-sensitive). */
  name: string;
  /** Human-readable description. */
  description: string;
  /** JSON Schema-like parameter definition (optional). */
  parameters: Record<string, unknown>;
  /** The asynchronous handler that implements the tool logic. */
  handler: (params: unknown) => Promise<unknown>;
  /** Default timeout in milliseconds for this tool (overrides global default). */
  timeout?: number;
}

/** Options for a single tool execution. */
export interface ExecOptions {
  /** Maximum time (ms) this particular execution may take (overrides tool & global default). */
  timeoutMs?: number;
  /** Number of retries allowed after the first failure (0-3, default 0). */
  retries?: number;
  /** Arbitrary context data attached to execution events (useful for logging). */
  context?: Record<string, unknown>;
}

/** The result of a tool execution attempt. */
export interface ToolResult {
  /** `true` if the tool completed successfully. */
  success: boolean;
  /** The value returned by the handler, if successful. */
  data?: unknown;
  /** A descriptive error message (Thai messages for known failures). */
  error?: string;
  /** Total wall-clock time of the execution (including all retries) in milliseconds. */
  durationMs: number;
  /** Number of retries that actually occurred (0 if first attempt succeeded). */
  retries: number;
}

/** Public view of a tool definition (handler is omitted for safety). */
export interface ToolDefinitionPublic {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000; // base for exponential back-off

// ---------------------------------------------------------------------------
// ToolExecutor (singleton)
// ---------------------------------------------------------------------------

/**
 * Safely executes tools with timeouts, retries, execution events, and
 * Thai error messages. The class is a singleton – always use `getInstance()`.
 */
export class ToolExecutor extends EventEmitter {
  private static instance: ToolExecutor;
  private tools = new Map<string, ToolDefinition>();

  // Private constructor to enforce singleton pattern.
  private constructor() {
    super();
    // Catch EventEmitter errors to avoid unhandled rejections.
    this.on('error', () => {});
  }

  /**
   * Returns the shared singleton instance of the executor.
   */
  static getInstance(): ToolExecutor {
    if (!ToolExecutor.instance) {
      ToolExecutor.instance = new ToolExecutor();
    }
    return ToolExecutor.instance;
  }

  // -----------------------------------------------------------------------
  // Public methods
  // -----------------------------------------------------------------------

  /**
   * Registers a new tool. If a tool with the same name already exists,
   * it is silently overwritten.
   */
  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, { ...tool });
  }

  /**
   * Removes a tool by name. Does nothing if the tool is not registered.
   */
  unregister(name: string): void {
    this.tools.delete(name);
  }

  /**
   * Checks whether a tool with the given name exists.
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Returns a list of all registered tools **without** their handler
   * to avoid leaking internal logic.
   */
  listTools(): ToolDefinitionPublic[] {
    const result: ToolDefinitionPublic[] = [];
    for (const [name, def] of this.tools) {
      result.push({
        name,
        description: def.description,
        parameters: def.parameters,
        timeout: def.timeout,
      });
    }
    return result;
  }

  /**
   * Executes a tool by name with the given parameters.
   *
   * @param name       - Name of the registered tool.
   * @param params     - Parameters to pass to the tool handler.
   * @param options    - Execution options (timeout, retries, context).
   * @returns A `ToolResult` indicating success or failure.
   */
  async execute(
    name: string,
    params: unknown,
    options?: ExecOptions,
  ): Promise<ToolResult> {
    // 1. Check existence
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: 'ไม่พบเครื่องมือที่ต้องการ',
        durationMs: 0,
        retries: 0,
      };
    }

    // 2. Determine execution parameters
    const effectiveTimeout =
      options?.timeoutMs ?? tool.timeout ?? DEFAULT_TIMEOUT_MS;
    const maxRetries = Math.min(options?.retries ?? 0, MAX_RETRIES);

    const startTime = Date.now();

    // 3. Retry loop with exponential back-off
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const attemptStart = Date.now();

      // Emit start event for this attempt
      this.emit('tool:start', {
        toolName: name,
        attempt,
        params,
        context: options?.context,
      });

      try {
        // Race the handler against a timeout
        const result = await this.raceWithTimeout(
          tool.handler(params),
          effectiveTimeout,
        );

        const attemptDuration = Date.now() - attemptStart;
        const totalDuration = Date.now() - startTime;

        // Emit end event
        this.emit('tool:end', {
          toolName: name,
          attempt,
          result,
          attemptDurationMs: attemptDuration,
          totalDurationMs: totalDuration,
        });

        return {
          success: true,
          data: result,
          durationMs: totalDuration,
          retries: attempt,
        };
      } catch (error: any) {
        const attemptDuration = Date.now() - attemptStart;

        // Translate error to appropriate Thai message
        let errorMessage: string;
        if (error instanceof ToolTimeoutError) {
          errorMessage = error.message;
        } else if (error instanceof ToolParamError) {
          errorMessage = error.message;
        } else {
          // Generic execution error
          errorMessage = 'เกิดข้อผิดพลาดในการเรียกใช้เครื่องมือ';
        }

        // Emit error event
        this.emit('tool:error', {
          toolName: name,
          attempt,
          error: errorMessage,
          attemptDurationMs: attemptDuration,
          originalError: error,
        });

        // If this was the last permitted attempt, return the failure
        if (attempt === maxRetries) {
          const totalDuration = Date.now() - startTime;
          return {
            success: false,
            error: errorMessage,
            durationMs: totalDuration,
            retries: attempt,
          };
        }

        // Exponential back-off before next retry (only if there's a next attempt)
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await this.delay(delay);
      }
    }

    // Unreachable in practice, but satisfies TypeScript
    const totalDuration = Date.now() - startTime;
    return {