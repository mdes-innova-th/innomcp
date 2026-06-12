"use client";
import React, { useState, useEffect, useCallback } from "react";

interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  type: string;
}

const BACKEND =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:3015"
    : "";

// ── Type label / colours ─────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string }> = {
  tool:     { label: "Tool",     color: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  provider: { label: "Provider", color: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  ui:       { label: "UI",       color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  webhook:  { label: "Webhook",  color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
};

function typeMeta(type: string) {
  return TYPE_META[type] ?? { label: type, color: "bg-muted/40 text-muted-foreground" };
}

// ── Toggle switch ────────────────────────────────────────────────────────────

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

// ── Plugin row ────────────────────────────────────────────────────────────────

const PluginRow: React.FC<{
  plugin: Plugin;
  onToggle: (id: string, enabled: boolean) => void;
  toggling: boolean;
}> = ({ plugin, onToggle, toggling }) => {
  const { label, color } = typeMeta(plugin.type);
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 transition-colors hover:border-border">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-semibold text-foreground leading-snug">
            {plugin.name}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${color}`}
          >
            {label}
          </span>
          <span className="text-[10px] text-muted-foreground/60 font-mono">
            v{plugin.version}
          </span>
        </div>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
          {plugin.description}
        </p>
      </div>
      <Toggle
        checked={plugin.enabled}
        onChange={(v) => onToggle(plugin.id, v)}
        disabled={toggling}
      />
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const GROUP_ORDER = ["tool", "provider", "ui", "webhook"];
const GROUP_LABELS: Record<string, string> = {
  tool:     "Tools",
  provider: "Providers",
  ui:       "UI",
  webhook:  "Webhooks",
};

export default function PluginPanel() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${BACKEND}/api/plugins`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: { plugins: Plugin[] }) => setPlugins(d.plugins ?? []))
      .catch(() => setError("ไม่สามารถโหลด plugins ได้"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id: string, enabled: boolean) => {
    setTogglingId(id);
    try {
      const res = await fetch(`${BACKEND}/api/plugins/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        const { plugin }: { plugin: Plugin } = await res.json();
        setPlugins((prev) =>
          prev.map((p) => (p.id === plugin.id ? plugin : p))
        );
      }
    } catch {
      // silently ignore — state stays optimistic
    } finally {
      setTogglingId(null);
    }
  };

  // Group by type
  const grouped = GROUP_ORDER.reduce<Record<string, Plugin[]>>((acc, type) => {
    const items = plugins.filter((p) => p.type === type);
    if (items.length) acc[type] = items;
    return acc;
  }, {});
  // Catch any unrecognised types
  const knownTypes = new Set(GROUP_ORDER);
  plugins.forEach((p) => {
    if (!knownTypes.has(p.type)) {
      grouped[p.type] = [...(grouped[p.type] ?? []), p];
    }
  });

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

  if (plugins.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <span className="text-4xl leading-none">🔌</span>
        <p className="text-sm text-muted-foreground">
          ยังไม่มี plugin — เพิ่ม plugin เพื่อขยายความสามารถ
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(grouped).map(([type, items]) => (
        <section key={type}>
          <div className="mb-1.5 px-0.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            {GROUP_LABELS[type] ?? type}
          </div>
          <div className="flex flex-col gap-1.5">
            {items.map((plugin) => (
              <PluginRow
                key={plugin.id}
                plugin={plugin}
                onToggle={handleToggle}
                toggling={togglingId === plugin.id}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
