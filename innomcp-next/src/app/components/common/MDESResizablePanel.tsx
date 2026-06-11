"use client";

import React from "react";

interface MDESResizablePanelProps {
  /** Initial width in pixels (optional) */
  defaultWidth?: number;
  /** Initial height in pixels (optional) */
  defaultHeight?: number;
  /** Allowed resize axis (default "horizontal") */
  direction?: "horizontal" | "vertical" | "both";
  /** Minimum width in pixels */
  minWidth?: number;
  /** Minimum height in pixels */
  minHeight?: number;
  /** Maximum width in pixels */
  maxWidth?: number;
  /** Maximum height in pixels */
  maxHeight?: number;
  children: React.ReactNode;
  /** Additional Tailwind classes */
  className?: string;
}

const MDESResizablePanel: React.FC<MDESResizablePanelProps> = ({
  defaultWidth,
  defaultHeight,
  direction = "horizontal",
  minWidth,
  minHeight,
  maxWidth,
  maxHeight,
  children,
  className = "",
}) => {
  // Compose style for dimensions and constraints
  const style: React.CSSProperties = {};
  if (defaultWidth !== undefined) style.width = `${defaultWidth}px`;
  if (defaultHeight !== undefined) style.height = `${defaultHeight}px`;
  if (minWidth !== undefined) style.minWidth = `${minWidth}px`;
  if (minHeight !== undefined) style.minHeight = `${minHeight}px`;
  if (maxWidth !== undefined) style.maxWidth = `${maxWidth}px`;
  if (maxHeight !== undefined) style.maxHeight = `${maxHeight}px`;

  return (
    <div
      // Tailwind resize + overflow-auto enables native CSS resize handle
      className={`resize-${direction} overflow-auto relative ${className}`}
      style={style}
      aria-label="Resizable panel"
      role="region"
    >
      {children}

      {/* Subtle visual hint in the bottom‑right corner */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 pointer-events-none select-none"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="w-full h-full text-gray-400 opacity-75"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M14 1v13H1" />
        </svg>
      </div>
    </div>
  );
};

export default MDESResizablePanel;