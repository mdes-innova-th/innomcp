<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-40 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":70,"completion_tokens":2770,"total_tokens":2840,"prompt_tokens_details":{"cached_tokens":7,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2774,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 22s
 generated: 2026-06-13T05:27:09.109Z -->
export function sanitizeString(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/\0/g, '')
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (isRecord(value)) {
    return sanitizeObject(value);
  }
  return value;
}

export function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[key] = sanitizeValue(obj[key]);
  }
  return result;
}
