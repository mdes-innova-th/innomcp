<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-13 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":79,"completion_tokens":1538,"total_tokens":1617,"prompt_tokens_details":{"cached_tokens":3,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1273,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 15s
 generated: 2026-06-13T05:25:53.615Z -->
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts: number; delayMs: number; backoff?: boolean }
): Promise<T> {
  const { maxAttempts, delayMs, backoff } = opts;

  if (maxAttempts < 1) {
    throw new Error("maxAttempts must be at least 1");
  }
  if (delayMs < 0) {
    throw new Error("delayMs must be non-negative");
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) {
        break;
      }
      const waitMs = backoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;
      await sleep(waitMs);
    }
  }

  throw lastError;
}
