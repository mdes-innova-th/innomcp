'use client';

import { useState, useEffect } from 'react';

export default function DevToolsPanel() {
  const [isVisible, setIsVisible] = useState(true);
  const [health, setHealth] = useState<'checking' | 'ok' | 'error'>('checking');
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [time, setTime] = useState('');

  const currentModel = process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'gpt-4o';

  useEffect(() => {
    setTime(new Date().toLocaleTimeString());

    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        setHealth(res.ok ? 'ok' : 'error');
      } catch {
        setHealth('error');
      }
    };

    checkHealth();
    const healthInterval = setInterval(checkHealth, 15000);

    // Mocking WS status for UI demonstration
    const wsTimeout = setTimeout(() => setWsStatus('connected'), 1200);

    const timeInterval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'd') {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(healthInterval);
      clearInterval(timeInterval);
      clearTimeout(wsTimeout);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 bg-gray-800 text-gray-400 text-[10px] px-2 py-1 rounded shadow-lg border border-gray-700 hover:bg-gray-700 transition-colors font-mono"
        title="Show DevTools (Alt+D)"
      >
        DEV
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900/95 backdrop-blur-sm text-gray-200 text-xs p-3 rounded-lg shadow-2xl border border-gray-700 font-mono w-64">
      <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-1">
        <span className="font-bold text-gray-100 tracking-wider">DEVTOOLS</span>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          title="Hide (Alt+D)"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-gray-400">Backend:</span>
          <span className={`flex items-center gap-1 ${health === 'ok' ? 'text-green-400' : health === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${health === 'ok' ? 'bg-green-400' : health === 'error' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'}`}></span>
            {health === 'ok' ? 'Healthy' : health === 'error' ? 'Error' : 'Checking'}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">WS:</span>
          <span className={`flex items-center gap-1 ${wsStatus === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'}`}></span>
            {wsStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Model:</span>
          <span className="text-blue-300 truncate ml-2">{currentModel}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Time:</span>
          <span className="text-gray-300">{time || '...'}</span>
        </div>
      </div>

      <div className="mt-2 pt-1 border-t border-gray-700 text-[10px] text-gray-500 text-center">
        Press <kbd className="px-1 py-0.5 bg-gray-800 rounded border border-gray-600 text-gray-300">Alt</kbd> + <kbd className="px-1 py-0.5 bg-gray-800 rounded border border-gray-600 text-gray-300">D</kbd> to toggle
      </div>
    </div>
  );
}