import { EventEmitter } from 'events';

export class ToolTimeoutError extends Error {
  constructor() {
    super('เครื่องมือหมดเวลา กรุณาลองใหม่อีกครั้ง');
    this.name = 'ToolTimeoutError';
  }
}

export class ToolParamError extends Error {
  constructor() {
    super('พารามิเตอร์ไม่ถูกต้อง');
    this.name = 'ToolParamError';
  }
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: unknown) => Promise<unknown>;
  timeout?: number;
}

export interface ExecOptions {
  timeoutMs?: number;
  retries?: number;
  context?: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
  retries: number;
}

export interface ToolDefinitionPublic {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  timeout?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const NOT_FOUND_MESSAGE =
  'ไม่พบเครื่องมือที่ต้องการ';
const EXEC_ERROR_MESSAGE =
  'เกิดข้อผิดพลาดในการเรียกใช้เครื่องมือ';

export class ToolExecutor extends EventEmitter {
  private static instance: ToolExecutor;
  private readonly tools = new Map<string, ToolDefinition>();

  private constructor() {
    super();
    this.on('error', () => {});
  }

  static getInstance(): ToolExecutor {
    if (!ToolExecutor.instance) {
      ToolExecutor.instance = new ToolExecutor();
    }
    return ToolExecutor.instance;
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, { ...tool });
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  listTools(): ToolDefinitionPublic[] {
    return Array.from(this.tools, ([name, def]) => ({
      name,
      description: def.description,
      parameters: def.parameters,
      timeout: def.timeout,
    }));
  }

  async execute(
    name: string,
    params: unknown,
    options: ExecOptions = {},
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: NOT_FOUND_MESSAGE,
        durationMs: 0,
        retries: 0,
      };
    }

    const effectiveTimeout = options.timeoutMs ?? tool.timeout ?? DEFAULT_TIMEOUT_MS;
    const maxRetries = Math.min(Math.max(options.retries ?? 0, 0), MAX_RETRIES);
    const startTime = Date.now();

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const attemptStart = Date.now();
      this.emit('tool:start', {
        toolName: name,
        attempt,
        params,
        context: options.context,
      });

      try {
        const data = await this.raceWithTimeout(tool.handler(params), effectiveTimeout);
        const totalDuration = Date.now() - startTime;
        this.emit('tool:end', {
          toolName: name,
          attempt,
          result: data,
          attemptDurationMs: Date.now() - attemptStart,
          totalDurationMs: totalDuration,
        });

        return {
          success: true,
          data,
          durationMs: totalDuration,
          retries: attempt,
        };
      } catch (error) {
        const errorMessage = this.toErrorMessage(error);
        this.emit('tool:error', {
          toolName: name,
          attempt,
          error: errorMessage,
          attemptDurationMs: Date.now() - attemptStart,
          originalError: error,
        });

        if (attempt === maxRetries) {
          return {
            success: false,
            error: errorMessage,
            durationMs: Date.now() - startTime,
            retries: attempt,
          };
        }

        await this.delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }

    return {
      success: false,
      error: EXEC_ERROR_MESSAGE,
      durationMs: Date.now() - startTime,
      retries: maxRetries,
    };
  }

  private raceWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new ToolTimeoutError()), timeoutMs);
      promise
        .then((value) => {
          clearTimeout(timeout);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof ToolTimeoutError || error instanceof ToolParamError) {
      return error.message;
    }
    return EXEC_ERROR_MESSAGE;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default ToolExecutor;
