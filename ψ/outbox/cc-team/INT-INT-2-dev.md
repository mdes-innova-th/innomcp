<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-2 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":68,"completion_tokens":718,"total_tokens":786,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":563,"image_tokens":0},"cache_creation_input_tokens":0} | 8s
 generated: 2026-06-12T03:48:18.132Z -->
export const PORT: number = (() => {
  const raw = process.env.PORT || '3000';
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? 3000 : parsed;
})();

export const NODE_ENV: string = process.env.NODE_ENV || 'development';

export const OLLAMA_BASE_URL: string =
  process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export const SERVER_HOST: string = process.env.SERVER_HOST || '0.0.0.0';

const envConfig = {
  PORT,
  NODE_ENV,
  OLLAMA_BASE_URL,
  SERVER_HOST,
};

export default envConfig;
