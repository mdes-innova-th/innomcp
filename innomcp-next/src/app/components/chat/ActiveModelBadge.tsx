"use client";
import React, { useState, useEffect } from "react";
const BACKEND = typeof window !== "undefined" && window.location.port === "3000" ? "http://localhost:3011" : "";

export default function ActiveModelBadge() {
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    // Fetch provider health to find active provider
    fetch(`${BACKEND}/api/providers/health-check`, { method: "POST", credentials: "include" })
      .then(r => r.json())
      .then(d => {
        const healthy = d.results?.find((r: any) => r.healthStatus === "healthy");
        if (healthy) setActiveProvider(`${healthy.displayName}`);
      })
      .catch(() => {});
  }, []);

  // Listen for response time events
  useEffect(() => {
    const handler = (e: CustomEvent) => setLatencyMs(e.detail?.ms);
    window.addEventListener("innomcp-response-time", handler as EventListener);
    return () => window.removeEventListener("innomcp-response-time", handler as EventListener);
  }, []);

  if (!activeProvider && !latencyMs) return null;

  return (
    <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground/60">
      {activeProvider && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {activeProvider}
        </span>
      )}
      {latencyMs && (
        latencyMs > 5000
          ? <span className="text-amber-500 tabular-nums">⚠️ {latencyMs}ms</span>
          : <span className="tabular-nums">{latencyMs}ms</span>
      )}
    </div>
  );
}
