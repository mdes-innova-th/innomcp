"use client";

import React from 'react';

interface ComposerEnhancedBarProps {
  isConnected: boolean;
  currentModel?: string;
  activeAgentCount?: number;
  providerMode: 'remote' | 'local';
  onInsertTemplate: (text: string) => void;
  onOpenQuickCompose: () => void;
  onToggleWorkspace: () => void;
  workspaceOpen?: boolean;
}

const quickActions = [
  { label: '⚡ เร็ว', template: '/quick ' },
  { label: '🧠 วิเคราะห์', template: '/analyze ' },
  { label: '📄 สรุป', template: '/summarize ' },
  { label: '🌐 ค้นหาเว็บ', template: '/search ' },
];

export default function ComposerEnhancedBar({
  isConnected,
  currentModel,
  activeAgentCount = 0,
  providerMode,
  onInsertTemplate,
  onOpenQuickCompose,
  onToggleWorkspace,
  workspaceOpen = false,
}: ComposerEnhancedBarProps) {
  const modelDisplay = providerMode === 'remote'
    ? `🤖 ${currentModel || 'Remote AI'}`
    : '💻 Local Ollama';

  return (
    <div className="flex items-center gap-2 h-8 px-2 bg-gray-800/30 rounded-md text-gray-300 text-sm">
      {/* Left: model pill */}
      <div className="flex-shrink-0 px-1.5 py-0.5 rounded bg-gray-700/50 text-xs leading-none whitespace-nowrap">
        {isConnected ? modelDisplay : '⚠️ Disconnected'}
      </div>

      {/* Agent count */}
      {activeAgentCount > 0 && (
        <div className="flex-shrink-0 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs leading-none whitespace-nowrap">
          👥 {activeAgentCount} agents
        </div>
      )}

      {/* Center: scrollable quick action pills */}
      <div
        className="flex-1 overflow-x-auto whitespace-nowrap flex items-center gap-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => onInsertTemplate(action.template)}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs leading-none bg-gray-700/50 hover:bg-gray-600/50 transition-colors cursor-pointer"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Right: workspace toggle and quick compose */}
      <button
        onClick={onToggleWorkspace}
        className={`flex-shrink-0 p-0.5 rounded hover:bg-gray-600/30 transition-colors ${
          workspaceOpen ? 'bg-blue-500/20 text-blue-300' : ''
        }`}
        aria-label="Toggle workspace"
      >
        🗂️
      </button>
      <button
        onClick={onOpenQuickCompose}
        className="flex-shrink-0 p-0.5 rounded hover:bg-gray-600/30 transition-colors"
        aria-label="Quick compose"
      >
        📝
      </button>
    </div>
  );
}