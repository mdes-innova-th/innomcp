<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-28 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":89,"completion_tokens":1000,"total_tokens":1089,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":728,"image_tokens":0},"cache_creation_input_tokens":0} | 14s
 generated: 2026-06-12T04:22:07.861Z -->
import React from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({ children, content, position = 'top' }) => {
  const positionStyles: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative inline-block group">
      {children}
      <div
        className={`absolute ${positionStyles[position]} whitespace-nowrap z-10 px-2 py-1 text-sm text-white bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none`}
      >
        {content}
      </div>
    </div>
  );
};

export default Tooltip;
