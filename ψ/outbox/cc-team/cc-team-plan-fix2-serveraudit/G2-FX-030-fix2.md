<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-030 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3717,"completion_tokens":2398,"total_tokens":6115,"prompt_tokens_details":{"cached_tokens":3712,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1953,"image_tokens":0},"cache_creation_input_tokens":0} | 27s
 generated: 2026-06-13T12:06:30.039Z -->
FILE: innomcp-server-node/src/mcp/tools/tmdTools.ts
<<<<<<< SEARCH
function withTmdAuthParams(urlBase: string, tier: TmdKeyTier = "api"): string {
  const { uid, ukey } = requireTmdAuthForTier(tier);
  const u = new URL(urlBase);
  u.searchParams.set("uid", uid);
  u.searchParams.set("ukey", ukey);
  return u.toString();
}
=======
function withTmdAuthParams(urlBase: string, tier: TmdKeyTier = "api"): string {
  const { uid, ukey } = requireTmdAuthForTier(tier);
  let u: URL;
  try {
    u = new URL(urlBase);
  } catch (err) {
    throw new Error(`Invalid urlBase for TMD auth: ${String(urlBase)} — must be a valid absolute URL. Original error: ${String(err)}`);
  }
  // Remove any existing uid/ukey to avoid duplicate or conflicting credentials
  u.searchParams.delete("uid");
  u.searchParams.delete("ukey");
  u.searchParams.set("uid", uid);
  u.searchParams.set("ukey", ukey);
  return u.toString();
}
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/tmdTools.ts
<<<<<<< SEARCH
const DEFAULT_TIMEOUT_MS = 60000; // ✅ เพิ่มเป็น 60s: TMD observation endpoints (WeatherToday, Weather3HoursBySynop, WeatherTodayByX) ใช้เวลา 20-31s
=======
if (typeof fetch !== "function") {
  throw new Error("fetch is not available in this environment. Please use Node.js 18+ or enable experimental fetch.");
}
const DEFAULT_TIMEOUT_MS = 60000; // ✅ เพิ่มเป็น 60s: TMD observation endpoints (WeatherToday, Weather3HoursBySynop, WeatherTodayByX) ใช้เวลา 20-31s
>>>>>>> REPLACE
