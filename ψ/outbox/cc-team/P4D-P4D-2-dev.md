<!-- cc-team deliverable
 group: P4D (Phase 4.4 â€” Layout QA vs manus.im (3-column, header, responsive))
 member: P4D-2 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":119,"completion_tokens":1449,"total_tokens":1568,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1184,"image_tokens":0},"cache_creation_input_tokens":0} | 18s
 generated: 2026-06-12T03:44:48.928Z -->
```tsx
import React, { useState, useEffect } from 'react';

const LayoutDebugOverlay: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'l') {
        setVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex gap-2 p-2 bg-white/80 rounded shadow-lg">
      <div className="w-12 h-12 border-2 border-blue-500 rounded" />
      <div className="w-12 h-12 border-2 border-green-500 rounded" />
      <div className="w-12 h-12 border-2 border-purple-500 rounded" />
    </div>
  );
};

export default LayoutDebugOverlay;
```
