"use client";

import React from 'react';
import StatusRibbon from './StatusRibbon';

interface MDESBrandHeaderProps {
  isSocketReady: boolean;
  isWaitingForResponse: boolean;
  streamStatus: string;
  agentCount?: number;
  activeModels?: string[];
  providerMode: 'remote' | 'local';
  onProviderModeChange: (mode: 'remote' | 'local') => void;
  onToggleWorkspace?: () => void;
  workspaceOpen?: boolean;
  onToggleMultiAgent?: () => void;
  onToggleModelSettings?: () => void;
  modelSettingsOpen?: boolean;
  conversationTitle?: string;
}

export default function MDESBrandHeader({
  isSocketReady,
  isWaitingForResponse,
  streamStatus,
  agentCount,
  activeModels,
  providerMode,
  onProviderModeChange,
  onToggleWorkspace,
  workspaceOpen = false,
  onToggleMultiAgent,
  onToggleModelSettings,
  modelSettingsOpen = false,
  conversationTitle,
}: MDESBrandHeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-border/60 bg-background/95 backdrop-blur-sm px-4">
      {/* LEFT: MDES brand */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xl leading-none" role="img" aria-label="Thai flag">
          🇹🇭
        </span>
        <span className="font-bold text-[#1a3c6e] whitespace-nowrap">MDES</span>
        <span className="font-semibold text-foreground ml-1 whitespace-nowrap">INNOMCP</span>
        <span className="hidden sm:inline text-xs text-muted-foreground ml-1 whitespace-nowrap">
          ศูนย์ MCP ภาครัฐ
        </span>
      </div>

      {/* CENTER: Conversation title */}
      <div className="flex-1 mx-4 text-center min-w-0">
        {conversationTitle && (
          <h2 className="truncate text-sm font-medium text-foreground" title={conversationTitle}>
            {conversationTitle}
          </h2>
        )}
      </div>

      {/* RIGHT: Controls */}
      <div className="flex items-center gap-1 sm:gap-2">
        <StatusRibbon
          isSocketReady={isSocketReady}
          isWaitingForResponse={isWaitingForResponse}
          streamStatus={streamStatus}
          agentCount={agentCount}
          activeModels={activeModels}
        />

        {/* Provider mode toggle */}
        <div className="flex rounded-md border border-border overflow-hidden">
          <button
            onClick={() => onProviderModeChange('remote')}
            className={`px-2 py-1 text-xs font-medium transition-colors ${
              providerMode === 'remote'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted'
            }`}
          >
            <span>☁️</span>
            <span className="hidden sm:inline ml-1">คลาวด์</span>
          </button>
          <button
            onClick={() => onProviderModeChange('local')}
            className={`px-2 py-1 text-xs font-medium border-l border-border transition-colors ${
              providerMode === 'local'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted'
            }`}
          >
            <span>💻</span>
            <span className="hidden sm:inline ml-1">ท้องถิ่น</span>
          </button>
        </div>

        {/* Multi-agent toggle button */}
        {onToggleMultiAgent && (
          <button
            onClick={onToggleMultiAgent}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted transition-colors"
            title="ตัวแทน"
          >
            <span>🤖</span>
            <span className="hidden sm:inline">ตัวแทน</span>
            {agentCount !== undefined && agentCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold">
                {agentCount}
              </span>
            )}
          </button>
        )}

        {/* Workspace toggle button */}
        {onToggleWorkspace && (
          <button
            onClick={onToggleWorkspace}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              workspaceOpen ? 'bg-muted' : 'hover:bg-muted'
            }`}
            title="พื้นที่ทำงาน"
          >
            <span>🗂️</span>
            <span className="hidden sm:inline">พื้นที่ทำงาน</span>
          </button>
        )}

        {/* Model/Provider settings — openclaude-style provider management */}
        {onToggleModelSettings && (
          <button
            onClick={onToggleModelSettings}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              modelSettingsOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            title="จัดการ AI Provider"
            aria-label="จัดการ AI Provider"
          >
            <span aria-hidden="true">⚙️</span>
          </button>
        )}
      </div>
    </header>
  );
}