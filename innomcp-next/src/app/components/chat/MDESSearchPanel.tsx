"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  KeyboardEvent,
} from "react";
// Stubs until store modules exist
const useConversationStore = () => ({ summaries: [] as Array<{id:string;title:string;messages:unknown[]}> });
const useToolStore = () => ({ tools: [] as Array<{name:string;description:string}> });
const useModelStore = () => ({ models: [] as Array<{name:string;size?:number}> });

type SearchScope = "conversations" | "tools" | "models" | "all";

interface SearchResult {
  id: string;
  type: "conversation" | "tool" | "model" | "command";
  title: string;
  subtitle?: string;
  icon: string;
  action: () => void;
  relevance: number;
}

interface MDESSearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (result: SearchResult) => void;
  initialScope?: SearchScope;
}

const STORAGE_KEY = "mdes-search-history";
const MAX_HISTORY = 10;

export default function MDESSearchPanel({
  isOpen,
  onClose,
  onNavigate,
  initialScope = "all",
}: MDESSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [activeScope, setActiveScope] = useState<SearchScope>(initialScope);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const conversations = useConversationStore((state) => state.conversations);
  const tools = useToolStore((state) => state.tools);
  const models = useModelStore((state) => state.models);

  // Load search history on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSearchHistory(JSON.parse(stored));
      }
    } catch {}
  }, []);

  // Persist search history
  const updateHistory = useCallback((term: string) => {
    if (!term.trim()) return;
    setSearchHistory((prev) => {
      const filtered = prev.filter((item) => item !== term);
      const updated = [term, ...filtered].slice(0, MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Perform search based on scope and query
  const performSearch = useCallback(
    async (searchQuery: string, scope: SearchScope) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      const q = searchQuery.toLowerCase().trim();
      const scopeResults: SearchResult[] = [];

      // Helper: compute simple relevance (0-1) based on exact match boost
      const computeRelevance = (text: string, queryLower: string): number => {
        if (text.toLowerCase().includes(queryLower)) {
          return text.toLowerCase() === queryLower ? 1 : 0.6;
        }
        return 0;
      };

      // Conversations
      if (scope === "all" || scope === "conversations") {
        conversations.forEach((conv) => {
          const title = conv.title || "บทสนทนา";
          const subtitle = conv.summary || "";
          const relevance =
            Math.max(
              computeRelevance(title, q),
              subtitle ? computeRelevance(subtitle, q) : 0
            ) || 0.3; // base relevance
          if (relevance > 0) {
            scopeResults.push({
              id: `conv-${conv.id}`,
              type: "conversation",
              title,
              subtitle,
              icon: "💬",
              action: () => {
                // Navigate to conversation
                onNavigate?.({
                  id: `conv-${conv.id}`,
                  type: "conversation",
                  title,
                  subtitle,
                  icon: "💬",
                  action: () => {},
                  relevance,
                });
              },
              relevance,
            });
          }
        });
      }

      // Tools
      if (scope === "all" || scope === "tools") {
        tools.forEach((tool) => {
          const name = tool.name || "เครื่องมือ";
          const description = tool.description || "";
          const relevance =
            Math.max(
              computeRelevance(name, q),
              description ? computeRelevance(description, q) : 0
            ) || 0.3;
          if (relevance > 0) {
            scopeResults.push({
              id: `tool-${tool.name}`,
              type: "tool",
              title: name,
              subtitle: description,
              icon: "🔧",
              action: () => {
                onNavigate?.({
                  id: `tool-${tool.name}`,
                  type: "tool",
                  title: name,
                  subtitle: description,
                  icon: "🔧",
                  action: () => {},
                  relevance,
                });
              },
              relevance,
            });
          }
        });
      }

      // Models
      if (scope === "all" || scope === "models") {
        models.forEach((model) => {
          const name = model.name || "โมเดล";
          const description = model.description || "";
          const relevance =
            Math.max(
              computeRelevance(name, q),
              description ? computeRelevance(description, q) : 0
            ) || 0.3;
          if (relevance > 0) {
            scopeResults.push({
              id: `model-${model.name}`,
              type: "model",
              title: name,
              subtitle: description,
              icon: "🤖",
              action: () => {
                onNavigate?.({
                  id: `model-${model.name}`,
                  type: "model",
                  title: name,
                  subtitle: description,
                  icon: "🤖",
                  action: () => {},
                  relevance,
                });
              },
              relevance,
            });
          }
        });
      }

      // Sort by relevance descending
      scopeResults.sort((a, b) => b.relevance - a.relevance);
      setResults(scopeResults);
      setIsLoading(false);
      setSelectedIndex(-1);
    },
    [conversations, tools, models, onNavigate]
  );

  // Debounced search effect
  const debouncedSearch = useCallback(
    (value: string, scope: SearchScope) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        performSearch(value, scope);
      }, 150);
    },
    [performSearch]
  );

  useEffect(() => {
    debouncedSearch(query, activeScope);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeScope, debouncedSearch]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: GlobalKeyEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);
  type GlobalKeyEvent = KeyboardEvent;

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset when panel closes
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => {
          if (results.length === 0) return -1;
          if (prev >= results.length - 1) return 0; // wrap
          return prev + 1;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => {
          if (results.length === 0) return -1;
          if (prev <= 0) return results.length - 1; // wrap to last
          return prev - 1;
        });
        break;
      case "Enter":
        e.preventDefault();
        if (results.length > 0) {
          const index = selectedIndex >= 0 ? selectedIndex : 0;
          const selected = results[index];
          if (selected) {
            updateHistory(query);
            selected.action();
            onClose();
          }
        } else if (query.trim()) {
          // If no results but query exists, record history and maybe trigger external search
          updateHistory(query);
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  };

  // Scope tabs definition
  const scopeTabs: { key: SearchScope; label: string }[] = [
    { key: "all", label: "ทั้งหมด" },
    { key: "conversations", label: "บทสนทนา" },
    { key: "tools", label: "เครื่องมือ" },
    { key: "models", label: "โมเดล" },
  ];

  // Empty state messages per scope
  const emptyStateMessages: Record<SearchScope, string> = {
    all: "พิมพ์เพื่อค้นหาข้อมูลทั้งหมด...",
    conversations: "ไม่พบบทสนทนาที่ตรงกับคำค้นหา",
    tools: "ไม่พบเครื่องมือที่ตรงกับคำค้นหา",
    models: "ไม่พบโมเดลที่ตรงกับคำค้นหา",
  };

  // When query is empty and there's history, show recent searches
  const showRecent = query.trim().length === 0 && searchHistory.length > 0;
  // When query empty and no history, show per-scope placeholder
  const showEmptyHint =
    query.trim().length === 0 && searchHistory.length === 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
        {/* Search input */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ค้นหาใน INNOMCP..."
              className="w-full pl-10 pr-4 py-3 text-lg bg-transparent border-0 focus:outline-none focus:ring-0 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-gray-100"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/* Scope tabs */}
          <div className="flex gap-1 mt-3">
            {scopeTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveScope(tab.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  activeScope === tab.key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results area */}
        <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
          {isLoading && (
            <div className="p-8 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
              <p className="mt-2">กำลังค้นหา...</p>
            </div>
          )}

          {!isLoading && showRecent && (
            <div className="p-2">
              <h3 className="px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                ค้นหาล่าสุด
              </h3>
              <ul>
                {searchHistory.map((item, idx) => (
                  <li key={idx}>
                    <button
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm transition"
                      onClick={() => {
                        setQuery(item);
                        inputRef.current?.focus();
                      }}
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!isLoading && showEmptyHint && (
            <div className="p-8 text-center text-gray-400">
              <p>{emptyStateMessages[activeScope]}</p>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <>
              {query.trim().length > 0 && (
                <h3 className="px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  ผลการค้นหา ({results.length})
                </h3>
              )}
              <ul ref={listRef} role="listbox">
                {results.map((result, index) => (
                  <li
                    key={result.id}
                    role="option"
                    aria-selected={index === selectedIndex}
                    className={`px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      index === selectedIndex
                        ? "bg-blue-50 dark:bg-blue-900/40 ring-1 ring-blue-200 dark:ring-blue-700"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                    onClick={() => {
                      updateHistory(query);
                      result.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl flex-shrink-0">
                        {result.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {result.title}
                        </p>
                        {result.subtitle && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {result.subtitle}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 font-mono uppercase hidden sm:inline">
                        {result.type === "conversation"
                          ? "สนทนา"
                          : result.type === "tool"
                          ? "เครื่องมือ"
                          : result.type === "model"
                          ? "โมเดล"
                          : "คำสั่ง"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {!isLoading &&
            !showRecent &&
            !showEmptyHint &&
            results.length === 0 &&
            query.trim().length > 0 && (
              <div className="p-8 text-center text-gray-400">
                <p>ไม่พบผลลัพธ์สำหรับ &quot;{query}&quot;</p>
                {activeScope !== "all" && (
                  <button
                    onClick={() => setActiveScope("all")}
                    className="mt-2 text-blue-600 hover:underline text-sm"
                  >
                    ลองค้นหาทั้งหมด
                  </button>
                )}
              </div>
            )}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 flex justify-between">
          <span>↑↓ เลือก</span>
          <span>↵ เปิด</span>
          <span>Esc ปิด</span>
        </div>
      </div>
    </div>
  );
}