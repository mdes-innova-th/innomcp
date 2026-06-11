'use client';

import { useEffect, useRef, useState } from 'react';

interface QuickReplyChipsProps {
  /** Array of suggestion strings */
  suggestions: string[];
  /** Callback when a chip is clicked */
  onSelect: (s: string) => void;
  /** Max number of chips to display (default: 4) */
  maxShow?: number;
  /** Additional classes for the outer container */
  className?: string;
}

const MAX_CHARS = 60;

export default function QuickReplyChips({
  suggestions,
  onSelect,
  maxShow = 4,
  className,
}: QuickReplyChipsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  // Slice to first maxShow suggestions
  const visibleSuggestions = suggestions.slice(0, maxShow);

  // Update fade visibility based on scroll capacity & position
  const updateFade = () => {
    const el = scrollRef.current;
    if (!el) return;
    const canScroll = el.scrollWidth > el.clientWidth;
    const isAtEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
    setShowFade(canScroll && !isAtEnd);
  };

  useEffect(() => {
    updateFade();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateFade, { passive: true });
    window.addEventListener('resize', updateFade);
    return () => {
      el.removeEventListener('scroll', updateFade);
      window.removeEventListener('resize', updateFade);
    };
  }, [visibleSuggestions]);

  if (visibleSuggestions.length === 0) return null;

  return (
    <div
      className={`relative overflow-x-auto pr-8 ${className ?? ''}`}
      style={{ scrollbarWidth: 'none' }}
    >
      {/* Scrollable chips container */}
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto py-2
                   [&::-webkit-scrollbar]:hidden
                   [-ms-overflow-style:none]
                   [scrollbar-width:none]"
      >
        {visibleSuggestions.map((suggestion, index) => {
          const truncated =
            suggestion.length > MAX_CHARS
              ? suggestion.slice(0, MAX_CHARS) + '...'
              : suggestion;
          return (
            <button
              key={`${index}-${truncated}`}
              type="button"
              onClick={() => onSelect(suggestion)}
              className="inline-flex max-w-[15rem] shrink-0 items-center rounded-full
                         bg-white px-4 py-1.5 text-sm font-medium text-gray-700
                         shadow-sm ring-1 ring-inset ring-gray-200
                         transition-colors hover:bg-gray-50 hover:ring-gray-300
                         focus:outline-none focus:ring-2 focus:ring-indigo-500
                         truncate"
              title={suggestion}
            >
              {truncated}
            </button>
          );
        })}
      </div>

      {/* Right fade gradient – shown only when scrollable to the right */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute right-0 top-0 h-full w-8
                    bg-gradient-to-l from-white via-white/80 to-transparent
                    transition-opacity duration-200
                    ${showFade ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}