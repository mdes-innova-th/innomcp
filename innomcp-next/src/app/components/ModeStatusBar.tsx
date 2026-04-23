"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";

type HealthPayload = {
  mode?: "offline" | "online";
  mode_ready?: boolean;
  missing_keys?: string[];
  notes?: string[];
  /** AI mode from backend (local LLM vs remote Anthropic) */
  ai_mode?: "local" | "remote";
  /** MCP server connectivity */
  mcp_status?: "connected" | "disconnected" | "unknown";
};

export default function ModeStatusBar() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = useContext(AuthContext);
  const isGuestMode = auth ? auth.isGuestMode : true;
  const userRoleId = auth ? auth.userRoleId : null;

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
  const aiMode = data?.ai_mode;
  const mcpStatus = data?.mcp_status;

  const summary = useMemo(() => {
    if (loading) return "กำลังตรวจสอบระบบ...";
    if (warning) return `ยังขาด key: ${missing.join(", ") || "ไม่ทราบ"}`;
    return mode === "offline" ? "โหมดออฟไลน์: ปิดการเรียก API ภายนอก" : "โหมดออนไลน์พร้อมใช้งาน";
  }, [loading, warning, missing, mode]);

  // ── AI mode badge ──
  const aiBadge = useMemo(() => {
    if (!aiMode) return null;
    const isLocal = aiMode === "local";
    return (
      <span
        title={isLocal ? "ใช้ Local LLM (Ollama)" : "ใช้ Remote LLM (Anthropic Claude)"}
        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
          isLocal
            ? "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300"
            : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
        }`}
      >
        {isLocal ? (
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        ) : (
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
        )}
        AI: {isLocal ? "Local" : "Remote"}
      </span>
    );
  }, [aiMode]);

  // ── User role badge ──
  const roleBadge = useMemo(() => {
    if (isGuestMode || userRoleId === null)
      return (
        <span title="Guest — ล็อกอินเพื่อใช้งานเต็ม" className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          👤 Guest
        </span>
      );
    if (userRoleId === 0)
      return (
        <span title="Admin" className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
          👑 Admin
        </span>
      );
    return (
      <span title="Logged in user" className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        ✅ User
      </span>
    );
  }, [isGuestMode, userRoleId]);

  // ── MCP server status badge ──
  const mcpBadge = useMemo(() => {
    if (!mcpStatus) return null;
    const ok = mcpStatus === "connected";
    return (
      <span
        title={ok ? "MCP Server เชื่อมต่อแล้ว" : "MCP Server ไม่ตอบสนอง"}
        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
          ok
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
            : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
        MCP: {ok ? "ออนไลน์" : "ออฟไลน์"}
      </span>
    );
  }, [mcpStatus]);

  return (
    <div className="fixed top-16 left-0 right-0 z-40 border-b border-amber-200 bg-amber-50/95 text-amber-900 backdrop-blur-sm dark:border-amber-900/30 dark:bg-amber-950/80 dark:text-amber-200">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-1.5 text-xs sm:text-sm">
        {/* INNOMCP_MODE badge */}
        <span
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold ${
            mode === "online"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
          }`}
        >
          {mode === "online" ? (
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
            </svg>
          ) : (
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
            </svg>
          )}
          {mode === "online" ? "Online" : "Offline"}
        </span>

        {/* AI mode + MCP status + Role badges */}
        {aiBadge}
        {mcpBadge}
        {roleBadge}
        {mcpBadge}

        {/* Status summary text */}
        <span className="min-w-0 truncate text-amber-800 dark:text-amber-300">{summary}</span>

        {/* Warning when online but keys missing */}
        {warning ? (
          <span className="ml-auto rounded bg-rose-100 px-2 py-0.5 font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
            ตั้งค่า key ก่อนถึงจะใช้ฟีเจอร์จริงได้
          </span>
        ) : null}
      </div>
    </div>
  );
}
