<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-02 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":113,"completion_tokens":1015,"total_tokens":1128,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":418,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-13T05:25:08.649Z -->
```typescript
export interface SystemHealthReport {
  db: boolean;
  redis: boolean;
  providers: string[];
  mcpTools: number;
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

export async function checkSystemHealth(): Promise<SystemHealthReport> {
  const results = await Promise.allSettled([
    checkDb(),
    checkRedis(),
    checkProviders(),
    checkMcpTools(),
  ]);

  const db = results[0].status === 'fulfilled' ? results[0].value : false;
  const redis = results[1].status === 'fulfilled' ? results[1].value : false;
  const providers = results[2].status === 'fulfilled' ? results[2].value : [];
  const mcpTools = results[3].status === 'fulfilled' ? results[3].value : 0;

  const healthyCount = [db, redis].filter(Boolean).length + (providers.length > 0 ? 1 : 0);
  const totalComponents = 3; // db, redis, providers (as a group)

  let overall: 'healthy' | 'degraded' | 'unhealthy';
  if (healthyCount === totalComponents) {
    overall = 'healthy';
  } else if (healthyCount > 0) {
    overall = 'degraded';
  } else {
    overall = 'unhealthy';
  }

  return { db, redis, providers, mcpTools, overall };
}

async function checkDb(): Promise<boolean> {
  const { healthAggregator } = await import('./somewhere'); // replace with actual import
  try {
    const health = await healthAggregator.check();
    return health === true; // adjust based on actual return type
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  const { getRedisHealthSnapshot } = await import('./somewhere');
  try {
    const snapshot = await getRedisHealthSnapshot();
    return snapshot === true; // adjust based on actual return type
  } catch {
    return false;
  }
}

async function checkProviders(): Promise<string[]> {
  const { getProviderStatus } = await import('./somewhere');
  try {
    const status = await getProviderStatus();
    // Assuming status is an array of provider names that are healthy
    return Array.isArray(status) ? status : [];
  } catch {
    return [];
  }
}

async function checkMcpTools(): Promise<number> {
  // Implement MCP tools count retrieval based on your application
  // This is a placeholder: replace with actual logic
  try {
    const count = await getMcpToolsCount(); // hypothetical function
    return count;
  } catch {
    return 0;
  }
}
```
