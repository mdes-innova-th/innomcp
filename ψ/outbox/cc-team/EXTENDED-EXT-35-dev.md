<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-35 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":68,"completion_tokens":1585,"total_tokens":1653,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1305,"image_tokens":0},"cache_creation_input_tokens":0} | 23s
 generated: 2026-06-13T05:26:59.082Z -->
import React from 'react';

interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  label?: string;
  className?: string;
}

const Divider: React.FC<DividerProps> = ({ orientation = 'horizontal', label, className = '' }) => {
  if (orientation === 'vertical') {
    return (
      <div className={`relative inline-flex items-center justify-center ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-full w-px bg-gray-300" />
        </div>
        {label && (
          <span className="relative z-10 bg-white px-1 text-sm text-gray-500 transform -rotate-90">
            {label}
          </span>
        )}
      </div>
    );
  }

  if (label) {
    return (
      <div className={`flex items-center ${className}`}>
        <div className="flex-1 border-t border-gray-300" />
        <span className="mx-2 text-sm text-gray-500 whitespace-nowrap">{label}</span>
        <div className="flex-1 border-t border-gray-300" />
      </div>
    );
  }

  return <hr className={`border-t border-gray-300 ${className}`} />;
};

export default Divider;
