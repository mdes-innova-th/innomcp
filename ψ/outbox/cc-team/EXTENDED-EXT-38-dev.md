<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-38 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":81,"completion_tokens":1431,"total_tokens":1512,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1106,"image_tokens":0},"cache_creation_input_tokens":0} | 23s
 generated: 2026-06-13T05:27:02.971Z -->
import cors from 'cors';
import type { RequestHandler } from 'express';

/**
 * Configures CORS middleware for the innomcp backend.
 * Allowed origins are read from the ALLOWED_ORIGINS environment variable
 * as a comma-separated list. If not set, defaults to localhost:3000 and localhost:3001.
 * Origins missing a protocol are automatically prefixed with `http://`.
 */
export function configureCors(): RequestHandler {
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS ?? 'localhost:3000,localhost:3001';
  const allowedOrigins = allowedOriginsEnv
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(origin => {
      // If origin doesn't include a protocol, assume HTTP
      if (!/^https?:\/\//i.test(origin)) {
        return `http://${origin}`;
      }
      return origin;
    });

  return cors({
    origin: (origin, callback) => {
      // Allow requests that have no Origin header (e.g. server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200, // some legacy browsers choke on 204
  });
}
