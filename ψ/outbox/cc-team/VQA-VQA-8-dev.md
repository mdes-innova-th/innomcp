<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-8 role=dev model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":77,"completion_tokens":1753,"total_tokens":1830,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1575,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 51s
 generated: 2026-06-12T04:21:24.179Z -->
import { useState, useEffect } from 'react';
import { checkBackendHealth } from '../api'; // Adjust import path as needed

interface BackendHealthResult {
  healthy: boolean;
  providers: object | null;
  lastChecked: Date | null;
}

export default function useBackendHealth(backendUrl: string): BackendHealthResult {
  const [healthy, setHealthy] = useState<boolean>(false);
  const [providers, setProviders] = useState<object | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    if (!backendUrl) return;

    const checkHealth = async () => {
      try {
        const result = await checkBackendHealth(backendUrl);
        setHealthy(result.healthy ?? false);
        setProviders(result.providers ?? null);
      } catch (error) {
        setHealthy(false);
        setProviders(null);
      } finally {
        setLastChecked(new Date());
      }
    };

    checkHealth();

    const intervalId = setInterval(checkHealth, 30000);

    return () => clearInterval(intervalId);
  }, [backendUrl]);

  return { healthy, providers, lastChecked };
}
