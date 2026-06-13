<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-004 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":4471,"completion_tokens":2377,"total_tokens":6848,"prompt_tokens_details":{"cached_tokens":4352,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2101,"image_tokens":0},"cache_creation_input_tokens":0} | 27s
 generated: 2026-06-13T11:54:53.978Z -->
FILE: innomcp-server-node/src/mcp/config/nwpApiConfig.ts
<<<<<<< SEARCH
  if (!name) return undefined;
  const normalized = name.trim().toLowerCase();
  // exact match case-insensitive
=======
  if (!name) return undefined;
  const normalized = name.trim().toLowerCase();
  if (!normalized) return undefined;
  // exact match case-insensitive
>>>>>>> REPLACE

FILE: innomcp-server-node/src/mcp/config/nwpApiConfig.ts
<<<<<<< SEARCH
  // partial match — prefer shortest key that contains the query
  const partials = Object.entries(PROVINCE_COORDS)
    .filter(([k]) => k.toLowerCase().includes(normalized) || normalized.includes(k.toLowerCase()))
    .sort(([a], [b]) => a.length - b.length);
  return partials[0]?.[1];
=======
  // partial match — only unambiguous single match
  const partials = Object.entries(PROVINCE_COORDS)
    .filter(([k]) => k.toLowerCase().includes(normalized) || normalized.includes(k.toLowerCase()));
  if (partials.length === 1) return partials[0][1];
  return undefined;
>>>>>>> REPLACE
