"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserPreferences {
  userId: string;
  theme: "light" | "dark" | "system";
  language: "th" | "en";
  fontSize: "sm" | "md" | "lg";
  chatMode: "local" | "remote" | "hybrid";
  showTimestamps: boolean;
  compactMode: boolean;
  updatedAt: string;
}

interface Props {
  onClose?: () => void;
}

// ─── Backend URL (same pattern as MemoryManager) ──────────────────────────────

const BACKEND =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:3011"
    : "";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="my-3 border-t border-border/40" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PreferencesPanel({ onClose }: Props) {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BACKEND}/api/preferences`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.preferences) setPrefs(d.preferences); })
      .catch(() => {});
  }, []);

  // ── Auto-save (debounced 500ms) ──────────────────────────────────────────
  const persist = useCallback((patch: Partial<UserPreferences>) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`${BACKEND}/api/preferences`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (r.ok) {
          const d = await r.json();
          if (d.preferences) setPrefs(d.preferences);
          setSaved(true);
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => setSaved(false), 2000);
        }
      } catch {
        // silently ignore — next change will retry
      }
    }, 500);
  }, []);

  const update = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPrefs((prev) => {
        if (!prev) return prev;
        const next = { ...prev, [key]: value };
        persist({ [key]: value });
        return next;
      });
    },
    [persist]
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  if (!prefs) {
    return (
      <div className="flex items-center justify-center py-12 text-[12px] text-muted-foreground">
        กำลังโหลด...
      </div>
    );
  }

  // ─── Radio group helper ──────────────────────────────────────────────────
  function RadioGroup<T extends string>({
    options,
    value,
    onChange,
    testIdPrefix,
  }: {
    options: { label: string; value: T }[];
    value: T;
    onChange: (v: T) => void;
    testIdPrefix?: string;
  }) {
    return (
      <div className="flex gap-1.5 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            data-testid={testIdPrefix ? `${testIdPrefix}-${opt.value}` : undefined}
            className={`rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
              value === opt.value
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border/40 bg-background text-foreground/70 hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  // ─── Toggle helper ───────────────────────────────────────────────────────
  function Toggle({
    checked,
    onChange,
    testId,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    testId?: string;
  }) {
    return (
      <button
        role="switch"
        aria-checked={checked}
        data-testid={testId}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-0 p-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-semibold text-foreground">
          ⚙️ การตั้งค่า
        </p>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400 animate-fade-in">
              บันทึกแล้ว ✓
            </span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground/60 hover:text-foreground"
              aria-label="Close preferences panel"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Display section ── */}
      <SectionHeading>การแสดงผล</SectionHeading>

      <div className="flex flex-col gap-3 rounded-lg border border-border/40 p-2.5 mb-0">
        {/* Theme */}
        <div>
          <p className="text-[11px] font-medium text-foreground mb-1.5">ธีม</p>
          <RadioGroup
            options={[
              { label: "สว่าง", value: "light" as const },
              { label: "มืด", value: "dark" as const },
              { label: "ระบบ", value: "system" as const },
            ]}
            value={prefs.theme}
            onChange={(v) => update("theme", v)}
            testIdPrefix="pref-theme"
          />
        </div>

        {/* Font size */}
        <div>
          <p className="text-[11px] font-medium text-foreground mb-1.5">ขนาดตัวอักษร</p>
          <RadioGroup
            options={[
              { label: "เล็ก", value: "sm" as const },
              { label: "กลาง", value: "md" as const },
              { label: "ใหญ่", value: "lg" as const },
            ]}
            value={prefs.fontSize}
            onChange={(v) => update("fontSize", v)}
            testIdPrefix="pref-fontsize"
          />
        </div>
      </div>

      <Divider />

      {/* ── Language section ── */}
      <SectionHeading>ภาษา</SectionHeading>

      <div className="rounded-lg border border-border/40 p-2.5 mb-0">
        <RadioGroup
          options={[
            { label: "ไทย 🇹🇭", value: "th" as const },
            { label: "English 🇬🇧", value: "en" as const },
          ]}
          value={prefs.language}
          onChange={(v) => update("language", v)}
          testIdPrefix="pref-lang"
        />
      </div>

      <Divider />

      {/* ── Chat section ── */}
      <SectionHeading>แชท</SectionHeading>

      <div className="flex flex-col gap-3 rounded-lg border border-border/40 p-2.5">
        {/* Chat mode */}
        <div>
          <p className="text-[11px] font-medium text-foreground mb-1.5">Chat Mode</p>
          <RadioGroup
            options={[
              { label: "Local", value: "local" as const },
              { label: "Remote", value: "remote" as const },
              { label: "Hybrid", value: "hybrid" as const },
            ]}
            value={prefs.chatMode}
            onChange={(v) => update("chatMode", v)}
            testIdPrefix="pref-chatmode"
          />
        </div>

        {/* Compact mode */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-foreground">โหมดกระชับ</p>
            <p className="text-[10px] text-muted-foreground">ลดระยะห่างระหว่างข้อความ</p>
          </div>
          <Toggle
            checked={prefs.compactMode}
            onChange={(v) => update("compactMode", v)}
            testId="pref-compact-toggle"
          />
        </div>

        {/* Show timestamps */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-foreground">แสดงเวลา</p>
            <p className="text-[10px] text-muted-foreground">แสดงเวลาใต้แต่ละข้อความ</p>
          </div>
          <Toggle
            checked={prefs.showTimestamps}
            onChange={(v) => update("showTimestamps", v)}
            testId="pref-timestamps-toggle"
          />
        </div>
      </div>

      {/* Last saved timestamp */}
      {prefs.updatedAt && (
        <p className="mt-3 text-[9.5px] text-muted-foreground/40 text-right">
          อัปเดตล่าสุด:{" "}
          {new Date(prefs.updatedAt).toLocaleString("th-TH", {
            timeZone: "Asia/Bangkok",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
