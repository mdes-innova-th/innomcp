"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Backend URL — matches pattern used across this codebase ──────────────────
const BACKEND =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:3011"
    : "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  title: string;
  status?: string;
  created_at: string;
  result_type: "task" | "artifact";
}

interface Props {
  onNavigate?: (result: SearchResult) => void;
  placeholder?: string;
}

// ─── Status badge colour ──────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  running: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  failed: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

// ─── SearchBar ────────────────────────────────────────────────────────────────

export default function SearchBar({
  onNavigate,
  placeholder = "ค้นหางานทั้งหมด...",
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch results with 300ms debounce ──────────────────────────────────────
  const fetchResults = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q || q.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${BACKEND}/api/search?q=${encodeURIComponent(q)}&type=all&limit=10`,
          { credentials: "include" }
        );
        const data = await res.json();
        const items: SearchResult[] = Array.isArray(data.results)
          ? data.results
          : [];
        setResults(items);
        setOpen(true);
        setActiveIndex(-1);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    fetchResults(query);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchResults]);

  // ── Click outside to close ─────────────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Navigation helper ──────────────────────────────────────────────────────
  const navigateTo = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setQuery("");
      if (onNavigate) {
        onNavigate(result);
      } else {
        if (result.result_type === "task") {
          router.push(`/tasks/${result.id}`);
        }
      }
    },
    [onNavigate, router]
  );

  // ── Keyboard: Escape / ArrowUp / ArrowDown / Enter ────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setQuery("");
      setResults([]);
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      navigateTo(results[activeIndex]);
    }
  }

  // ── Group results by type ──────────────────────────────────────────────────
  const taskResults = results.filter((r) => r.result_type === "task");

  return (
    <div className="relative w-full">
      {/* Input */}
      <div className="relative flex items-center">
        <span className="absolute left-3 text-muted-foreground text-[14px] pointer-events-none select-none">
          🔍
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          className="w-full rounded-xl border border-border/40 bg-background pl-9 pr-8 py-2 text-[12.5px] text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60 transition-colors"
          aria-label="ค้นหา"
          aria-autocomplete="list"
          aria-expanded={open}
          role="combobox"
        />
        {loading && (
          <span className="absolute right-3 text-[11px] text-muted-foreground animate-pulse">
            ...
          </span>
        )}
        {!loading && query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 text-muted-foreground hover:text-foreground text-[14px] leading-none"
            aria-label="ล้างการค้นหา"
            tabIndex={-1}
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          role="listbox"
          className="absolute z-50 mt-1.5 w-full rounded-xl border border-border/40 bg-background shadow-lg overflow-hidden"
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-[12px] text-muted-foreground text-center">
              ไม่พบผลลัพธ์สำหรับ &ldquo;{query}&rdquo;
            </div>
          ) : (
            <>
              {taskResults.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider border-b border-border/20 bg-muted/5">
                    งาน
                  </div>
                  {taskResults.map((result, idx) => {
                    const isActive = activeIndex === idx;
                    return (
                      <button
                        key={result.id}
                        role="option"
                        aria-selected={isActive}
                        onClick={() => navigateTo(result)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors ${
                          isActive
                            ? "bg-muted/40"
                            : "hover:bg-muted/20"
                        }`}
                      >
                        {result.status && (
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                              STATUS_STYLE[result.status] ??
                              "bg-muted/40 text-muted-foreground"
                            }`}
                          >
                            {result.status}
                          </span>
                        )}
                        <span className="flex-1 truncate text-[12px] text-foreground">
                          {result.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground/50">
                          {new Date(result.created_at).toLocaleDateString(
                            "th-TH",
                            { day: "numeric", month: "short" }
                          )}
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
