<!-- cc-team deliverable
 group: G1 (Fix patches from improve audit findings)
 member: FIX-013 role=fix model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2947,"completion_tokens":4520,"total_tokens":7467,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4016,"image_tokens":0},"cache_creation_input_tokens":0} | 46s
 generated: 2026-06-13T11:27:40.819Z -->
### Finding 1: Race condition in `checkHealth` – mutation of a stale provider reference  
`checkHealth` captures `provider` from `this.providers` before the `await fetch(…)`. If a concurrent `register`/`unregister` call modifies the map during that await, the function continues to mutate the old (possibly orphaned) object, and the current provider in the map never receives the update. A minimal fix is to re‑fetch the provider from the map after the async work and only mutate the live entry.

```typescript
  async checkHealth(id: string): Promise<{ healthy: boolean; latencyMs: number }> {
    const initialProvider = this.providers.get(id);
    if (!initialProvider) {
      throw new Error(`Provider ${id} not found`);
    }

    const timeoutMs = 10_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const start = Date.now();
    let healthy: boolean;
    let latencyMs: number;

    try {
      const url = new URL('/health', initialProvider.baseUrl).toString();
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: initialProvider.apiKey
          ? { Authorization: `Bearer ${initialProvider.apiKey}` }
          : undefined,
      });
      clearTimeout(timeout);
      latencyMs = Date.now() - start;
      healthy = response.ok || response.status < 500;
    } catch (err: any) {
      clearTimeout(timeout);
      latencyMs = Date.now() - start;
      healthy = false;
    }

    // Only update if the provider still exists in the map
    const currentProvider = this.providers.get(id);
    if (currentProvider) {
      currentProvider.healthStatus = healthy ? 'healthy' : 'degraded';
      currentProvider.latencyMs = latencyMs;
      currentProvider.lastChecked = Date.now();
    }

    return { healthy, latencyMs };
  }
```

### Finding 2: Potential `setTimeout` leak in `checkHealth`  
FALSE POSITIVE – `clearTimeout(timeout)` is unconditionally called in both the `try` and `catch` blocks, and the `AbortController` prevents any lingering effect even if the timeout fires. There is no resource leak.
