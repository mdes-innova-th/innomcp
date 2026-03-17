"use client";

import { useEffect, useMemo, useState } from "react";

type HealthPayload = {
  mode?: "offline" | "online";
  mode_ready?: boolean;
  missing_keys?: string[];
  notes?: string[];
};

export default function ModeStatusBar() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const json = (await response.json()) as HealthPayload;
        if (!active) return;
        setData(json);
      } catch {
        if (!active) return;
        setData({ mode: "offline", mode_ready: false, notes: ["cannot reach health endpoint"] });
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    const id = setInterval(load, 20000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const mode = data?.mode === "online" ? "online" : "offline";
  const modeReady = Boolean(data?.mode_ready);
  const missing = data?.missing_keys || [];
  const warning = mode === "online" && !modeReady;

  const summary = useMemo(() => {
    if (loading) return "Checking readiness...";
    if (warning) return `Missing keys: ${missing.join(", ") || "unknown"}`;
    return mode === "offline" ? "Offline mode: external API disabled" : "Online mode ready";
  }, [loading, warning, missing, mode]);

  return (
    <div className="fixed top-16 left-0 right-0 z-40 border-b border-amber-200 bg-amber-50/95 text-amber-900 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-1.5 text-xs sm:text-sm">
        <span className={`rounded px-2 py-0.5 font-semibold ${mode === "online" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
          INNOMCP_MODE: {mode}
        </span>
        <span className="truncate">{summary}</span>
        {warning ? (
          <span className="ml-auto rounded bg-rose-100 px-2 py-0.5 font-medium text-rose-700">
            ตั้งค่า key ก่อนถึงจะใช้ฟีเจอร์จริงได้
          </span>
        ) : null}
      </div>
    </div>
  );
}
