"use client";

import React from "react";

interface ReactionBarProps {
  /** Called when user clicks thumbs up */
  onGood?: () => void;
  /** Called when user clicks thumbs down */
  onBad?: () => void;
  /** Called when user clicks copy (message text) */
  onCopy?: () => void;
  /** Called when user clicks retry (re‑generate message) */
  onRetry?: () => void;
  /** Additional CSS classes for the container */
  className?: string;
}

/**
 * ReactionBar – compact reaction bar for INNOMCP AI messages.
 * Shows thumbs up, thumbs down, copy, and retry buttons.
 * Each button is an emoji icon with no text, accessible via aria‑label.
 * Buttons are rendered only if the corresponding handler is provided.
 */
const ReactionBar: React.FC<ReactionBarProps> = ({
  onGood,
  onBad,
  onCopy,
  onRetry,
  className = "",
}) => {
  const baseButton =
    "inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700";

  return (
    <div
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="toolbar"
      aria-label="Reaction bar"
    >
      {onGood && (
        <button
          type="button"
          className={baseButton}
          onClick={onGood}
          aria-label="ถูกใจข้อความนี้"
        >
          👍
        </button>
      )}
      {onBad && (
        <button
          type="button"
          className={baseButton}
          onClick={onBad}
          aria-label="ไม่ถูกใจข้อความนี้"
        >
          👎
        </button>
      )}
      {onCopy && (
        <button
          type="button"
          className={baseButton}
          onClick={onCopy}
          aria-label="คัดลอกข้อความ"
        >
          📋
        </button>
      )}
      {onRetry && (
        <button
          type="button"
          className={baseButton}
          onClick={onRetry}
          aria-label="ลองใหม่อีกครั้ง"
        >
          🔄
        </button>
      )}
    </div>
  );
};

export default ReactionBar;