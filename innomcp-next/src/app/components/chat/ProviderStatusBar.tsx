'use client';

import React from 'react';

export interface ProviderStatusBarProps {
  mdesHealthy: boolean;
  mdesLatencyMs?: number;
  activeProviders?: Array<{ name: string; healthy: boolean }>;
  currentModel?: string;
  onModelClick?: () => void;
  className?: string;
}

/**
 * Compact status bar displayed above the chat composer.
 * Shows MDES Ollama health/latency, current model, and online provider count.
 * Uses Thai UI strings.
 */
export default function ProviderStatusBar({
  mdesHealthy,
  mdesLatencyMs,
  activeProviders,
  currentModel,
  onModelClick,
  className = '',
}: ProviderStatusBarProps) {
  const healthyProviderCount = activeProviders?.filter((p) => p.healthy).length ?? 0;

  const getDotColor = () => {
    if (!mdesHealthy) return 'bg-red-500';
    if (mdesLatencyMs !== undefined && mdesLatencyMs > 3000) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <div
      className={`flex items-center justify-between h-5 text-[10px] leading-none px-2 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700 ${className}`}
      role="status"
      aria-label="สถานะผู้ให้บริการ"
    >
      {/* Left: MDES Ollama status */}
      <div className="flex items-center space-x-1">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${getDotColor()}`} />
        <span className="font-medium">MDES Ollama</span>
        {mdesHealthy ? (
          <span className="text-gray-500 dark:text-gray-400">
            {mdesLatencyMs !== undefined ? `${mdesLatencyMs}ms` : 'ออนไลน์'}
          </span>
        ) : (
          <span className="text-red-500 dark:text-red-400">ออฟไลน์</span>
        )}
      </div>

      {/* Center: current model (clickable) */}
      <div className="flex-1 flex justify-center min-w-0 mx-2">
        {currentModel ? (
          <button
            type="button"
            onClick={onModelClick}
            className="truncate max-w-[150px] hover:underline cursor-pointer text-gray-600 dark:text-gray-300 focus:outline-none focus-visible:underline"
            title={currentModel}
            aria-label={`เปลี่ยนโมเดล (${currentModel})`}
          >
            {currentModel}
          </button>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">ไม่มีโมเดล</span>
        )}
      </div>

      {/* Right: online provider count */}
      <div className="flex items-center space-x-1 shrink-0">
        <span className="text-gray-500 dark:text-gray-400">
          ผู้ให้บริการออนไลน์ {healthyProviderCount}
        </span>
      </div>
    </div>
  );
}