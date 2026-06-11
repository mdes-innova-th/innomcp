'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface MDESHealth {
  isOnline: boolean;
  latencyMs: number | null;
  modelCount: number;
  lastChecked: Date | null;
  version?: string;
  error?: string;
}

const CACHE_KEY = 'innomcp.mdes.health.cache';
const CACHE_TTL_MS = 30_000;

function readCache(): MDESHealth | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp < CACHE_TTL_MS) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache(health: MDESHealth): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data: health, timestamp: Date.now() })
    );
  } catch {
    // storage unavailable – ignore
  }
}

export function useMDESProviderHealth(
  options?: { intervalMs?: number }
): MDESHealth & { refetch: () => void } {
  const intervalMs = options?.intervalMs ?? 30_000;

  const [health, setHealth] = useState<MDESHealth>(() => {
    const cached = readCache();
    return (
      cached ?? {
        isOnline: false,
        latencyMs: null,
        modelCount: 0,
        lastChecked: null,
      }
    );
  });

  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!mountedRef.current) return;

    const start = Date.now();
    let latency: number | null = null;
    let isOnline = false;
    let version: string | undefined;
    let error: string | undefined;
    let modelCount = 0;

    try {
      const healthRes = await fetch('/api/mdes/health');
      latency = Date.now() - start;

      if (!healthRes.ok) {
        throw new Error(`Health check failed with status ${healthRes.status}`);
      }

      const healthData = await healthRes.json();
      version = healthData?.version;
      isOnline = latency <= 10_000;
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'Unknown error';
      isOnline = false;
      latency = null;
    }

    // Fetch model count separately
    try {
      const modelsRes = await fetch('/api/mdes/models');
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        if (Array.isArray(modelsData?.models)) {
          modelCount = modelsData.models.length;
        } else if (Array.isArray(modelsData)) {
          modelCount = modelsData.length;
        }
      }
    } catch {
      // keep previous modelCount if fetch fails
    }

    if (!mountedRef.current) return;

    const newHealth: MDESHealth = {
      isOnline,
      latencyMs: latency,
      modelCount,
      lastChecked: new Date(),
      version,
      error,
    };

    setHealth(newHealth);
    writeCache(newHealth);
  }, []); // stable callback: setHealth is stable, other deps are stable

  // Initial fetch + polling
  useEffect(() => {
    mountedRef.current = true;

    fetchHealth();

    intervalRef.current = setInterval(fetchHealth, intervalMs);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchHealth, intervalMs]);

  // Refetch is the same fetchHealth callback
  const refetch = useCallback(() => {
    fetchHealth();
  }, [fetchHealth]);

  return { ...health, refetch };
}