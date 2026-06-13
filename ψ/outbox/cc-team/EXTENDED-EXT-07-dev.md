<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-07 role=dev model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":58,"completion_tokens":1814,"total_tokens":1872,"prompt_tokens_details":{"cached_tokens":6,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1535,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 26s
 generated: 2026-06-13T05:25:57.595Z -->
export function isString(val: unknown): val is string {
  return typeof val === 'string';
}

export function isNumber(val: unknown): val is number {
  return typeof val === 'number' && !isNaN(val);
}

export function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function isArray(val: unknown): val is unknown[] {
  return Array.isArray(val);
}

export function hasProperty<T extends string>(obj: unknown, key: T): obj is Record<T, unknown> {
  return isObject(obj) && key in obj;
}

export function isNonEmpty(val: unknown): val is string | unknown[] | Record<string, unknown> {
  if (isString(val)) return val.length > 0;
  if (isArray(val)) return val.length > 0;
  if (isObject(val)) return Object.keys(val).length > 0;
  return false;
}
