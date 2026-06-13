<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-030 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3717,"completion_tokens":3560,"total_tokens":7277,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3123,"image_tokens":0},"cache_creation_input_tokens":0} | 39s
 generated: 2026-06-13T12:05:05.834Z -->
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
  } catch (err: any) {
    throw new Error(`Invalid URL for TMD API request: "${String(urlBase)}" — ${err?.message || err}`);
  }
  // Remove any pre-existing uid/ukey to avoid duplicates
  u.searchParams.delete("uid");
  u.searchParams.delete("ukey");
  u.searchParams.set("uid", uid);
  u.searchParams.set("ukey", ukey);
  return u.toString();
}
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/tools/tmdTools.ts
<<<<<<< SEARCH
import { tmdCacheGet, tmdCacheSet, getTmdCacheTtlMs } from "../../utils/tmdCache";

/**
 * TMD Tools (Production-ish)
=======
import { tmdCacheGet, tmdCacheSet, getTmdCacheTtlMs } from "../../utils/tmdCache";

// Ensure fetch API is available (required by Node.js 18+; if missing, throw immediately)
if (typeof fetch !== 'function') {
  throw new Error('Fetch API is not available in this Node.js environment. Please use Node.js 18+ or enable --experimental-fetch.');
}

/**
 * TMD Tools (Production-ish)
>>>>>>> REPLACE
