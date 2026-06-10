"use client";

import React from "react";
import ChatWelcomeHero from "./ChatWelcomeHero";
import GovernmentQuickActions from "./GovernmentQuickActions";
import StarterPromptsGrid from "./StarterPromptsGrid";

interface ChatEmptyStateManagerProps {
  isConnected: boolean;
  onQuerySelect: (query: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  providerMode: "remote" | "local";
  hasMessages: boolean; // true → show reduced “continue” state
}

/**
 * Manus‑style empty state orchestrator for the INNO MCP chat.
 *
 * - When the chat is completely empty (`hasMessages === false`):
 *   renders a three‑stage welcome experience with staggered fade‑in.
 * - When the user has sent messages but a new empty state appears (e.g.
 *   after clearing history): renders a compact prompt grid plus a friendly
 *   “ask anything” hint.
 * - If the network is disconnected, an offline banner is shown above
 *   everything.
 */
export default function ChatEmptyStateManager({
  isConnected,
  onQuerySelect,
  textareaRef,
  providerMode,
  hasMessages,
}: ChatEmptyStateManagerProps) {
  // Stagger delays for the full welcome sections (ms)
  const stagger = {
    hero: "0ms",
    quickActions: "100ms",
    prompts: "200ms",
  };

  // Offline warning
  const offlineBanner = !isConnected ? (
    <div className="animate-fade-in text-center text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2 w-full">
      ⚠️ การเชื่อมต่อขัดข้อง — ระบบกำลังทำงานแบบออฟไลน์
    </div>
  ) : null;

  // Full state (no messages yet)
  const fullState = (
    <>
      {/* 1. Welcome hero */}
      <div
        className="animate-fade-in"
        style={{ animationDelay: stagger.hero }}
      >
        <ChatWelcomeHero
          onQuerySelect={onQuerySelect}
          textareaRef={textareaRef}
          isConnected={isConnected}
          providerMode={providerMode}
        />
      </div>

      {/* 2. Government quick actions */}
      <div
        className="animate-fade-in"
        style={{ animationDelay: stagger.quickActions }}
      >
        <GovernmentQuickActions onAction={onQuerySelect} />
      </div>

      {/* 3. Starter prompts grid (full) */}
      <div
        className="animate-fade-in"
        style={{ animationDelay: stagger.prompts }}
      >
        <StarterPromptsGrid
          onSelect={onQuerySelect}
          textareaRef={textareaRef}
          reduced={false}
        />
      </div>
    </>
  );

  // Reduced state (user has messages, new empty state)
  const reducedState = (
    <>
      <div className="animate-fade-in" style={{ animationDelay: "0ms" }}>
        <StarterPromptsGrid
          onSelect={onQuerySelect}
          textareaRef={textareaRef}
          reduced={true}
        />
      </div>
      <p
        className="animate-fade-in text-center text-sm text-slate-400"
        style={{ animationDelay: "100ms" }}
      >
        หรือถามได้เลย...
      </p>
    </>
  );

  // Key switching forces a remount → replays fade-in on state change
  const stateKey = hasMessages ? "reduced" : "full";

  return (
    <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto px-4">
      {offlineBanner}

      <div key={stateKey} className="flex flex-col gap-6">
        {hasMessages ? reducedState : fullState}
      </div>
    </div>
  );
}