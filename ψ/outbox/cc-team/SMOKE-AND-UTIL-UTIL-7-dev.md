<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: UTIL-7 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":53,"completion_tokens":1658,"total_tokens":1711,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1460,"image_tokens":0},"cache_creation_input_tokens":0} | 19s
 generated: 2026-06-13T05:28:17.358Z -->
export function throttle<T extends unknown[]>(fn: (...args: T) => void, ms: number): (...args: T) => void {
  let lastCallTime = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: T | null = null;

  return function (...args: T): void {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall >= ms) {
      lastCallTime = now;
      fn(...args);
    } else {
      lastArgs = args;
      if (timer) {
        clearTimeout(timer);
      }
      const remaining = ms - timeSinceLastCall;
      timer = setTimeout(() => {
        lastCallTime = Date.now();
        fn(...(lastArgs as T));
        timer = null;
        lastArgs = null;
      }, remaining);
    }
  };
}
