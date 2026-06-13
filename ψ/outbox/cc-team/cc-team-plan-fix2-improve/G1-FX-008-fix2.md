<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-008 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2486,"completion_tokens":4908,"total_tokens":7394,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4424,"image_tokens":0},"cache_creation_input_tokens":0} | 50s
 generated: 2026-06-13T11:33:46.538Z -->
FILE: innomcp-node/src/services/responseComposer.ts
<<<<<<< SEARCH
export function composeThaiAnswer(input: ResponseComposerInput): ResponseComposerOutput {
  const t0 = Date.now();
  const reasons: string[] = [];
  const facts = Array.isArray(input.facts) ? input.facts : [];
=======
export function composeThaiAnswer(input: ResponseComposerInput): ResponseComposerOutput {
  if (input == null) {
    return {
      text: "ขออภัย ไม่พบข้อมูลที่เกี่ยวข้องในขณะนี้",
      mode: "passthrough",
      reasons: ["input-null"],
      latencyMs: 0,
      factCount: 0,
    };
  }
  const t0 = Date.now();
  const reasons: string[] = [];
  const facts = Array.isArray(input.facts) ? input.facts : [];
>>>>>>> REPLACE

FILE: innomcp-node/src/services/responseComposer.ts
<<<<<<< SEARCH
  const usable = facts
    .map((f) => ({ ...f, summary: trimFact(f.summary) }))
    .filter((f) => f.summary.length > 0);
=======
  const usable = facts
    .filter((f) => f != null && f.summary != null)
    .map((f) => ({ ...f, summary: trimFact(f.summary) }))
    .filter((f) => f.summary.length > 0);
>>>>>>> REPLACE

FILE: innomcp-node/src/services/responseComposer.ts
<<<<<<< SEARCH
function trimFact(s: string): string {
  return String(s || "").replace(/\s+/g, " ").trim();
=======
function trimFact(s: string): string {
  return String(s ?? "").replace(/\s+/g, " ").trim();
>>>>>>> REPLACE

FILE: innomcp-node/src/services/responseComposer.ts
<<<<<<< SEARCH
  const highConf = usable.filter((f) => (f.confidence ?? 1) >= 0.3);
=======
  const highConf = usable.filter((f) => Number(f.confidence ?? 1) >= 0.3);
>>>>>>> REPLACE
