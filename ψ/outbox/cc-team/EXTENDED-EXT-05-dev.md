<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-05 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":49,"completion_tokens":1926,"total_tokens":1975,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1311,"image_tokens":0},"cache_creation_input_tokens":0} | 20s
 generated: 2026-06-13T05:25:39.022Z -->
TimeMiddleware function with export.

I'll also add a comment describing it.

Write:

import { Request, Response, NextFunction } from 'express';

export function responseTimeMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime();
  const originalEnd = res.end.bind(res);
  res.end = function (this: Response, ...args: any[]) {
    const diff = process.hrtime(start);
    const timeMs = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(2);
    res.setHeader('X-Response-Time', `${timeMs}ms`);
    return originalEnd(...args);
  };
  next();
}

But we're using arrow function for res.end? Actually we're using a regular function with bind. The overridden function uses originalEnd which is already bound, so we can call it directly. The this in the overridden function is not used, but we capture it via the bind on originalEnd. So it's fine.

Alternatively, we can avoid bind and do:

const originalEnd = res.end;
res.end = function(...args: any[]) {
  const diff = process.hrtime(start);
  const timeMs = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(2);
  res.setHeader('X-Response-Time', `${timeMs}ms`);
  return originalEnd.apply(res, args);
};

That is cleaner. I'll use apply.

So final:

export function responseTimeMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime();
  const originalEnd = res.end;
  res.end = function (this: Response, ...args: any[]) {
    const diff = process.hrtime(start);
    const timeMs = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(2);
    res.setHeader('X-Response-Time', `${timeMs}ms`);
    return originalEnd.apply(this, args);
  };
  next();
}

Works. I'll output that.

Make sure no extra text.TimeMiddleware.ts content only.TimeMiddleware.ts
import { Request, Response, NextFunction } from 'express';

export function responseTimeMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime();
  const originalEnd = res.end;
  res.end = function (this: Response, ...args: any[]) {
    const diff = process.hrtime(start);
    const timeMs = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(2);
    res.setHeader('X-Response-Time', `${timeMs}ms`);
    return originalEnd.apply(this, args);
  };
  next();
}
