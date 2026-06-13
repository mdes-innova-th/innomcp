<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-14 role=dev model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":71,"completion_tokens":1476,"total_tokens":1547,"prompt_tokens_details":{"cached_tokens":6,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1264,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 21s
 generated: 2026-06-13T05:26:03.533Z -->
export function formatISO(date: Date): string {
  return date.toISOString();
}

export function formatThai(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const buddhistYear = date.getFullYear() + 543;
  return `${day}/${month}/${buddhistYear}`;
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function daysDiff(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((utcA - utcB) / (1000 * 60 * 60 * 24));
}
