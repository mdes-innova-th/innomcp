"use client";

import React, { useEffect, useRef } from "react";

export interface Tab {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
  disabled?: boolean;
}

export interface WorkspaceTabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  size?: "sm" | "md";
}

const WorkspaceTabBar: React.FC<WorkspaceTabBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = "",
  size = "md",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const enabledTabs = tabs.filter(t => !t.disabled);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = enabledTabs.findIndex(t => t.id === activeTab);
    if (e.key === "ArrowRight") {
      const next = (current + 1) % enabledTabs.length;
      onTabChange(enabledTabs[next].id);
    } else if (e.key === "ArrowLeft") {
      const prev = (current - 1 + enabledTabs.length) % enabledTabs.length;
      onTabChange(enabledTabs[prev].id);
    }
  };

  const textSize = size === "sm" ? "text-[11px]" : "text-[13px]";
  const padding  = size === "sm" ? "px-2 py-1"   : "px-3 py-1.5";

  return (
    <div
      ref={containerRef}
      role="tablist"
      onKeyDown={handleKeyDown}
      className={`flex items-end gap-0 border-b border-border/60 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive   = tab.id === activeTab;
        const isDisabled = tab.disabled === true;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            disabled={isDisabled}
            tabIndex={isActive ? 0 : -1}
            onClick={() => !isDisabled && onTabChange(tab.id)}
            className={[
              "relative flex items-center gap-1 whitespace-nowrap font-medium transition-colors",
              textSize,
              padding,
              isDisabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {tab.badge > 99 ? "99+" : tab.badge}
              </span>
            )}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-0 h-0.5 w-full rounded-t bg-[#1a3c6e] transition-all duration-200 dark:bg-[#4a7cbf]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default WorkspaceTabBar;
