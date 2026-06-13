<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-023 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":1859,"completion_tokens":5885,"total_tokens":7744,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5011,"image_tokens":0},"cache_creation_input_tokens":0} | 51s
 generated: 2026-06-13T11:45:53.950Z -->
FILE: innomcp-node/src/services/toolExecutor.ts
<<<<<<< SEARCH
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
=======
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: NOT_FOUND_MESSAGE,
        durationMs: 0,
        retries: 0,
      };
    }

    // Authorization check
    const context = options.context ?? {};
    const allowedTools = context.allowedTools as string[] | undefined;
    if (allowedTools !== undefined && !allowedTools.includes(name)) {
      return {
        success: false,
        error: 'ไม่ได้รับอนุญาตให้ใช้เครื่องมือนี้',
        durationMs: 0,
        retries: 0,
      };
    }

    const effectiveTimeout = options.timeoutMs ?? tool.timeout ?? DEFAULT_TIMEOUT_MS;
>>>>>>> REPLACE

FILE: innomcp-node/src/services/toolExecutor.ts
<<<<<<< SEARCH
      this.emit('tool:start', {
        toolName: name,
        attempt,
        params,
        context: options.context,
      });
=======
      this.emit('tool:start', {
        toolName: name,
        attempt,
        params: this.sanitizeForEvent(params),
        context: options.context,
      });
>>>>>>> REPLACE

FILE: innomcp-node/src/services/toolExecutor.ts
<<<<<<< SEARCH
        this.emit('tool:end', {
          toolName: name,
          attempt,
          result: data,
          attemptDurationMs: Date.now() - attemptStart,
          totalDurationMs: totalDuration,
        });
=======
        this.emit('tool:end', {
          toolName: name,
          attempt,
          result: this.sanitizeForEvent(data),
          attemptDurationMs: Date.now() - attemptStart,
          totalDurationMs: totalDuration,
        });
>>>>>>> REPLACE

FILE: innomcp-node/src/services/toolExecutor.ts
<<<<<<< SEARCH
        this.emit('tool:error', {
          toolName: name,
          attempt,
          error: errorMessage,
          attemptDurationMs: Date.now() - attemptStart,
          originalError: error,
        });
=======
        this.emit('tool:error', {
          toolName: name,
          attempt,
          error: errorMessage,
          attemptDurationMs: Date.now() - attemptStart,
        });
>>>>>>> REPLACE

FILE: innomcp-node/src/services/toolExecutor.ts
<<<<<<< SEARCH
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
=======
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private sanitizeForEvent(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeForEvent(item));
    }
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'apiKey', 'api_key', 'credential', 'privateKey', 'private_key'];
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }
}
>>>>>>> REPLACE
