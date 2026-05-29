"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PresenceUser {
  userId: string;
  displayName: string;
  connectedAt: string;
  lastPingAt: string;
}

interface PresenceData {
  projectId: number;
  count: number;
  users: PresenceUser[];
}

interface Props {
  projectId: number | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_SHOWN = 5;
const FETCH_INTERVAL_MS = 30_000;
const PING_INTERVAL_MS  = 25_000;
const STALE_THRESHOLD_MS = 35_000;

// Stable color palette — index derived from userId
const BUBBLE_COLORS = [
  "bg-sky-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getBubbleColor(userId: string): string {
  const code = userId ? userId.charCodeAt(0) : 0;
  return BUBBLE_COLORS[code % BUBBLE_COLORS.length];
}

function relativeSeconds(isoString: string): string {
  const diffMs  = Math.max(0, Date.now() - new Date(isoString).getTime());
  const diffSec = Math.floor(diffMs / 1_000);
  const diffMin = Math.floor(diffSec / 60);
  if (diffSec < 60)  return `${diffSec}s ago`;
  if (diffMin < 60)  return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

function isActive(lastPingAt: string): boolean {
  return Date.now() - new Date(lastPingAt).getTime() < STALE_THRESHOLD_MS;
}

// ─── Component ───────────────────────────────────────────────────────────────

const UserPresence: React.FC<Props> = ({ projectId }) => {
  const [presence, setPresence] = useState<PresenceData | null>(null);
  // Track tooltip open state per user index
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPresence = useCallback(async () => {
    if (projectId === null) return;
    try {
      const res = await fetch(`/api/presence/${projectId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data: PresenceData = await res.json();
        setPresence(data);
      }
    } catch {
      // silently ignore network errors
    }
  }, [projectId]);

  const postPing = useCallback(async () => {
    if (projectId === null) return;
    try {
      await fetch(`/api/presence/${projectId}/ping`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // silently ignore
    }
  }, [projectId]);

  // Fetch presence on mount and every 30s
  useEffect(() => {
    if (projectId === null) {
      setPresence(null);
      return;
    }
    fetchPresence();
    const id = setInterval(fetchPresence, FETCH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [projectId, fetchPresence]);

  // Ping immediately on mount then every 25s
  useEffect(() => {
    if (projectId === null) return;
    postPing();
    const id = setInterval(postPing, PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, [projectId, postPing]);

  // Cleanup tooltip timer on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    };
  }, []);

  if (projectId === null || presence === null) return null;

  const visibleUsers = presence.users.slice(0, MAX_SHOWN);
  const overflow     = presence.count > MAX_SHOWN ? presence.count - MAX_SHOWN : 0;

  return (
    <div
      className="flex items-center gap-0.5 h-8"
      aria-label={`${presence.count} active user${presence.count !== 1 ? "s" : ""}`}
      role="status"
    >
      {visibleUsers.map((user, i) => {
        const active  = isActive(user.lastPingAt);
        const color   = getBubbleColor(user.userId);
        const initials = getInitials(user.displayName);

        return (
          <div
            key={user.userId}
            className="relative"
            onMouseEnter={() => {
              if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
              setTooltipIndex(i);
            }}
            onMouseLeave={() => {
              tooltipTimerRef.current = setTimeout(() => setTooltipIndex(null), 150);
            }}
          >
            {/* Avatar bubble */}
            <div
              className={`relative flex h-7 w-7 shrink-0 cursor-default items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm ring-2 ring-background transition-transform hover:scale-110 ${color}`}
            >
              {initials}
              {/* Status dot */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
                  active ? "bg-emerald-500" : "bg-gray-400 dark:bg-gray-600"
                }`}
              />
            </div>

            {/* Tooltip */}
            {tooltipIndex === i && (
              <div
                className="absolute bottom-full left-1/2 z-[100] mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border/60 bg-popover px-2.5 py-1.5 shadow-lg"
                role="tooltip"
              >
                <div className="text-[12px] font-semibold text-foreground leading-tight">
                  {user.displayName}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      active ? "bg-emerald-500" : "bg-gray-400"
                    }`}
                  />
                  <span>
                    {active ? `active ${relativeSeconds(user.lastPingAt)}` : "inactive"}
                  </span>
                </div>
                {/* Arrow */}
                <div className="absolute left-1/2 top-full -mt-px -translate-x-1/2 border-4 border-transparent border-t-border/60" />
                <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-popover" />
              </div>
            )}
          </div>
        );
      })}

      {/* Overflow badge */}
      {overflow > 0 && (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted text-[10px] font-semibold text-muted-foreground shadow-sm"
          title={`${overflow} more active user${overflow !== 1 ? "s" : ""}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};

export default UserPresence;
