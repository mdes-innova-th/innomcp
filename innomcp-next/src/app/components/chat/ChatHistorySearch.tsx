'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';

// ---------- Interfaces ----------

interface ChatHistorySummary {
  id: string;
  title: string;
  messages: Array<{
    sender: 'user' | 'ai';
    text: string;
    timestamp?: number;
  }>;
  createdAt?: number;
}

interface ChatHistorySearchProps {
  summaries: ChatHistorySummary[];
  onSelect: (summaryId: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

// ---------- Helpers ----------

function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Format a timestamp (ms) to a readable Thai date (DD/MM/YYYY) */
function formatDate(ts: number): string {
  const date = new Date(ts);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Group summaries by date string */
function groupByDate(
  items: Array<{ summary: ChatHistorySummary; matchedMessage?: string }>,
): Map<string, typeof items> {
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const date =
      item.summary.createdAt ??
      item.summary.messages[0]?.timestamp ??
      Date.now();
    const key = formatDate(date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return groups;
}

/** Highlight search terms in text */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-700 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

// ---------- Component ----------

export default function ChatHistorySearch({
  summaries,
  onSelect,
  onClose,
  isOpen,
}: ChatHistorySearchProps) {
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState<
    Array<{ summary: ChatHistorySummary; matchedMessage?: string }>
  >([]);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce search (300ms)
  const debouncedSearch = useCallback(
    debounce((q: string) => {
      if (!q.trim()) {
        setFiltered([]);
        return;
      }
      const lowerQ = q.toLowerCase();
      const results: Array<{
        summary: ChatHistorySummary;
        matchedMessage?: string;
      }> = [];

      for (const summary of summaries) {
        let matchedMessage: string | undefined;

        // Search title
        if (summary.title.toLowerCase().includes(lowerQ)) {
          matchedMessage = undefined; // no specific message, title matches
        } else {
          // Search messages
          for (const msg of summary.messages) {
            if (msg.text.toLowerCase().includes(lowerQ)) {
              matchedMessage = msg.text;
              break; // take first match
            }
          }
        }

        if (matchedMessage !== undefined || summary.title.toLowerCase().includes(lowerQ)) {
          results.push({ summary, matchedMessage });
        }
      }

      setFiltered(results);
      setHighlightIndex(0);
    }, 300),
    [summaries],
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;
      const total = filtered.length;
      if (total === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightIndex((prev) => (prev + 1) % total);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightIndex((prev) => (prev - 1 + total) % total);
          break;
        case 'Enter':
          e.preventDefault();
          if (filtered[highlightIndex]) {
            onSelect(filtered[highlightIndex].summary.id);
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, filtered, highlightIndex, onSelect, onClose],
  );

  // Scroll into view on highlight change
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>('[data-index]');
    const target = items[highlightIndex];
    if (target) {
      target.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
    }
  }, [isOpen]);

  // Group results by date
  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <>
      {/* Overlay backdrop (click to close) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-down panel */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 shadow-2xl border-b border-gray-200 dark:border-gray-700 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-y-0' : '-translate-y-full'
        }`}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-label="ค้นหาประวัติการสนทนา"
        aria-modal={isOpen}
      >
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          {/* Search input */}
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาบทสนทนา..."
              className="w-full px-4 py-3 pl-10 pr-12 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              disabled={!isOpen}
            />
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
            <button
              onClick={onClose}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="ปิด"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Results */}
          <div
            ref={listRef}
            className="max-h-80 overflow-y-auto space-y-2"
            role="listbox"
            aria-label="ผลการค้นหา"
          >
            {filtered.length === 0 && query.trim() ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                ไม่พบผลลัพธ์
              </div>
            ) : (
              Array.from(grouped.entries()).map(([date, items]) => (
                <div key={date}>
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 py-1">
                    {date}
                  </div>
                  {items.map((item, index) => {
                    const globalIndex = Array.from(grouped.values())
                      .flat()
                      .indexOf(item);
                    const isHighlighted = globalIndex === highlightIndex;
                    const { summary, matchedMessage } = item;

                    return (
                      <div
                        key={summary.id}
                        data-index={globalIndex}
                        role="option"
                        aria-selected={isHighlighted}
                        className={`px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          isHighlighted
                            ? 'bg-blue-100 dark:bg-blue-900/40 ring-1 ring-blue-400'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        onClick={() => {
                          onSelect(summary.id);
                          onClose();
                        }}
                        onMouseEnter={() => setHighlightIndex(globalIndex)}
                      >
                        <div className="font-medium text-gray-900 dark:text-white text-sm">
                          {highlightText(summary.title, query)}
                        </div>
                        {matchedMessage && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                            {highlightText(
                              matchedMessage.length > 100
                                ? matchedMessage.slice(0, 100) + '…'
                                : matchedMessage,
                              query,
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Keyboard hints */}
          <div className="text-xs text-gray-400 dark:text-gray-500 flex gap-4 justify-center pb-2">
            <span>↑↓ เลือก</span>
            <span>↵ เปิด</span>
            <span>Esc ปิด</span>
          </div>
        </div>
      </div>
    </>
  );
}