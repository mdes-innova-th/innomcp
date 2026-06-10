"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  KeyboardEvent,
  MouseEvent,
} from "react";

// ---------- Types ----------
interface OllamaModel {
  name: string;
  size: string; // bytes as string from API
  modified_at: string;
}

interface CachedModels {
  data: OllamaModel[];
  timestamp: number;
}

interface MDESModelPickerProps {
  currentModel: string;
  onModelChange: (model: string) => void;
  className?: string;
}

// ---------- Helpers ----------
const MDES_OLLAMA_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "https://ollama.mdes-innova.online";

function extractParamSize(modelName: string): string | null {
  // extract something like "7b", "26B", "13b", "70b" from the model name
  const match = modelName.match(/(\d+\.?\d*)\s*[bB]/);
  return match ? match[0] : null;
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
}

const CACHE_KEY = "mdes_ollama_models_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ---------- Component ----------
export default function MDESModelPicker({
  currentModel,
  onModelChange,
  className = "",
}: MDESModelPickerProps) {
  // ---- state ----
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  // refs
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // ---- fetch with cache ----
  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);

    // try cache
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CachedModels = JSON.parse(cached);
        const now = Date.now();
        if (now - parsed.timestamp < CACHE_TTL && Array.isArray(parsed.data)) {
          setModels(parsed.data);
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore corrupt cache
    }

    // actual fetch
    try {
      const res = await fetch(`${MDES_OLLAMA_URL}/api/tags`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data: OllamaModel[] = json.models ?? [];
      setModels(data);

      // store cache
      const cacheEntry: CachedModels = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry));
    } catch (err: any) {
      console.error("Failed to load MDES Ollama models:", err);
      setError("ไม่สามารถโหลดได้");
    } finally {
      setLoading(false);
    }
  }, []);

  // preload on mount
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // ---- derived data ----
  const filteredModels = models.filter((m) =>
    m.name.toLowerCase().includes(filter.toLowerCase())
  );

  // reset highlight when filter changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [filter]);

  // ---- dropdown handlers ----
  const toggleOpen = () => {
    setIsOpen((prev) => {
      if (!prev) {
        // opening: focus filter input after a tick
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      return !prev;
    });
  };

  const close = () => setIsOpen(false);

  // close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | Event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", handleClickOutside as any);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside as any);
  }, [isOpen]);

  // close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    const max = filteredModels.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => (prev < max ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : max));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredModels.length > 0 && highlightIndex >= 0) {
          const selected = filteredModels[highlightIndex];
          onModelChange(selected.name);
          close();
        }
        break;
      default:
        break;
    }
    // scroll item into view
    if (listRef.current) {
      const items = listRef.current.children;
      if (items[highlightIndex]) {
        items[highlightIndex].scrollIntoView({ block: "nearest" });
      }
    }
  };

  const handleSelect = (modelName: string) => {
    onModelChange(modelName);
    close();
  };

  const handleRetry = () => {
    fetchModels();
  };

  // ---- render ----
  const indicatorColor = loading
    ? "bg-gray-400"
    : error
    ? "bg-red-500"
    : "bg-green-500";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Button */}
      <button
        onClick={toggleOpen}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-gray-50 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="font-medium text-gray-800 max-w-[140px] truncate">
          {truncate(currentModel, 16)}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full animate-pulse ${
                  loading ? "bg-gray-400" : "bg-green-500"
                }`}
              ></span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                MDES Ollama Models
              </span>
              <span className="text-xs text-gray-400">
                ({models.length})
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fetchModels();
              }}
              className="text-xs text-gray-400 hover:text-indigo-600 flex items-center gap-1"
              title="Refresh"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Refresh</span>
            </button>
          </div>

          {/* Filter */}
          <div className="px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ค้นหาโมเดล..."
              className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
              aria-label="Search models"
            />
          </div>

          {/* Content */}
          <div className="max-h-48 overflow-y-auto">
            {loading && !error && (
              <div className="p-3 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse flex space-x-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  </div>
                ))}
              </div>
            )}

            {error && !loading && (
              <div className="p-4 text-center text-sm text-red-500">
                <p className="mb-2">ไม่สามารถโหลดได้</p>
                <button
                  onClick={handleRetry}
                  className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                >
                  ลองใหม่
                </button>
              </div>
            )}

            {!loading && !error && filteredModels.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-400">
                ไม่พบโมเดลที่ตรงกับ "{filter}"
              </div>
            )}

            {!loading &&
              !error &&
              filteredModels.length > 0 && (
                <ul
                  ref={listRef}
                  role="listbox"
                  className="py-1"
                >
                  {filteredModels.map((model, idx) => {
                    const isSelected = currentModel === model.name;
                    const isHighlighted = idx === highlightIndex;
                    const paramSize = extractParamSize(model.name);
                    const sizeDisplay = model.size
                      ? `${(parseInt(model.size) / 1e9).toFixed(1)} GB`
                      : null;
                    return (
                      <li
                        key={model.name}
                        role="option"
                        aria-selected={isSelected}
                        className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm ${
                          isHighlighted
                            ? "bg-indigo-50 text-indigo-900"
                            : isSelected
                            ? "bg-gray-50"
                            : "hover:bg-gray-50"
                        }`}
                        onClick={() => handleSelect(model.name)}
                        onMouseEnter={() => setHighlightIndex(idx)}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="truncate font-mono text-xs">
                            {model.name}
                          </span>
                          {paramSize && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 uppercase">
                              {paramSize}
                            </span>
                          )}
                        </div>
                        {sizeDisplay && (
                          <span className="text-xs text-gray-400 shrink-0 ml-2">
                            {sizeDisplay}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
          </div>
        </div>
      )}
    </div>
  );
}