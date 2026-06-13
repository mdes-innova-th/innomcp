<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-42 role=dev model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":65,"completion_tokens":1765,"total_tokens":1830,"prompt_tokens_details":{"cached_tokens":64,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1347,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 24s
 generated: 2026-06-13T05:27:20.204Z -->
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function round(n: number, decimals: number): number {
  if (decimals < 0) decimals = 0;
  return Number(n.toFixed(decimals));
}

export function toPercent(n: number, total: number): number {
  if (total === 0) return 0;
  return (n / total) * 100;
}

export function abbreviate(n: number): string {
  const absN = Math.abs(n);
  if (absN < 1000) {
    return String(n);
  }

  const tiers = [
    { threshold: 1e12, suffix: 'T' },
    { threshold: 1e9, suffix: 'B' },
    { threshold: 1e6, suffix: 'M' },
    { threshold: 1e3, suffix: 'K' },
  ];

  for (const { threshold, suffix } of tiers) {
    if (absN >= threshold) {
      const scaled = n / threshold;
      return scaled.toFixed(1) + suffix;
    }
  }

  return String(n);
}
