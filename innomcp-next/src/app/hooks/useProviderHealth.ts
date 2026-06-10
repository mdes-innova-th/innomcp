'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProviderStatus {
  id: string;
  name: string;
  healthy: boolean;
  latencyMs: number;
  lastChecked: number;
  model?: string;
}

export interface UseProviderHealthOptions {
  /** Polling interval for the general provider health endpoint (milliseconds) */
  providerInterval?: number;
  /** Polling interval for the MDES-specific health endpoint (milliseconds) */
  mdesInterval?: number;
  /** If provided, only these provider IDs will be returned */
  providers?: string[];
}

export interface UseProviderHealthReturn {
  /** Statuses for all or filtered providers */
  statuses: ProviderStatus[];
  /** Status of the MDES platform (if available) */
  mdesStatus: ProviderStatus | undefined;
  /** True if all providers (including MDES) are healthy */
  isAllHealthy: boolean;
  /** Timestamp (epoch ms) of the last successful health check */
  lastChecked: number;
  /** Manually trigger a health check refresh */
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PROVIDER_INTERVAL = 60_000; // 60 seconds
const DEFAULT_MDES_INTERVAL = 30_000;     // 30 seconds
const MAX_RETRIES = 3;
const DEGRADED_LATENCY_THRESHOLD = 5000;  // 5 seconds

// ---------------------------------------------------------------------------
// Helper: fetch with retry logic
// ---------------------------------------------------------------------------

async function fetchWithRetry(
  url: string,
  retries: number = MAX_RETRIES,
  signal?: AbortSignal
): Promise<Response | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, { signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response;
    } catch (err) {
      lastError = err;
      // If aborted, don't retry
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
      // Wait before retry (exponential backoff)
      if (attempt < retries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 500)
        );
      }
    }
  }
  // All retries failed
  console.warn(`[useProviderHealth] Fetch failed for ${url} after ${retries} retries`, lastError);
  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProviderHealth(
  options?: UseProviderHealthOptions
): UseProviderHealthReturn {
  const {
    providerInterval = DEFAULT_PROVIDER_INTERVAL,
    mdesInterval = DEFAULT_MDES_INTERVAL,
    providers: providerFilter,
  } = options ?? {};

  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [mdesStatus, setMdesStatus] = useState<ProviderStatus | undefined>();
  const [lastChecked, setLastChecked] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch general providers
  // ---------------------------------------------------------------------------

  const fetchProviders = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const response = await fetchWithRetry(
      '/api/providers/health-check',
      MAX_RETRIES,
      controller.signal
    );

    if (!response) {
      // Mark all providers as unhealthy (or keep previous?)
      // Keep previous statuses but set lastChecked to now to indicate issue
      setLastChecked(Date.now());
      return;
    }

    try {
      const raw: ProviderStatus[] = await response.json();
      const now = Date.now();

      const processed: ProviderStatus[] = raw
        .map((p) => ({
          ...p,
          healthy:
            p.healthy && p.latencyMs <= DEGRADED_LATENCY_THRESHOLD,
          lastChecked: now,
        }))
        .filter((p) => {
          if (!providerFilter || providerFilter.length === 0) return true;
          return providerFilter.includes(p.id);
        });

      setStatuses(processed);
      setLastChecked(now);
    } catch (err) {
      console.error('[useProviderHealth] Failed to parse provider health data', err);
      setLastChecked(Date.now());
    }
  }, [providerFilter]);

  // ---------------------------------------------------------------------------
  // Fetch MDES health
  // ---------------------------------------------------------------------------

  const fetchMdes = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const response = await fetchWithRetry(
      '/api/mdes/health',
      MAX_RETRIES,
      controller.signal
    );

    if (!response) {
      setMdesStatus((prev) =>
        prev
          ? { ...prev, healthy: false, lastChecked: Date.now() }
          : undefined
      );
      setLastChecked(Date.now());
      return;
    }

    try {
      const raw: ProviderStatus = await response.json();
      const now = Date.now();

      setMdesStatus({
        ...raw,
        healthy: raw.healthy && raw.latencyMs <= DEGRADED_LATENCY_THRESHOLD,
        lastChecked: now,
      });
      setLastChecked(now);
    } catch (err) {
      console.error('[useProviderHealth] Failed to parse MDES health data', err);
      setLastChecked(Date.now());
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Refresh (manual trigger)
  // ---------------------------------------------------------------------------

  const refresh = useCallback(() => {
    fetchProviders();
    fetchMdes();
  }, [fetchProviders, fetchMdes]);

  // ---------------------------------------------------------------------------
  // Polling effect
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Initial fetch
    fetchProviders();
    fetchMdes();

    // Polling intervals
    const providerTimer = setInterval(fetchProviders, providerInterval);
    const mdesTimer = setInterval(fetchMdes, mdesInterval);

    return () => {
      clearInterval(providerTimer);
      clearInterval(mdesTimer);
      abortControllerRef.current?.abort();
    };
  }, [fetchProviders, fetchMdes, providerInterval, mdesInterval]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const isAllHealthy =
    statuses.every((s) => s.healthy) &&
    (mdesStatus ? mdesStatus.healthy : true);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    statuses,
    mdesStatus,
    isAllHealthy,
    lastChecked,
    refresh,
  };
}