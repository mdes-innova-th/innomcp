"use client";
import React, { useState, useEffect } from "react";

interface ProviderStatus {
  totalProviders: number;
  enabledCount: number;
  activeCount: number;
  topProvider?: string;
}

function resolveBackendUrl(path: string): string {
  const envUrl = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BACKEND_URL
    ? String(process.env.NEXT_PUBLIC_BACKEND_URL).replace(/\/$/, "") : "";
  if (envUrl) return `${envUrl}${path}`;
  if (typeof window !== "undefined" && window.location.hostname === "localhost" && window.location.port === "3000")
    return `${window.location.protocol}//${window.location.hostname}:3011${path}`;
  return `http://localhost:3011${path}`;
}

interface Props {
  motherActive?: boolean;
  className?: string;
}

export default function MotherStatusBar({ motherActive = false, className = "" }: Props) {
  const [status, setStatus] = useState<ProviderStatus | null>(null);

  useEffect(() => {
    const poll = () => {
      fetch(resolveBackendUrl("/api/mother/summary"), { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d) setStatus({
            totalProviders: d.totalProviders ?? 14,
            enabledCount: d.enabledCount ?? 0,
            activeCount: d.activeProviders ?? 0,
            topProvider: d.topProvider?.id,
          });
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, motherActive ? 5000 : 30000);
    return () => clearInterval(id);
  }, [motherActive]);

  if (!status) return null;

  return (
    <div className={`flex items-center gap-2 text-[10px] text-muted-foreground ${className}`}>
      <span className={`inline-flex h-1.5 w-1.5 rounded-full ${motherActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
      <span>
        {status.activeCount > 0
          ? <><span className="text-emerald-600 dark:text-emerald-400 font-medium">{status.activeCount}</span>/{status.totalProviders} active</>
          : <><span className="font-medium">{status.enabledCount}</span>/{status.totalProviders} ready</>
        }
      </span>
      {motherActive && (
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">· Mother ON</span>
      )}
      {status.topProvider && (
        <span className="text-muted-foreground/60">· 🏆 {status.topProvider}</span>
      )}
    </div>
  );
}
