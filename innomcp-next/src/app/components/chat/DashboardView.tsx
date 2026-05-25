"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  runningTasks: number;
  failedTasks: number;
  avgRating: string | null;
  totalFeedback: number;
  shellExecutions24h: number;
}

interface RecentTask {
  id: string;
  title: string;
  intent: string;
  status: string;
  elapsed_ms: number | null;
  created_at: string;
}

interface DashboardData {
  stats: DashboardStats;
  recentTasks: RecentTask[];
  generatedAt: string;
}

// ─── Backend URL — matches pattern used in MemoryManager / ModelSettingsPanel ──

const BACKEND =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:3011"
    : "";

// ─── Status badge styles ──────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  completed:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  running:
    "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  failed:
    "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "เมื่อสักครู่";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} นาทีที่แล้ว`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ชม.ที่แล้ว`;
  return `${Math.floor(diff / 86_400_000)} วันที่แล้ว`;
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/60 p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10.5px] text-muted-foreground">{label}</p>
          <p className="text-[22px] font-semibold tabular-nums text-foreground leading-tight">
            {value}
          </p>
          {sub && (
            <p className="text-[10px] text-muted-foreground/70">{sub}</p>
          )}
        </div>
        <span className="text-xl">{icon}</span>
      </div>
    </div>
  );
}

// ─── DashboardView ────────────────────────────────────────────────────────────

export default function DashboardView({
  onOpenChat,
}: {
  onOpenChat?: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [taskSearch, setTaskSearch] = useState("");

  useEffect(() => {
    fetch(`${BACKEND}/api/dashboard`, { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-[12px]">
        <span className="animate-pulse">กำลังโหลด...</span>
      </div>
    );
  }

  const s = data?.stats;
  const filteredTasks = (data?.recentTasks ?? []).filter(
    (t) =>
      !taskSearch ||
      t.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
      t.intent.toLowerCase().includes(taskSearch.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-5">
      {/* Welcome */}
      <div>
        <h1 className="text-[20px] font-semibold text-foreground">Dashboard</h1>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          ภาพรวมระบบ INNOMCP Agent Studio
        </p>
      </div>

      {/* Stats grid */}
      {s && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="งานทั้งหมด" value={s.totalTasks} icon="📋" />
          <StatCard label="เสร็จสิ้น" value={s.completedTasks} icon="✅" />
          <StatCard
            label="กำลังทำงาน"
            value={s.runningTasks}
            icon={s.runningTasks > 0 ? "🔄" : "💤"}
          />
          <StatCard
            label="คะแนนเฉลี่ย"
            value={s.avgRating ? `${s.avgRating}★` : "—"}
            sub={
              s.totalFeedback > 0 ? `${s.totalFeedback} ratings` : "ยังไม่มี"
            }
            icon="⭐"
          />
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onOpenChat}
          className="rounded-lg bg-gradient-to-r from-sky-500 to-emerald-500 px-4 py-2 text-[12.5px] font-medium text-white hover:opacity-90 transition-opacity"
        >
          ➕ งานใหม่
        </button>
        <button className="rounded-lg border border-border/50 px-4 py-2 text-[12.5px] text-foreground hover:bg-muted/30 transition-colors">
          📋 ดูงานทั้งหมด
        </button>
        {s && s.shellExecutions24h > 0 && (
          <span className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 text-[11.5px] text-amber-700 dark:text-amber-400">
            🖥️ {s.shellExecutions24h} shell exec (24h)
          </span>
        )}
      </div>

      {/* Recent tasks */}
      <div>
        <p className="text-[12px] font-semibold text-foreground mb-2">
          งานล่าสุด
        </p>
        {!data?.recentTasks?.length ? (
          <div className="rounded-xl border border-border/30 bg-muted/10 p-6 text-center text-[12px] text-muted-foreground">
            <span className="text-2xl block mb-2">📭</span>
            ยังไม่มีงาน — เริ่มต้นด้วยการพิมพ์คำสั่งในช่องแชท
          </div>
        ) : (
          <>
            {/* Search input */}
            <div className="relative mb-2">
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="ค้นหางาน..."
                className="text-[12px] border border-border/40 rounded-lg px-3 py-1.5 w-full bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 pr-7"
              />
              {taskSearch && (
                <button
                  onClick={() => setTaskSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[13px] leading-none"
                  aria-label="ล้างการค้นหา"
                >
                  ×
                </button>
              )}
            </div>
            {/* Result count when searching */}
            {taskSearch && (
              <p className="text-[11px] text-muted-foreground mb-1.5">
                {filteredTasks.length} งาน
              </p>
            )}
            {filteredTasks.length === 0 ? (
              <div className="rounded-xl border border-border/30 bg-muted/10 p-4 text-center text-[12px] text-muted-foreground">
                ไม่พบงานที่ตรงกับการค้นหา
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {filteredTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => router.push(`/tasks/${t.id}`)}
                    className="flex items-center gap-3 rounded-lg border border-border/30 bg-background/60 px-3 py-2 hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium ${
                        STATUS_STYLE[t.status] ??
                        "bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      {t.status}
                    </span>
                    <p className="flex-1 truncate text-[12px] text-foreground">
                      {t.title}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {t.elapsed_ms && (
                        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                          {(t.elapsed_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/50">
                        {relTime(t.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {data?.generatedAt && (
        <p className="text-[10px] text-muted-foreground/40 text-right">
          อัปเดต: {new Date(data.generatedAt).toLocaleTimeString("th-TH")}
        </p>
      )}
    </div>
  );
}
