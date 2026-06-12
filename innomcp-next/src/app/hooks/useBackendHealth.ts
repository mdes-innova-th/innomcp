import { useState, useEffect } from 'react';
import { checkBackendHealth } from '../utils/healthCheck';

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