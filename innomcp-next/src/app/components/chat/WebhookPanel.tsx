"use client";
import React, { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  hasSecret: boolean;
  lastTriggeredAt?: string;
  failureCount: number;
}

type TestState = "idle" | "loading" | "success" | "error";

// ── Constants ─────────────────────────────────────────────────────────────────

const BACKEND =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:3011"
    : "";

const VALID_EVENTS = [
  { value: "task.completed",    label: "Task Completed" },
  { value: "task.failed",       label: "Task Failed" },
  { value: "artifact.created",  label: "Artifact Created" },
  { value: "approval.required", label: "Approval Required" },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr  / 24);
  if (diffSec < 45)  return "just now";
  if (diffMin < 60)  return `${diffMin}m ago`;
  if (diffHr  < 24)  return `${diffHr}h ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7)   return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString("th-TH", { month: "short", day: "numeric" });
}

function truncateUrl(url: string, max = 36): string {
  if (url.length <= max) return url;
  return url.slice(0, max) + "…";
}

// ── Toggle switch (same pattern as PluginPanel) ───────────────────────────────

const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}> = ({ checked, onChange, disabled }) => (
  <button
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50 ${
      checked ? "bg-primary" : "bg-muted"
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
        checked ? "translate-x-4" : "translate-x-0"
      }`}
    />
  </button>
);

// ── Webhook card ──────────────────────────────────────────────────────────────

const WebhookCard: React.FC<{
  webhook: Webhook;
  testState: TestState;
  toggling: boolean;
  onTest: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string, name: string) => void;
}> = ({ webhook, testState, toggling, onTest, onToggle, onDelete }) => {
  const testLabel =
    testState === "loading" ? "กำลังทดสอบ..." :
    testState === "success" ? "✅ ส่งสำเร็จ" :
    testState === "error"   ? "❌ ล้มเหลว" :
    "ทดสอบ";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 transition-colors hover:border-border/70">
      {/* Row 1 — name + status dot */}
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${webhook.enabled ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          title={webhook.enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
        />
        <span className="flex-1 truncate text-[13.5px] font-semibold text-foreground leading-snug">
          {webhook.name}
        </span>
        {webhook.failureCount > 0 && (
          <span
            className="inline-flex items-center rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400"
            title={`${webhook.failureCount} delivery failure(s)`}
          >
            {webhook.failureCount} fail
          </span>
        )}
      </div>

      {/* Row 2 — URL */}
      <p
        className="text-[11.5px] leading-snug text-muted-foreground font-mono"
        title={webhook.url}
      >
        {truncateUrl(webhook.url)}
      </p>

      {/* Row 3 — event badges */}
      <div className="flex flex-wrap gap-1">
        {webhook.events.map((ev) => (
          <span
            key={ev}
            className="inline-flex items-center rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400"
          >
            {ev}
          </span>
        ))}
        {webhook.hasSecret && (
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            🔑 secret
          </span>
        )}
      </div>

      {/* Row 4 — last triggered + controls */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {webhook.lastTriggeredAt ? (
          <span className="mr-auto text-[10.5px] text-muted-foreground/60">
            ล่าสุด: {relativeTime(webhook.lastTriggeredAt)}
          </span>
        ) : (
          <span className="mr-auto text-[10.5px] text-muted-foreground/40">ยังไม่ถูกเรียก</span>
        )}

        {/* Test button */}
        <button
          onClick={() => onTest(webhook.id)}
          disabled={testState === "loading"}
          className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-60 ${
            testState === "success"
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : testState === "error"
              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
              : "bg-muted/60 text-foreground hover:bg-muted"
          }`}
        >
          {testLabel}
        </button>

        {/* Toggle */}
        <Toggle
          checked={webhook.enabled}
          onChange={(v) => onToggle(webhook.id, v)}
          disabled={toggling}
        />

        {/* Delete */}
        <button
          onClick={() => onDelete(webhook.id, webhook.name)}
          className="rounded-md p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 dark:hover:text-rose-300 transition-colors"
          title="ลบ webhook"
          aria-label="ลบ webhook"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// ── Create form ───────────────────────────────────────────────────────────────

const CreateForm: React.FC<{
  onCreated: (webhook: Webhook) => void;
  onCancel: () => void;
}> = ({ onCreated, onCancel }) => {
  const [name, setName]       = useState("");
  const [url, setUrl]         = useState("");
  const [events, setEvents]   = useState<string[]>([]);
  const [secret, setSecret]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const toggleEvent = (value: string) => {
    setEvents((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError("ระบุชื่อ webhook"); return; }
    if (!url.trim())  { setError("ระบุ URL"); return; }
    if (!url.startsWith("https://")) { setError("URL ต้องขึ้นต้นด้วย https://"); return; }
    if (events.length === 0) { setError("เลือกอย่างน้อย 1 event"); return; }

    setSaving(true);
    try {
      const res = await fetch(`${BACKEND}/api/webhooks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          url,
          events,
          secret: secret || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "ไม่สามารถสร้าง webhook ได้"); return; }
      onCreated(data.webhook as Webhook);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2.5 rounded-xl border border-border/40 bg-muted/10 px-3 py-3"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
        สร้าง Webhook ใหม่
      </div>

      {error && (
        <div className="rounded-md bg-rose-500/10 px-2 py-1.5 text-[11.5px] text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Name */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-muted-foreground">ชื่อ</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Slack Webhook"
          className="rounded-md border border-border/40 bg-background px-2 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {/* URL */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-muted-foreground">URL (https:// เท่านั้น)</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hooks.example.com/..."
          className="rounded-md border border-border/40 bg-background px-2 py-1.5 text-[12.5px] text-foreground font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {/* Events */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-muted-foreground">Events (เลือกได้หลายอย่าง)</label>
        <div className="flex flex-col gap-1">
          {VALID_EVENTS.map(({ value, label }) => (
            <label
              key={value}
              className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1 hover:bg-muted/40 transition-colors"
            >
              <input
                type="checkbox"
                checked={events.includes(value)}
                onChange={() => toggleEvent(value)}
                className="h-3.5 w-3.5 rounded border-border accent-primary"
              />
              <span className="text-[12px] text-foreground">{label}</span>
              <span className="text-[10px] text-muted-foreground/60 font-mono">{value}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Secret (optional) */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-muted-foreground">Secret (ไม่บังคับ — สำหรับ HMAC signing)</label>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          className="rounded-md border border-border/40 bg-background px-2 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-0.5">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "กำลังสร้าง..." : "สร้าง Webhook"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md bg-muted/60 px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted transition-colors"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export default function WebhookPanel() {
  const [webhooks, setWebhooks]       = useState<Webhook[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [togglingId, setTogglingId]   = useState<string | null>(null);
  const [testStates, setTestStates]   = useState<Record<string, TestState>>({});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${BACKEND}/api/webhooks`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: { webhooks: Webhook[] }) => setWebhooks(d.webhooks ?? []))
      .catch(() => setError("ไม่สามารถโหลด webhooks ได้"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Test ──────────────────────────────────────────────────────────────────

  const handleTest = async (id: string) => {
    setTestStates((prev) => ({ ...prev, [id]: "loading" }));
    try {
      const res = await fetch(`${BACKEND}/api/webhooks/${id}/test`, {
        method: "POST",
        credentials: "include",
      });
      setTestStates((prev) => ({ ...prev, [id]: res.ok ? "success" : "error" }));
    } catch {
      setTestStates((prev) => ({ ...prev, [id]: "error" }));
    }
    // Reset after 3s
    setTimeout(() => {
      setTestStates((prev) => ({ ...prev, [id]: "idle" }));
    }, 3000);
  };

  // ── Toggle ────────────────────────────────────────────────────────────────

  const handleToggle = async (id: string, enabled: boolean) => {
    setTogglingId(id);
    try {
      const res = await fetch(`${BACKEND}/api/webhooks/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        const { webhook }: { webhook: Webhook } = await res.json();
        setWebhooks((prev) => prev.map((w) => (w.id === webhook.id ? webhook : w)));
      }
    } catch {
      // silently ignore
    } finally {
      setTogglingId(null);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ลบ webhook "${name}" ?`)) return;
    try {
      const res = await fetch(`${BACKEND}/api/webhooks/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setWebhooks((prev) => prev.filter((w) => w.id !== id));
      }
    } catch {
      // silently ignore
    }
  };

  // ── Create callback ───────────────────────────────────────────────────────

  const handleCreated = (webhook: Webhook) => {
    setWebhooks((prev) => [webhook, ...prev]);
    setShowCreate(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <span className="animate-pulse">กำลังโหลด...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <span className="text-3xl leading-none">⚠️</span>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={load}
          className="rounded-md bg-muted/60 px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          ลองอีกครั้ง
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          🔔 Webhooks ({webhooks.length})
        </span>
        <button
          onClick={() => setShowCreate((v) => !v)}
          title={showCreate ? "ยกเลิก" : "สร้าง webhook ใหม่"}
          className={`flex h-6 w-6 items-center justify-center rounded-md text-sm font-bold transition-colors ${
            showCreate
              ? "bg-muted text-muted-foreground hover:bg-muted/80"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          }`}
        >
          {showCreate ? "✕" : "+"}
        </button>
      </div>

      {/* Create form (collapsible) */}
      {showCreate && (
        <CreateForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
      )}

      {/* Webhook list */}
      {webhooks.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="text-4xl leading-none">🔔</span>
          <p className="text-sm text-muted-foreground">
            ยังไม่มี webhook — กด + เพื่อเพิ่มตัวแรก
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {webhooks.map((wh) => (
            <WebhookCard
              key={wh.id}
              webhook={wh}
              testState={testStates[wh.id] ?? "idle"}
              toggling={togglingId === wh.id}
              onTest={handleTest}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
