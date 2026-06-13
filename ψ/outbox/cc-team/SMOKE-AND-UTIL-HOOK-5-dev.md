<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: HOOK-5 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":59,"completion_tokens":498,"total_tokens":557,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":382,"image_tokens":0},"cache_creation_input_tokens":0} | 7s
 generated: 2026-06-13T05:28:41.913Z -->
import { useState } from 'react';

export default function useCounter(init: number = 0, step: number = 1) {
  const [count, setCount] = useState(init);

  const increment = () => setCount((prev) => prev + step);
  const decrement = () => setCount((prev) => prev - step);
  const reset = () => setCount(init);
  const set = (n: number) => setCount(n);

  return { count, increment, decrement, reset, set };
}
