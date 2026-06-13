<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-20 role=dev model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":65,"completion_tokens":1044,"total_tokens":1109,"prompt_tokens_details":{"cached_tokens":6,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":798,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 30s
 generated: 2026-06-13T05:26:27.284Z -->
import React from 'react';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
};

export default function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className || ''}`}
    >
      {children}
    </span>
  );
}
