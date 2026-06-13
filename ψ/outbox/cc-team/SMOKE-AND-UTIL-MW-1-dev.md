<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: MW-1 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":47,"completion_tokens":3214,"total_tokens":3261,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2981,"image_tokens":0},"cache_creation_input_tokens":0} | 60s
 generated: 2026-06-13T05:29:58.965Z -->
import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';

let apiVersion = '1.0.0';

try {
  const dir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  const pkgPath = path.resolve(dir, '../../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  apiVersion = pkg.version || apiVersion;
} catch (e) {
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    apiVersion = pkg.version || apiVersion;
  } catch (err) {
    // Fallback to default version if package.json cannot be read
  }
}

export const apiVersionMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-API-Version', apiVersion);
  next();
};
