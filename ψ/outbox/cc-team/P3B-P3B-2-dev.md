<!-- cc-team deliverable
 group: P3B (Phase 3.2 â€” WS reconnection banner in ChatPage)
 member: P3B-2 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":337,"completion_tokens":932,"total_tokens":1269,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":92,"image_tokens":0},"cache_creation_input_tokens":0} | 20s
 generated: 2026-06-12T03:42:15.473Z -->
```tsx
'use client';

import React from 'react';

type WSStatus = 'connected' | 'connecting' | 'disconnected';

interface WSStatusBannerProps {
  status: WSStatus;
  retryCount?: number;
}

const SpinnerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
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
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    />
  </svg>
);

const DisconnectedIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M5.636 18.364a9 9 0 010-12.728M8.464 15.536a5 5 0 010-7.072"
    />
  </svg>
);

const WSStatusBanner: React.FC<WSStatusBannerProps> = ({ status, retryCount }) => {
  if (status === 'connected') {
    return null;
  }

  if (status === 'connecting') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2 w-full bg-yellow-100 border-b border-yellow-300 text-yellow-800 px-4 py-2 text-sm font-medium"
      >
        <SpinnerIcon className="h-4 w-4 animate-spin text-yellow-600" />
        <span>กำลังเชื่อมต่อระบบ...</span>
      </div>
    );
  }

  // disconnected
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center justify-center gap-2 w-full bg-red-100 border-b border-red-300 text-red-800 px-4 py-2 text-sm font-medium"
    >
      <DisconnectedIcon className="h-4 w-4 text-red-600" />
      <span>ขาดการเชื่อมต่อ</span>
      {typeof retryCount === 'number' && retryCount > 0 && (
        <span className="text-red-700">
          พยายามครั้งที่ {retryCount}
        </span>
      )}
    </div>
  );
};

export default WSStatusBanner;
```
