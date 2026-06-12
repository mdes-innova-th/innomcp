<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-3 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":68,"completion_tokens":2294,"total_tokens":2362,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2135,"image_tokens":0},"cache_creation_input_tokens":0} | 47s
 generated: 2026-06-12T03:48:59.968Z -->
import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let code = 500;

  if (err?.name === 'ValidationError' || err?.constructor?.name === 'ValidationError') {
    code = 400;
  } else if (err?.name === 'AuthError' || err?.constructor?.name === 'AuthError') {
    code = 401;
  }

  res.status(code).json({
    error: err?.message || 'Internal Server Error',
    code
  });
}
