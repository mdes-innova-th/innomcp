<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-48 role=dev model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":67,"completion_tokens":2076,"total_tokens":2143,"prompt_tokens_details":{"cached_tokens":16,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1615,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 32s
 generated: 2026-06-13T05:27:41.148Z -->
import React, { useState, useRef, ReactNode } from 'react';

interface CollapsibleProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export default function Collapsible({ title, children, defaultOpen = false }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors duration-200 focus:outline-none"
      >
        <span className="font-medium text-gray-900">{title}</span>
        <svg
          className={`w-5 h-5 text-gray-500 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <div
        className="transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isOpen ? `${contentRef.current?.scrollHeight ?? 0}px` : '0px',
        }}
      >
        <div ref={contentRef} className="p-4 pt-0 text-gray-700">
          {children}
        </div>
      </div>
    </div>
  );
}
