<!-- cc-team deliverable
 group: INT (Integration utilities, docs, quality tools)
 member: INT-25 role=dev model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":88,"completion_tokens":475,"total_tokens":563,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":110,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 21s
 generated: 2026-06-12T03:51:31.034Z -->
'use client';

import { useEffect, useState } from 'react';

function LayoutDebugOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'l') {
        e.preventDefault();
        setVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (process.env.NODE_ENV !== 'development' || !visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]" aria-hidden="true">
      <div className="absolute top-0 left-0 w-1/4 h-full border-2 border-blue-500 opacity-40">
        <span className="absolute top-2 left-2 text-xs font-mono text-blue-500 bg-white/80 px-1 rounded">
          Left
        </span>
      </div>
      <div className="absolute top-0 left-1/4 w-1/2 h-full border-2 border-green-500 opacity-40">
        <span className="absolute top-2 left-2 text-xs font-mono text-green-500 bg-white/80 px-1 rounded">
          Center
        </span>
      </div>
      <div className="absolute top-0 right-0 w-1/4 h-full border-2 border-purple-500 opacity-40">
        <span className="absolute top-2 left-2 text-xs font-mono text-purple-500 bg-white/80 px-1 rounded">
          Right
        </span>
      </div>
    </div>
  );
}

export default LayoutDebugOverlay;
