<!-- cc-team deliverable
 group: P3C (Phase 3.3 â€” /health endpoint must expose provider + build status)
 member: P3C-1 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":262,"completion_tokens":1153,"total_tokens":1415,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":987,"image_tokens":0},"cache_creation_input_tokens":0} | 16s
 generated: 2026-06-12T03:42:33.897Z -->
const providers = {
  configured: {
    mdesOllama: !!process.env.OLLAMA_BASE_URL,
    openai: !!(process.env.OPENAI_API_KEY || process.env.GPT_API_KEY),
    copilot: !!(process.env.GITHUB_COPILOT_TOKEN || process.env.COPILOT_API_KEY),
    thaiLlm: !!process.env.THAI_LLM_MODEL,
  },
  primary: 'mdes-ollama',
};

const build = {
  version: process.env.npm_package_version || '1.0.0',
  nodeVersion: process.version,
  env: process.env.NODE_ENV || 'development',
};

res.json({
  ...health,
  mcp_status,
  providers,
  build,
});
