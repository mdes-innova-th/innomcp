<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-10 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":92,"completion_tokens":913,"total_tokens":1005,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":738,"image_tokens":0},"cache_creation_input_tokens":0} | 12s
 generated: 2026-06-12T04:20:56.710Z -->
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
