<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-7 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":88,"completion_tokens":1965,"total_tokens":2053,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1829,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 20s
 generated: 2026-06-12T04:20:53.204Z -->
export async function checkBackendHealth(
  backendUrl: string
): Promise<{ healthy: boolean; providers?: object; build?: object; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(new URL('/health', backendUrl).toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return {
        healthy: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      healthy: true,
      providers: typeof data.providers === 'object' && data.providers !== null ? data.providers : undefined,
      build: typeof data.build === 'object' && data.build !== null ? data.build : undefined,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { healthy: false, error: 'Health check timed out after 3s' };
    }
    return {
      healthy: false,
      error: err instanceof Error ? err.message : 'Unknown error during health check',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
