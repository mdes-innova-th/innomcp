<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-21 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":68,"completion_tokens":882,"total_tokens":950,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":709,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-13T05:26:14.435Z -->
import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
  className?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({ width, height, rounded = false, className = '' }) => {
  const style: React.CSSProperties = {
    ...(width !== undefined && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height !== undefined && { height: typeof height === 'number' ? `${height}px` : height }),
  };

  return (
    <div
      className={`animate-pulse bg-gray-200 ${rounded ? 'rounded-full' : 'rounded-md'} ${className}`}
      style={style}
    />
  );
};

export default Skeleton;
