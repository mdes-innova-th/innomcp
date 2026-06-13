<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-021 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3609,"completion_tokens":576,"total_tokens":4185,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":447,"image_tokens":0},"cache_creation_input_tokens":0} | 7s
 generated: 2026-06-13T11:40:29.412Z -->
FILE: innomcp-node/src/providers/registry.ts
<<<<<<< SEARCH
  // Remote MDES Ollama — optional (only seeded if URL env present)
  const mdesUrl =
    process.env.OLLAMA_REMOTE_BASE_URL || "https://ollama.mdes-innova.online";
  if (mdesUrl) {
=======
  // Remote MDES Ollama — optional (only seeded if URL env present)
  const mdesUrl = process.env.OLLAMA_REMOTE_BASE_URL;
  if (mdesUrl) {
>>>>>>> REPLACE
