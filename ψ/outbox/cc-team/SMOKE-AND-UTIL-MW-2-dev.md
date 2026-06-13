<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: MW-2 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":57,"completion_tokens":685,"total_tokens":742,"prompt_tokens_details":{"cached_tokens":4,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":623,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 6s
 generated: 2026-06-13T05:29:06.960Z -->
import { Request, Response, NextFunction } from 'express';

export const noCacheMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.method !== 'GET') {
    res.set('Cache-Control', 'no-store, no-cache');
    res.set('Pragma', 'no-cache');
  }
  next();
};
