"use client";

import React, { useState, useEffect, useCallback } from 'react';

interface MDESScrollProgressProps {
  containerRef: React.RefObject<HTMLElement | null>;
  /** Tailwind color name (e.g., "indigo", "blue", "red"), defaults to "indigo" */
  color?: string;
  className?: string;
}

const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-500',
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
};

export default function MDESScrollProgress({
  containerRef,
  color = 'indigo',
  className = '',
}: MDESScrollProgressProps) {
  const [progress, setProgress] = useState(0);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const totalHeight = el.scrollHeight - el.clientHeight;
    if (totalHeight <= 0) {
      setProgress(0);
      return;
    }

    const currentProgress = (el.scrollTop / totalHeight) * 100;
    setProgress(currentProgress);
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);

    // Initial check
    handleScroll();

    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [containerRef, handleScroll]);

  const bgClass = COLOR_MAP[color] || 'bg-indigo-500';

  return (
    <div className={`w-full bg-neutral-800 h-1 overflow-hidden ${className}`}>
      <div
        className={`h-full transition-all duration-100 ease-out ${bgClass}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}