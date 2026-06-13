<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-34 role=dev model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":63,"completion_tokens":2435,"total_tokens":2498,"prompt_tokens_details":{"cached_tokens":62,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1699,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 44s
 generated: 2026-06-13T05:27:16.145Z -->
import React from 'react';

interface TagProps {
  label: string;
  color?: string;
  onRemove?: () => void;
}

const colorClasses: Record<string, string> = {
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  purple: 'bg-purple-100 text-purple-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  pink: 'bg-pink-100 text-pink-800',
  gray: 'bg-gray-100 text-gray-800',
};

const Tag: React.FC<TagProps> = ({ label, color = 'gray', onRemove }) => {
  const colorStyle = colorClasses[color] || colorClasses.gray;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorStyle}`}>
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 -mr-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full hover:bg-black/10 focus:outline-none"
        >
          <span className="sr-only">Remove</span>
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </span>
  );
};

export default Tag;
