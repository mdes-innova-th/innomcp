"use client";
import React from "react";

const TAG_COLORS = ["blue", "emerald", "amber", "rose", "purple", "cyan"] as const;
type TagColor = typeof TAG_COLORS[number];

// Full class strings so Tailwind JIT includes them in the build
const TAG_CLASS: Record<TagColor, string> = {
  blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose:    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  purple:  "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  cyan:    "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
};

function colorForTag(tag: string): TagColor {
  const idx = tag.charCodeAt(0) % TAG_COLORS.length;
  return TAG_COLORS[idx];
}

export default function TagBadge({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  const colorClass = TAG_CLASS[colorForTag(tag)];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${colorClass}`}
    >
      {tag}
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:opacity-70 ml-0.5 leading-none"
          aria-label={`Remove tag ${tag}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
