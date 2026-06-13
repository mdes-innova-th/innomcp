<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-45 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: length | tokens: {"prompt_tokens":64,"completion_tokens":3000,"total_tokens":3064,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1980,"image_tokens":0},"cache_creation_input_tokens":0} | 44s
 generated: 2026-06-13T05:28:59.066Z -->
/**
 * Utility functions for object manipulation.
 * Includes pick, omit, deepClone, merge, and isEqual.
 */

/** Internal helper to check if a value is a plain object */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Creates an object composed of the picked `keys` from the source object.
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Creates an object excluding the specified `keys` from the source object.
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = {} as Omit<T, K>;
  const keysSet = new Set<keyof T>(keys);
  for (const key in obj) {
    if (!keysSet.has(key)) {
      // Safe assignment: result is typed as Omit, but we know the key is not excluded.
      (result as Record<string, unknown>)[key] = obj[key];
    }
  }
  return result;
}

/**
 * Performs a deep clone of any JSON-compatible value.
 * Handles primitive values, arrays, plain objects, Date, RegExp, Map, and Set.
 */
export function deepClone<T>(obj: T): T {
  // Primitives and functions (functions are returned as-is)
  if (obj === null || typeof obj !== 'object') return obj;

  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags) as unknown as T;

  if (obj instanceof Map) {
    const copy = new Map();
    obj.forEach((value, key) => copy.set(deepClone(key), deepClone(value)));
    return copy as unknown as T;
  }

  if (obj instanceof Set) {
    const copy = new Set();
    obj.forEach((value) => copy.add(deepClone(value)));
    return copy as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  // Plain objects
  if (isPlainObject(obj)) {
    const clone: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      clone[key] = deepClone((obj as Record<string, unknown>)[key]);
    }
    return clone as unknown as T;
  }

  // Fallback for other exotic objects (e.g., Error, custom class instances)
  return obj;
}

/**
 * Deeply merges the properties of `source` into `target`.
 * Modifies `target` and returns it.
 * - Arrays and non-plain objects are overwritten, not merged.
 * - Use `deepClone` first if you need a new object.
 */
export function merge<T extends object, U extends object>(target: T, source: U): T & U {
  const output = target as Record<string, unknown>;
  const src = source as Record<string, unknown>;

  if (isPlainObject(target) && isPlainObject(source)) {
    for (const key of Object.keys(src)) {
      const targetVal = output[key];
      const sourceVal = src[key];

      if (isPlainObject(targetVal) && isPlainObject(sourceVal)) {
        output[key] = merge(targetVal as object, sourceVal as object);
      } else {
        output[key] = sourceVal;
      }
    }
  }

  return output as T & U;
}

/**
 * Performs deep equality check between two values.
 * Compares primitives, arrays, plain objects, Date, RegExp, Map, and Set.
 */
export function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  // Neither null and both are objects
  if (typeof a === 'object' && typeof b === 'object') {
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (a instanceof RegExp && b instanceof RegExp) return a.toString() === b.toString();

    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [key, val] of a) {
        if (!b.has(key)) return false;

