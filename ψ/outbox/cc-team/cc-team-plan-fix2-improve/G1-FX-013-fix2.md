<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from improve)
 member: FX-013 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":3121,"completion_tokens":6553,"total_tokens":9674,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6278,"image_tokens":0},"cache_creation_input_tokens":0} | 83s
 generated: 2026-06-13T11:36:15.534Z -->
FILE: innomcp-node/src/services/providerManager.ts
<<<<<<< SEARCH
      if (response.ok || response.status < 500) {
=======
      if (response.ok) {
>>>>>>> REPLACE

FILE: innomcp-node/src/services/providerManager.ts
<<<<<<< SEARCH
        // Update provider
        provider.healthStatus = 'healthy';
        provider.latencyMs = latency;
        provider.lastChecked = Date.now();
=======
        // Update provider (re-fetch to avoid race condition)
        const currentProvider = this.providers.get(id);
        if (currentProvider) {
          currentProvider.healthStatus = 'healthy';
          currentProvider.latencyMs = latency;
          currentProvider.lastChecked = Date.now();
        }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/providerManager.ts
<<<<<<< SEARCH
      provider.healthStatus = 'degraded';
      provider.latencyMs = latency;
      provider.lastChecked = Date.now();
=======
      const currentProvider = this.providers.get(id);
      if (currentProvider) {
        currentProvider.healthStatus = 'degraded';
        currentProvider.latencyMs = latency;
        currentProvider.lastChecked = Date.now();
      }
>>>>>>> REPLACE
