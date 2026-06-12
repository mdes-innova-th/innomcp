<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-4 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":57,"completion_tokens":706,"total_tokens":763,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":595,"image_tokens":0},"cache_creation_input_tokens":0} | 9s
 generated: 2026-06-12T03:48:27.422Z -->
import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (process.env.LOG_LEVEL === 'silent') {
    next();
    return;
  }

  const start = Date.now();

  res.on('finish', () => {
    const latencyMs = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${latencyMs}`);
  });

  next();
}
