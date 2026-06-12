"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface HealthResponse {
  status?: string;
  uptime?: number;
  [key: string]: unknown;
}

export interface WSHealthResponse {
  status?: string;
  connections?: number;
  [key: string]: unknown;
}

interface HealthContextValue {
  health: HealthResponse | null;
  wsHealth: WSHealthResponse | null;
  loading: boolean;
}

const HealthContext = createContext<HealthContextValue | undefined>(undefined);

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [wsHealth, setWsHealth] = useState<WSHealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/health");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = (await response.json()) as {
        health?: HealthResponse;
        wsHealth?: WSHealthResponse;
      };
      setHealth(data.health ?? null);
      setWsHealth(data.wsHealth ?? null);
    } catch (error) {
      console.error("Failed to fetch health status:", error);
      setHealth(null);
      setWsHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const intervalId = setInterval(fetchHealth, 60000);
    return () => clearInterval(intervalId);
  }, [fetchHealth]);

  return (
    <HealthContext.Provider value={{ health, wsHealth, loading }}>
      {children}
    </HealthContext.Provider>
  );
}

export function useHealth(): HealthContextValue {
  const context = useContext(HealthContext);
  if (context === undefined) {
    throw new Error("useHealth must be used within a HealthProvider");
  }
  return context;
}