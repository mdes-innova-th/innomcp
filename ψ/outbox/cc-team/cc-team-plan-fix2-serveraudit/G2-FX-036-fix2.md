<!-- cc-team deliverable
 group: G2 (SEARCH/REPLACE fixes from serveraudit)
 member: FX-036 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3113,"completion_tokens":860,"total_tokens":3973,"prompt_tokens_details":{"cached_tokens":3072,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":780,"image_tokens":0},"cache_creation_input_tokens":0} | 10s
 generated: 2026-06-13T12:08:50.602Z -->
FILE: innomcp-server-node/src/server.ts
<<<<<<< SEARCH
  // If headers already sent, do nothing
  if (res && res.headersSent) {
    return;
  }
=======
  // If no response object or headers already sent, do nothing
  if (!res || res.headersSent) {
    return;
  }
>>>>>>> REPLACE
