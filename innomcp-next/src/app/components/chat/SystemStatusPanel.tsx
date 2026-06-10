"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

type ServiceStatus = "operational" | "degraded" | "down" | "unknown";

interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  latencyMs?: number;
  lastChecked: number;
  description: string;
}

interface HealthCheckResponse {
  services: ServiceHealth[];
  overall?: ServiceStatus;
}

interface SystemStatusPanelProps {
  onClose?: () => void;
  className?: string;
}

const SERVICE_ICONS: Record<string, string> = {
  "MDES Ollama": "🇹🇭",
  "Thai NWP Weather": "🌐",
  "Thai Geo Tool": "🗺️",
  "Evidence DB": "🔍",
  "Thai Knowledge": "📚",
  "WebSocket": "🔌",
  "Database": "🗄️",
  "Backend API": "📡",
};

const STATUS_LABELS: Record<ServiceStatus, string> = {
  operational: "ปกติ",
  degraded: "ช้า",
  down: "หยุดทำงาน",
  unknown: "ไม่ทราบ",
};

const STATUS_BG: Record<ServiceStatus, string> = {
  operational: "bg-green-500",
  degraded: "bg-amber-500",
  down: "bg-red-500",
  unknown: "bg-gray-400",
};

const API_ENDPOINT = "/api/providers/health-check";
const REFRESH_INTERVAL_MS = 30000;

export default function SystemStatusPanel({
  onClose,
  className,
}: SystemStatusPanelProps) {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<number>(0);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(API_ENDPOINT, { method: "POST" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data: HealthCheckResponse = await response.json();
      const list = Array.isArray(data) ? data : data.services;
      if (!list || !Array.isArray(list)) {
        throw new Error("รูปแบบข้อมูลไม่ถูกต้อง");
      }
      setServices(list);
      setLastChecked(Date.now());
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อ";
      setError(msg);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Auto refresh every 30 seconds
  useEffect(() => {
    const intervalId = setInterval(fetchHealth, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchHealth]);

  const overallStatus = useMemo<"ok" | "problem" | "unknown">(() => {
    if (loading && services.length === 0) return "unknown";
    if (services.length === 0) return "unknown";
    const worst = services.reduce<ServiceStatus>((worst, s) => {
      const order: ServiceStatus[] = ["operational", "degraded", "down", "unknown"];
      const currentIdx = order.indexOf(s.status);
      const worstIdx = order.indexOf(worst);
      return currentIdx > worstIdx ? s.status : worst;
    }, "operational");
    if (worst === "operational") return "ok";
    if (worst === "unknown") return "unknown";
    return "problem";
  }, [services, loading]);

  const overallText = {
    ok: "✅ ระบบทำงานปกติ",
    problem: "⚠️ ระบบบางส่วนมีปัญหา",
    unknown: "⏳ กำลังตรวจสอบ...",
  }[overallStatus];

  const overallColor = {
    ok: "text-green-700 bg-green-50 border-green-200",
    problem: "text-amber-700 bg-amber-50 border-amber-200",
    unknown: "text-gray-500 bg-gray-50 border-gray-200",
  }[overallStatus];

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm p-4 ${
        className ?? ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">
          สถานะระบบ INNOMCP
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="text-sm px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition-colors"
            aria-label="รีเฟรช"
          >
            🔄 {loading ? "กำลังโหลด..." : "รีเฟรช"}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="ปิด"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Overall summary */}
      <div
        className={`mb-3 px-3 py-2 rounded-lg border text-sm font-medium ${overallColor}`}
      >
        {overallText}
        {lastChecked > 0 && (
          <span className="ml-2 font-normal text-xs opacity-70">
            (อัปเดตล่าสุด: {new Date(lastChecked).toLocaleTimeString("th-TH")})
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Service list */}
      {loading && services.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">
          กำลังตรวจสอบสถานะ...
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {services.map((service) => {
            const icon = SERVICE_ICONS[service.name] ?? "🔧";
            const statusLabel = STATUS_LABELS[service.status] ?? "ไม่ทราบ";
            const statusBg = STATUS_BG[service.status] ?? "bg-gray-400";
            const latencyDisplay =
              service.latencyMs !== undefined
                ? `${service.latencyMs}ms`
                : null;
            return (
              <li
                key={service.name}
                className="flex items-center gap-2 py-2.5 px-1 hover:bg-gray-50 rounded-sm transition-colors"
              >
                <span className="text-lg shrink-0" title={service.name}>
                  {icon}
                </span>
                <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                  {service.name}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-white text-xs font-semibold ${statusBg}`}
                >
                  {statusLabel}
                </span>
                {latencyDisplay && (
                  <span className="text-xs text-gray-400 tabular-nums shrink-0 min-w-[4ch]">
                    {latencyDisplay}
                  </span>
                )}
              </li>
            );
          })}
          {services.length === 0 && !loading && (
            <li className="py-4 text-center text-gray-400 text-sm">
              ไม่มีข้อมูลบริการ
            </li>
          )}
        </ul>
      )}
    </div>
  );
}