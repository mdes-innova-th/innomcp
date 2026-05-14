"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";

type HealthPayload = {
  mode?: "offline" | "online";
  mode_ready?: boolean;
  missing_keys?: string[];
  notes?: string[];
  /** AI mode from backend (local LLM, remote MDES/cloud, or hybrid router) */
  ai_mode?: "local" | "remote" | "hybrid";
  /** MCP server connectivity */
  mcp_status?: "connected" | "local-only" | "disconnected" | "unknown";
  local_tools?: number;
  remote_tools?: number;
  total_tools?: number;
};

const HEALTH_CACHE_KEY = "innomcp-health-cache:v1";
const HEALTH_CACHE_TTL_MS = 60_000;
const HEALTH_POLL_INTERVAL_MS = 60_000;

type CachedHealthSnapshot = {
  savedAt: number;
  payload: HealthPayload;
};

let inMemoryHealthCache: CachedHealthSnapshot | null = null;
let pendingHealthPayloadRequest: Promise<HealthPayload> | null = null;

function isFreshHealthSnapshot(snapshot: CachedHealthSnapshot | null): snapshot is CachedHealthSnapshot {
  return Boolean(snapshot && Date.now() - snapshot.savedAt <= HEALTH_CACHE_TTL_MS);
}

function readCachedHealthSnapshot(): CachedHealthSnapshot | null {
  if (isFreshHealthSnapshot(inMemoryHealthCache)) {
    return inMemoryHealthCache;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(HEALTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedHealthSnapshot;
    if (!parsed?.payload || typeof parsed.savedAt !== "number") return null;
    if (!isFreshHealthSnapshot(parsed)) {
      sessionStorage.removeItem(HEALTH_CACHE_KEY);
      return null;
    }
    inMemoryHealthCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function readCachedHealthPayload(): HealthPayload | null {
  return readCachedHealthSnapshot()?.payload ?? null;
}

function writeCachedHealthPayload(payload: HealthPayload): void {
  const snapshot = {
    savedAt: Date.now(),
    payload,
  } satisfies CachedHealthSnapshot;
  inMemoryHealthCache = snapshot;

  if (typeof window === "undefined") {
    return;
  }

  try {
    sessionStorage.setItem(
      HEALTH_CACHE_KEY,
      JSON.stringify(snapshot)
    );
  } catch {
    // Ignore cache write issues.
  }
}

async function requestHealthPayload(force = false): Promise<HealthPayload> {
  if (!force) {
    const cached = readCachedHealthPayload();
    if (cached) {
      return cached;
    }
  }

  if (pendingHealthPayloadRequest) {
    return pendingHealthPayloadRequest;
  }

  pendingHealthPayloadRequest = fetch("/api/health", { cache: "no-store" })
    .then(async (response) => {
      const json = (await response.json()) as HealthPayload;
      writeCachedHealthPayload(json);
      return json;
    })
    .catch(() => ({ mode: "offline", mode_ready: false, notes: ["cannot reach health endpoint"] } satisfies HealthPayload))
    .finally(() => {
      pendingHealthPayloadRequest = null;
    });

  return pendingHealthPayloadRequest;
}

export default function ModeStatusBar() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = useContext(AuthContext);
  const isGuestMode = auth ? auth.isGuestMode : true;
  const userRoleId = auth ? auth.userRoleId : null;

  useEffect(() => {
    let active = true;

    const applyPayload = (json: HealthPayload) => {
      if (!active) return;
      setData(json);
      setLoading(false);
    };

    const load = async (force = false) => {
      try {
        const json = await requestHealthPayload(force);
        applyPayload(json);
      } catch {
        applyPayload({ mode: "offline", mode_ready: false, notes: ["cannot reach health endpoint"] });
      }
    };

    void load();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };

    const handleFocus = () => {
      void load();
    };

    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
      }
    }, HEALTH_POLL_INTERVAL_MS);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const mode = data?.mode === "online" ? "online" : "offline";
  const modeReady = Boolean(data?.mode_ready);
  const missing = data?.missing_keys || [];
  const notes = data?.notes || [];
  const warning = mode === "online" && !modeReady;
  const aiMode = data?.ai_mode;
  const mcpStatus = data?.mcp_status;
  const localTools = Number(data?.local_tools || 0);
  const remoteTools = Number(data?.remote_tools || 0);

  const barToneClasses = useMemo(() => {
    if (loading) {
      return "border-border/60 bg-background/92 text-foreground shadow-[0_10px_26px_oklch(0_0_0/0.04)] dark:bg-background/88";
    }
    if (mode === "offline") {
      return "border-slate-200/80 bg-slate-50/94 text-slate-800 shadow-[0_10px_26px_oklch(0_0_0/0.04)] dark:border-slate-700/70 dark:bg-slate-950/72 dark:text-slate-200";
    }
    if (warning) {
      return "border-amber-200/70 bg-amber-50/92 text-amber-900 shadow-[0_10px_26px_oklch(0_0_0/0.04)] dark:border-amber-900/30 dark:bg-amber-950/78 dark:text-amber-200";
    }
    return "border-emerald-200/70 bg-background/92 text-foreground shadow-[0_10px_26px_oklch(0_0_0/0.04)] dark:border-emerald-900/30 dark:bg-background/88";
  }, [loading, mode, warning]);

  const summaryClassName = warning
    ? "text-amber-800 dark:text-amber-300"
    : mode === "offline"
    ? "text-slate-700 dark:text-slate-200"
    : "text-foreground/80 dark:text-foreground/80";

  const summary = useMemo(() => {
    if (loading) return "กำลังตรวจสอบระบบ...";
    if (mode === "offline") return "โหมดออฟไลน์: ปิดการเรียก API ภายนอก";
    if (warning) {
      if (missing.length > 0) return `ยังขาด key: ${missing.join(", ")}`;
      if (mcpStatus === "local-only") {
        return `ระบบออนไลน์แบบจำกัดความสามารถ: ในเครื่อง ${localTools} เครื่องมือ, ภายนอก ${remoteTools} เครื่องมือ`;
      }
      if (notes.includes("remote_mcp_unavailable")) return "ระบบออนไลน์ แต่ MCP ภายนอกยังไม่พร้อม";
      return "ระบบออนไลน์ แต่บางความสามารถยังไม่พร้อม";
    }
    return "ระบบออนไลน์พร้อมใช้งาน";
  }, [loading, mode, warning, missing, mcpStatus, localTools, remoteTools, notes]);

  // ── Compact role marker (admins only — regular users get the implicit "online" pill)
  const roleMark = useMemo(() => {
    if (isGuestMode || userRoleId === null || userRoleId !== 0) return null;
    return (
      <span
        title="Admin"
        className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-800 dark:bg-amber-900/35 dark:text-amber-200"
      >
        👑 Admin
      </span>
    );
  }, [isGuestMode, userRoleId]);

  const aiLabel =
    aiMode === "local"
      ? "AI Local"
      : aiMode === "remote"
      ? "AI Remote"
      : aiMode === "hybrid"
      ? "AI Hybrid"
      : null;

  // Color-code the AI mode badge so the user can tell at a glance which
  // backend is wired up — sky for local, violet for remote, emerald for hybrid.
  const aiToneClass =
    aiMode === "local"
      ? "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300"
      : aiMode === "remote"
      ? "bg-violet-500/12 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300"
      : aiMode === "hybrid"
      ? "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
      : "";
  const mcpLabel = mcpStatus
    ? `MCP ${mcpStatus === "connected" ? "พร้อม" : mcpStatus === "local-only" ? "เฉพาะในเครื่อง" : "ออฟไลน์"}`
    : null;
  const tooltip = [aiLabel, mcpLabel, summary].filter(Boolean).join(" · ");

  const dotClass =
    mode === "offline"
      ? "bg-slate-400"
      : warning
      ? "bg-amber-500"
      : "bg-emerald-500";

  const stateLabel =
    mode === "offline" ? "ออฟไลน์" : warning ? "จำกัด" : "ออนไลน์";

  return (
    <div data-testid="mode-status-bar" className={`fixed left-0 right-0 top-14 z-40 border-b backdrop-blur-md sm:top-16 ${barToneClasses}`}>
      <div
        className="mx-auto flex max-w-screen-2xl items-center gap-x-3 px-4 py-0.5 text-[11px] sm:px-5 lg:px-6"
        title={tooltip}
      >
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
          {stateLabel}
        </span>

        {(aiLabel || mcpLabel) && (
          <span className="hidden items-center gap-2 text-muted-foreground/80 sm:inline-flex">
            {aiLabel && (
              <span
                data-testid="ai-mode-badge"
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10.5px] font-medium ${aiToneClass}`}
                title={`AI backend: ${aiMode}`}
              >
                {aiLabel}
              </span>
            )}
            {aiLabel && mcpLabel && <span className="text-muted-foreground/40">·</span>}
            {mcpLabel && (
              <span data-testid="mcp-badge" className="font-mono text-[10.5px]">
                {mcpLabel}
              </span>
            )}
          </span>
        )}

        {/* Status summary — single neutral line, truncated */}
        <span
          data-testid="mode-summary"
          className={`min-w-0 flex-1 truncate ${summaryClassName}`}
        >
          {summary}
        </span>

        {roleMark}

        {/* Warning when online but keys missing */}
        {warning ? (
          <span className="hidden rounded-md bg-rose-100 px-1.5 py-0.5 font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 md:inline-flex">
            {missing.length > 0
              ? "ตั้งค่า key ก่อน"
              : mcpStatus === "local-only"
              ? "ใช้ได้เฉพาะ local"
              : "บางบริการยังไม่พร้อม"}
          </span>
        ) : null}
      </div>
    </div>
  );
}
