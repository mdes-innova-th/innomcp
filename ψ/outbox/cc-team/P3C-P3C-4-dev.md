<!-- cc-team deliverable
 group: P3C (Phase 3.3 â€” /health endpoint must expose provider + build status)
 member: P3C-4 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":79,"completion_tokens":1491,"total_tokens":1570,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1164,"image_tokens":0},"cache_creation_input_tokens":0} | 21s
 generated: 2026-06-12T03:42:46.621Z -->
export interface ProviderStatus {
  configured: {
    mdesOllama: boolean;
    openai: boolean;
    copilot: boolean;
    thaiLlm: boolean;
  };
  primary: string;
}

export function getProviderStatus(): ProviderStatus {
  const mdesOllamaConfigured =
    process.env.MDES_OLLAMA_ENABLED?.toLowerCase() === 'true';
  const openaiConfigured =
    process.env.OPENAI_ENABLED?.toLowerCase() === 'true' ||
    !!process.env.OPENAI_API_KEY;
  const copilotConfigured =
    process.env.COPILOT_ENABLED?.toLowerCase() === 'true' ||
    !!process.env.GITHUB_TOKEN;
  const thaiLlmConfigured =
    process.env.THAI_LLM_ENABLED?.toLowerCase() === 'true';

  const primary =
    process.env.PRIMARY_PROVIDER ||
    (openaiConfigured
      ? 'openai'
      : mdesOllamaConfigured
        ? 'mdesOllama'
        : copilotConfigured
          ? 'copilot'
          : thaiLlmConfigured
            ? 'thaiLlm'
            : 'openai');

  return {
    configured: {
      mdesOllama: mdesOllamaConfigured,
      openai: openaiConfigured,
      copilot: copilotConfigured,
      thaiLlm: thaiLlmConfigured,
    },
    primary,
  };
}
