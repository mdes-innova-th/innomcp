"use client";

import React from "react";

interface MDESLoadingBarProps {
  /** Progress value from 0 to 100 */
  value: number;
  /** Label displayed below the bar (default "กำลังโหลด...") */
  label?: string;
  /** Additional CSS classes for the outer container */
  className?: string;
}

/**
 * Animated indigo progress bar with Thai label and accessible semantics.
 * Shows a pulsing shimmer overlay while loading (value < 100).
 */
export default function MDESLoadingBar({
  value,
  label = "กำลังโหลด...",
  className,
}: MDESLoadingBarProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.min(Math.max(value, 0), 100);

  return (
    <div className={`flex flex-col ${className ?? ""}`}>
      {/* Progress track */}
      <div
        className="relative h-2 w-full rounded-full bg-gray-200 overflow-hidden"
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        {/* Animated fill */}
        <div
          className="relative h-full rounded-full bg-indigo-600 transition-all duration-500 ease-in-out"
          style={{ width: `${clampedValue}%` }}
        >
          {/* Shimmer overlay when not complete */}
          {clampedValue < 100 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          )}
        </div>
      </div>

      {/* Thai label */}
      <p className="mt-2 text-sm text-gray-600">{label}</p>
    </div>
  );
}