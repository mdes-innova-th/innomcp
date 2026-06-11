"use client";

import React from "react";

interface MDESDividerProps {
  /** Optional text to display centered on the divider */
  label?: string;
  /** Orientation of the divider, defaults to "horizontal" */
  orientation?: "horizontal" | "vertical";
  /** Additional Tailwind classes to apply to the container */
  className?: string;
}

/**
 * A section divider that can render horizontally (with optional label)
 * or vertically (for use in flex/grid containers).
 */
export default function MDESDivider({
  label,
  orientation = "horizontal",
  className,
}: MDESDividerProps) {
  const lineClasses = "border-gray-200 dark:border-gray-700";
  const labelClasses =
    "text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 px-3 py-1 [font-variant:small-caps]";

  // Vertical divider
  if (orientation === "vertical") {
    return (
      <div
        aria-hidden="true"
        role="separator"
        aria-orientation="vertical"
        className={`h-full border-l ${lineClasses} shrink-0 ${className ?? ""}`}
      />
    );
  }

  // Horizontal without label
  if (!label) {
    return (
      <hr
        aria-hidden="true"
        className={`border-t ${lineClasses} w-full ${className ?? ""}`}
      />
    );
  }

  // Horizontal with label
  return (
    <div
      role="separator"
      className={`flex items-center w-full ${className ?? ""}`}
    >
      <div className={`flex-grow border-t ${lineClasses}`} aria-hidden="true" />
      <span className={labelClasses}>{label}</span>
      <div className={`flex-grow border-t ${lineClasses}`} aria-hidden="true" />
    </div>
  );
}