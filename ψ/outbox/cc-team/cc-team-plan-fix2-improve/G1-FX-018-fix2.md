<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-018 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":4432,"completion_tokens":5084,"total_tokens":9516,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4715,"image_tokens":0},"cache_creation_input_tokens":0} | 61s
 generated: 2026-06-13T11:39:00.178Z -->
FILE: innomcp-node/src/services/generalGate.ts
<<<<<<< SEARCH
export function countDaysUntilEndOfYear(baseDate: Date): number {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const end = new Date(baseDate.getFullYear(), 11, 31);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}
=======
export function countDaysUntilEndOfYear(baseDate: Date): number {
  if (!(baseDate instanceof Date) || isNaN(baseDate.getTime())) {
    return 0;
  }
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const end = new Date(baseDate.getFullYear(), 11, 31);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}
>>>>>>> REPLACE

FILE: innomcp-node/src/services/generalGate.ts
<<<<<<< SEARCH
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return units[0];
  if (value < 0) return `ลบ${renderThaiNumberText(Math.abs(value))}`;
=======
  if (!Number.isFinite(value)) return String(value);
  if (!Number.isInteger(value)) {
    // For non-integer numbers, return string representation
    return String(value);
  }
  if (value === 0) return units[0];
  if (value < 0) return `ลบ${renderThaiNumberText(Math.abs(value))}`;
>>>>>>> REPLACE
