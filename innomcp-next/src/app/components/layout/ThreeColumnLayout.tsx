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
