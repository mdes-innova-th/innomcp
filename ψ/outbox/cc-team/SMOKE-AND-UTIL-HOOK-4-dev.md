<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: HOOK-4 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":50,"completion_tokens":194,"total_tokens":244,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":102,"image_tokens":0},"cache_creation_input_tokens":0} | 3s
 generated: 2026-06-13T05:28:37.264Z -->
export function useToggle(initial: boolean = false): [boolean, () => void, (v: boolean) => void] {
  const [value, setValue] = React.useState(initial);
  const toggle = React.useCallback(() => setValue((prev) => !prev), []);
  const set = React.useCallback((v: boolean) => setValue(v), []);
  return [value, toggle, set];
}
