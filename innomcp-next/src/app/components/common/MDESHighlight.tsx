"use client";

import React, { useMemo } from "react";

interface MDESHighlightProps {
  /** The full text to display */
  text: string;
  /** The substring to highlight */
  highlight: string;
  /** Optional custom Tailwind classes for the <mark> element */
  highlightClassName?: string;
  /** Whether the match should be case‑sensitive (default: false) */
  caseSensitive?: boolean;
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const defaultHighlightClasses =
  "bg-yellow-200 text-yellow-900 dark:bg-yellow-700 dark:text-yellow-100";

/**
 * Splits `text` into segments, indicating which parts should be highlighted.
 */
function useHighlightSegments(
  text: string,
  highlight: string,
  caseSensitive: boolean
): { text: string; highlighted: boolean }[] {
  return useMemo(() => {
    // Gracefully handle empty or missing highlight
    if (!highlight || !text) {
      return [{ text: text || "", highlighted: false }];
    }

    // Build a regex that captures the matched substring
    const regex = new RegExp(
      `(${escapeRegex(highlight)})`,
      caseSensitive ? "g" : "gi"
    );

    const parts = text.split(regex);
    return parts.map((part) => {
      if (part === "") {
        return { text: part, highlighted: false };
      }

      // Determine if this part is the highlight (respect case sensitivity)
      const isMatch = caseSensitive
        ? part === highlight
        : part.toLowerCase() === highlight.toLowerCase();

      return { text: part, highlighted: isMatch };
    });
  }, [text, highlight, caseSensitive]);
}

const MDESHighlight: React.FC<MDESHighlightProps> = ({
  text,
  highlight,
  highlightClassName,
  caseSensitive = false,
}) => {
  const segments = useHighlightSegments(text, highlight, caseSensitive);
  const markClass = highlightClassName || defaultHighlightClasses;

  return (
    <>
      {segments.map((seg, index) =>
        seg.highlighted ? (
          <mark key={index} className={markClass}>
            {seg.text}
          </mark>
        ) : (
          <React.Fragment key={index}>{seg.text}</React.Fragment>
        )
      )}
    </>
  );
};

export default MDESHighlight;