'use client';

import { useState, useEffect, useCallback } from 'react';

interface InlineFeedbackBarProps {
  messageId: string;
  model?: string;
  elapsed?: number;         // seconds
  onCopy: () => void;
  onRetry?: () => void;
  onFeedback: (rating: 'good' | 'bad') => void;
  onShare?: () => void;
  className?: string;
}

const THANK_YOU_DURATION = 2000;
const THANK_YOU_TEXT = 'ขอบคุณ! 🙏';

/**
 * Inline feedback bar – appears below AI response bubbles.
 * Requires the parent element to have the `group` class for hover effects.
 */
export default function InlineFeedbackBar({
  messageId,
  model,
  elapsed,
  onCopy,
  onRetry,
  onFeedback,
  onShare,
  className = '',
}: InlineFeedbackBarProps) {
  const [showThankYou, setShowThankYou] = useState(false);

  // Automatically hide thank you message after duration
  useEffect(() => {
    if (!showThankYou) return;
    const timer = setTimeout(() => setShowThankYou(false), THANK_YOU_DURATION);
    return () => clearTimeout(timer);
  }, [showThankYou]);

  const handleFeedback = useCallback(
    (rating: 'good' | 'bad') => {
      setShowThankYou(true);
      onFeedback(rating);
    },
    [onFeedback]
  );

  const formatElapsed = (seconds: number): string => {
    if (seconds < 1) return '<1s';
    return seconds.toFixed(1) + 's';
  };

  return (
    <div
      className={`flex items-center gap-1.5 text-xs text-gray-400 
                  opacity-0 group-hover:opacity-100 max-sm:opacity-100 
                  transition-opacity duration-200 ${className}`}
    >
      {/* Model badge */}
      {model && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded 
                         bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 
                         text-[10px] leading-none font-mono">
          {model}
        </span>
      )}

      {/* Elapsed time */}
      {elapsed !== undefined && (
        <span className="tabular-nums whitespace-nowrap">
          {formatElapsed(elapsed)}
        </span>
      )}

      {/* Separator */}
      {(model || elapsed !== undefined) && <span aria-hidden="true">·</span>}

      {/* Copy button */}
      <button
        type="button"
        onClick={onCopy}
        aria-label="คัดลอกข้อความ"
        className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 
                   transition-colors cursor-pointer"
      >
        📋
      </button>

      {/* Retry button */}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          aria-label="ลองใหม่"
          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 
                     transition-colors cursor-pointer"
        >
          🔄
        </button>
      )}

      {/* Feedback / Thank you */}
      {showThankYou ? (
        <span className="text-green-600 dark:text-green-400 whitespace-nowrap text-[11px]">
          {THANK_YOU_TEXT}
        </span>
      ) : (
        <>
          <button
            type="button"
            onClick={() => handleFeedback('good')}
            aria-label="ตอบดี"
            className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 
                       transition-colors cursor-pointer"
          >
            👍
          </button>
          <button
            type="button"
            onClick={() => handleFeedback('bad')}
            aria-label="ตอบไม่ดี"
            className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 
                       transition-colors cursor-pointer"
          >
            👎
          </button>
        </>
      )}

      {/* Share button */}
      {onShare && (
        <button
          type="button"
          onClick={onShare}
          aria-label="แชร์"
          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 
                     transition-colors cursor-pointer"
        >
          🔗
        </button>
      )}
    </div>
  );
}