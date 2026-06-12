<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-14 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":66,"completion_tokens":345,"total_tokens":411,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":264,"image_tokens":0},"cache_creation_input_tokens":0} | 6s
 generated: 2026-06-12T03:49:18.745Z -->
export function validateEnv(required: string[]): void {
  const missing: string[] = [];

  for (const name of required) {
    if (!process.env[name]) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}
