'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface MDESTooltipProps {
  children: React.ReactNode;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number; // ms
}

/**
 * MDESTooltip — accessible tooltip component for INNOMCP.
 * Shows on hover/focus with optional delay. Uses CSS-only positioning.
 * Role: tooltip, linked via aria-describedby.
 */
export default function MDESTooltip({
  children,
  content,
  placement = 'top',
  delay = 200,
}: MDESTooltipProps) {
  const [visible, setVisible] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unique id for aria-describedby
  const tooltipId = React.useId();

  // Clear any pending timeout
  const clearScheduled = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Show tooltip after delay
  const scheduleShow = useCallback(() => {
    clearScheduled();
    if (delay > 0) {
      timeoutRef.current = setTimeout(() => setVisible(true), delay);
    } else {
      setVisible(true);
    }
  }, [delay, clearScheduled]);

  // Hide tooltip immediately
  const hide = useCallback(() => {
    clearScheduled();
    setVisible(false);
  }, [clearScheduled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearScheduled();
  }, [clearScheduled]);

  // Positioning classes based on placement prop
  const placementClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const tooltipClasses = `
    absolute z-50 px-3 py-1.5 text-sm text-white bg-gray-800 rounded shadow-lg
    whitespace-nowrap pointer-events-none
    ${placementClasses[placement] || placementClasses.top}
  `;

  // Don't render tooltip if content is empty
  if (!content) {
    return <>{children}</>;
  }

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={scheduleShow}
      onMouseLeave={hide}
      onFocus={scheduleShow}
      onBlur={hide}
      aria-describedby={tooltipId}
    >
      {children}

      {visible && (
        <div
          id={tooltipId}
          ref={tooltipRef}
          role="tooltip"
          className={tooltipClasses}
        >
          {content}
        </div>
      )}
    </div>
  );
}