'use client';

import React from 'react';

type PulseDotSize = 'sm' | 'md' | 'lg';

interface MDESPulseDotsProps {
  size?: PulseDotSize;
  color?: string; // e.g. 'bg-indigo-600', 'bg-blue-500'
  className?: string;
}

/**
 * Animated pulse dots component for INNOMCP AI thinking state.
 * Uses Tailwind's built-in `animate-pulse` with staggered delays.
 * Default color is MDES indigo (`bg-indigo-600`).
 */
const MDESPulseDots: React.FC<MDESPulseDotsProps> = ({
  size = 'md',
  color = 'bg-indigo-600',
  className = '',
}) => {
  // Map size to Tailwind width/height classes
  const dotSizeMap: Record<PulseDotSize, string> = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2.5 h-2.5',
    lg: 'w-3.5 h-3.5',
  };

  // Stagger delay classes for three dots (including default)
  const delayClasses = ['delay-0', 'delay-150', 'delay-300'];

  return (
    <div
      className={`inline-flex items-center gap-1 sm:gap-1.5 ${className}`}
      role="status"
      aria-label="กำลังคิด"
    >
      {delayClasses.map((delay, index) => (
        <div
          key={index}
          className={`
            rounded-full
            animate-pulse
            ${dotSizeMap[size]}
            ${color}
            ${delay}
          `}
        />
      ))}
    </div>
  );
};

export default MDESPulseDots;