import React from 'react';

interface HealthIndicatorProps {
  healthy: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const sizeMap = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
};

export default function HealthIndicator({
  healthy,
  size = 'md',
  className,
}: HealthIndicatorProps) {
  const sizeClass = sizeMap[size];
  const colorAndAnimation = healthy
    ? 'bg-green-500 animate-pulse'
    : 'bg-red-500';

  return (
    <span
      className={`rounded-full ${sizeClass} ${colorAndAnimation} ${className ?? ''}`}
      role="status"
      aria-label={healthy ? 'Backend healthy' : 'Backend unhealthy'}
    />
  );
}