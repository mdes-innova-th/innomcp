"use client";

import React, { useState, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StoredCount {
  count: number;
  date: string; // new Date().toDateString()
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SESSION_KEY = "innomcp-request-count";
const MAX_DISPLAY = 50; // visual max for the progress bar (bar fills at 50+)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadCount(): number {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return 0;
    const stored: StoredCount = JSON.parse(raw);
    // Reset if the stored date differs from today
    if (stored.date !== new Date().toDateString()) return 0;
    return stored.count ?? 0;
  } catch {
    return 0;
  }
}

function saveCount(count: number): void {
  try {
    const stored: StoredCount = { count, date: new Date().toDateString() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  } catch {
    // ignore localStorage errors (private browsing, quota exceeded)
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const RateLimitIndicator: React.FC = () => {
  const [count, setCount] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  // Hydration-safe mount: read localStorage only on the client
  useEffect(() => {
    setMounted(true);
    setCount(loadCount());
  }, []);

  // Listen for request events dispatched by ChatPage on each message send
  useEffect(() => {
    const handler = () => {
      setCount((prev) => {
        const next = prev + 1;
        saveCount(next);
        return next;
      });
    };
    window.addEventListener("innomcp-request-sent", handler);
    return () => window.removeEventListener("innomcp-request-sent", handler);
  }, []);

  // Don't render until hydrated (avoids SSR mismatch)
  if (!mounted) return null;

  const pct = Math.min((count / MAX_DISPLAY) * 100, 100);

  return (
    <div className="flex flex-col gap-0.5 px-2 py-1">
      <div className="flex items-center justify-between text-[9.5px] text-muted-foreground/50">
        <span>Requests</span>
        <span className="tabular-nums">{count} today</span>
      </div>
      <div className="h-0.5 rounded-full bg-muted/30 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/40 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default RateLimitIndicator;
