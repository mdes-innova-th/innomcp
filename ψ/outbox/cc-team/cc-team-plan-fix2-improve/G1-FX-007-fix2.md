<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-007 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":4141,"completion_tokens":6531,"total_tokens":10672,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":5970,"image_tokens":0},"cache_creation_input_tokens":0} | 68s
 generated: 2026-06-13T11:33:30.110Z -->
FILE: innomcp-node/src/services/intentClassifier.ts
<<<<<<< SEARCH
function evidenceMatch(message: string): string | null {
=======
const OFFICER_SIGNAL_RE = /หลักฐาน|คดี|พยาน|forensic|evidence|detect|nip|isp|offline|threat|sigint|scan|สแกน/i;

function evidenceMatch(message: string): string | null {
>>>>>>> REPLACE

FILE: innomcp-node/src/services/intentClassifier.ts
<<<<<<< SEARCH
  if (["machine", "url", "traffic"].includes(hit.toLowerCase())) {
    const hasOfficerSignal =
      /หลักฐาน|คดี|พยาน|forensic|evidence|detect|nip|isp|offline|threat|sigint|scan|สแกน/i.test(message);
    if (!hasOfficerSignal) return null;
  }
  if (/machine learning|url encoding|url คืออะไร/.test(lower)) return null;
=======
  if (["machine", "url", "traffic"].includes(hit.toLowerCase())) {
    const hasOfficerSignal = OFFICER_SIGNAL_RE.test(message);
    if (!hasOfficerSignal) return null;
    // Additional exclusion: common non-evidence phrases
    if (/machine learning|url encoding|url คืออะไร/.test(lower)) return null;
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/intentClassifier.ts
<<<<<<< SEARCH
function containsAny(text: string, list: string[]): string | null {
  const lower = text.toLowerCase();
  for (const k of list) {
    if (lower.includes(k.toLowerCase())) return k;
  }
  return null;
}
=======
const lowerCasedKeywordCache = new Map<string[], string[]>();
function toLowerCasedList(list: string[]): string[] {
  let lower = lowerCasedKeywordCache.get(list);
  if (!lower) {
    lower = list.map(k => k.toLowerCase());
    lowerCasedKeywordCache.set(list, lower);
  }
  return lower;
}

function containsAny(text: string, list: string[]): string | null {
  const lower = text.toLowerCase();
  const lowerList = toLowerCasedList(list);
  for (let i = 0; i < lowerList.length; i++) {
    if (lower.includes(lowerList[i])) return list[i]; // original case
  }
  return null;
}
>>>>>>> REPLACE

SKIP: looksLikeSystemInventoryQuestion and toolHint are both used in the visible logic; this is a false positive.
