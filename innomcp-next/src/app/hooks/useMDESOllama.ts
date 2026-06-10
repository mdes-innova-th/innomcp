// useMDESOllama.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OllamaModel {
  name: string;
  size?: number;
  modified_at?: string;
  details?: {
    parameter_size?: string;
    family?: string;
  };
}

interface UseMDESOllamaReturn {
  models: OllamaModel[];
  isLoading: boolean;
  isHealthy: boolean | null;
  error: string | null;
  refetch: () => void;
  lastFetchedAt: number | null;
}

interface CacheEntry {
  models: OllamaModel[];
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MDES_BASE_URL = "https://ollama.mdes-innova.online";
const MODELS_ENDPOINT = `${MDES_BASE_URL}/api/tags`;
const HEALTH_ENDPOINT = `${MDES_BASE_URL}/api/version`;
const CACHE_KEY = "innomcp.mdes.models.cache";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000; // 1s first, then 2s, then 4s

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function loadCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function saveCache(models: OllamaModel[]): void {
  try {
    const entry: CacheEntry = { models, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Silently fail – cache is non‑critical
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export default function useMDESOllama(): UseMDESOllamaReturn {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  // Track retries across renders
  const retryCountRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // -----------------------------------------------------------------------
  // Core fetch function (called on mount and on refetch)
  // -----------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    // Cancel any ongoing request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Reset retry counter if this is a manual refetch
    retryCountRef.current = 0;

    setIsLoading(true);
    setError(null);

    // Helper: single attempt with retry logic
    const attempt = async (
      retriesLeft: number = MAX_RETRIES
    ): Promise<void> => {
      try {
        // Check cache first
        const cached = loadCache();
        if (cached) {
          setModels(cached.models);
          setIsLoading(false);
          setLastFetchedAt(cached.timestamp);
          // Still fetch health as it changes often
          try {
            const versionRes = await fetch(HEALTH_ENDPOINT, {
              signal: controller.signal,
            });
            setIsHealthy(versionRes.ok);
          } catch {
            setIsHealthy(false);
          }
          return; // Use cached models
        }

        // Fetch health and models in parallel
        const [healthRes, modelsRes] = await Promise.all([
          fetch(HEALTH_ENDPOINT, { signal: controller.signal }),
          fetch(MODELS_ENDPOINT, { signal: controller.signal }),
        ]);

        const healthy = healthRes.ok;
        setIsHealthy(healthy);

        if (!modelsRes.ok) {
          throw new Error(
            `Failed to fetch models: ${modelsRes.status} ${modelsRes.statusText}`
          );
        }

        const data = await modelsRes.json();
        const fetchedModels: OllamaModel[] = data.models ?? [];

        // Update state
        setModels(fetchedModels);
        setLastFetchedAt(Date.now());
        saveCache(fetchedModels);
        setIsLoading(false);
        setError(null);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Aborted by user or new request – do nothing
          return;
        }

        const message = err instanceof Error ? err.message : "Unknown error";

        if (retriesLeft > 0) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, MAX_RETRIES - retriesLeft);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return attempt(retriesLeft - 1);
        }

        // No more retries
        setError(message);
        setIsLoading(false);
        setIsHealthy(false);
      }
    };

    await attempt();
  }, []);

  // -----------------------------------------------------------------------
  // Initial fetch and cleanup
  // -----------------------------------------------------------------------

  useEffect(() => {
    fetchData();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchData]);

  // -----------------------------------------------------------------------
  // Refetch (manual trigger, resets cache and retry)
  // -----------------------------------------------------------------------

  const refetch = useCallback(() => {
    // Clear cache manually so next fetch goes to network
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // ignore
    }
    retryCountRef.current = 0;
    fetchData();
  }, [fetchData]);

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------

  return {
    models,
    isLoading,
    isHealthy,
    error,
    refetch,
    lastFetchedAt,
  };
}