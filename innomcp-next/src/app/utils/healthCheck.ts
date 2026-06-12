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