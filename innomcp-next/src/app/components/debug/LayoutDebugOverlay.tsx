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
