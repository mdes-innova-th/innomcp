<!-- cc-team deliverable
 group: P4D (Phase 4.4 â€” Layout QA vs manus.im (3-column, header, responsive))
 member: P4D-6 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":64,"completion_tokens":3055,"total_tokens":3119,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2697,"image_tokens":0},"cache_creation_input_tokens":0} | 57s
 generated: 2026-06-12T03:46:19.806Z -->
import React from 'react';

interface ThreeColumnLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  showRight?: boolean;
}

const ThreeColumnLayout: React.FC<ThreeColumnLayoutProps> = ({
  left,
  center,
  right,
  showRight = true,
}) => {
  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-50 w-full h-14 flex-shrink-0 bg-white border-b border-zinc-200 flex items-center px-6 shadow-sm">
        <span className="text-lg font-bold tracking-tight text-zinc-800">InnoMCP</span>
      </header>
      
      <div className="flex-1 flex w-full overflow-hidden">
        <aside className="w-72 flex-shrink-0 border-r border-zinc-200 bg-white overflow-y-auto">
          {left}
        </aside>
        
        <main className="flex-1 overflow-y-auto bg-zinc-50">
          {center}
        </main>
        
        {showRight && (
          <aside className="w-80 flex-shrink-0 border-l border-zinc-200 bg-white overflow-y-auto">
            {right}
          </aside>
        )}
      </div>
    </div>
  );
};

export default ThreeColumnLayout;
