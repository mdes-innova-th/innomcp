<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-16 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":75,"completion_tokens":2377,"total_tokens":2452,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1910,"image_tokens":0},"cache_creation_input_tokens":0} | 45s
 generated: 2026-06-12T04:21:55.537Z -->
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeClasses: Record<NonNullable<LoadingSpinnerProps['size']>, string> = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', label }) => {
  return (
    <div className="inline-flex items-center gap-2" role="status">
      <svg
        className={animate-spin ${sizeClasses[size]} text-current}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      {label ? (
        <span className="text-sm font-medium text-current">{label}</span>
      ) : (
        <span className="sr-only">Loading...</span>
      )}
    </div>
  );
};

export default LoadingSpinner;
