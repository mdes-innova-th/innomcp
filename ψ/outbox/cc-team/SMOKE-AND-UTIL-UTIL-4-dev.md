<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: UTIL-4 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":55,"completion_tokens":1159,"total_tokens":1214,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1036,"image_tokens":0},"cache_creation_input_tokens":0} | 25s
 generated: 2026-06-13T05:28:22.753Z -->
import { createHash, randomBytes, randomUUID } from 'node:crypto';

export function md5(s: string): string {
  return createHash('md5').update(s).digest('hex');
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export function randomHex(n: number): string {
  return randomBytes(n).toString('hex');
}

export function uuid(): string {
  return randomUUID();
}
