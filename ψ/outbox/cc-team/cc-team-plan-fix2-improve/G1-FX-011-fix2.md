<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-011 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2103,"completion_tokens":6435,"total_tokens":8538,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5997,"image_tokens":0},"cache_creation_input_tokens":0} | 66s
 generated: 2026-06-13T11:34:52.977Z -->
FILE: innomcp-node/src/services/toolExecutor.ts
<<<<<<< SEARCH
      this.emit('tool:start', {
        toolName: name,
        attempt,
        params,
        context: options.context,
      });
=======
      try {
        this.emit('tool:start', {
          toolName: name,
          attempt,
          params,
          context: options.context,
        });
      } catch {
        // Ignore listener errors
      }
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
        try {
          this.emit('tool:end', {
            toolName: name,
            attempt,
            result: data,
            attemptDurationMs: Date.now() - attemptStart,
            totalDurationMs: totalDuration,
          });
        } catch {
          // Ignore listener errors
        }
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
        try {
          this.emit('tool:error', {
            toolName: name,
            attempt,
            error: errorMessage,
            attemptDurationMs: Date.now() - attemptStart,
            originalError: error,
          });
        } catch {
          // Ignore listener errors
        }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/toolExecutor.ts
<<<<<<< SEARCH
export class ToolParamError extends Error {
  constructor() {
    super('พารามิเตอร์ไม่ถูกต้อง');
    this.name = 'ToolParamError';
  }
}

=======
>>>>>>> REPLACE
