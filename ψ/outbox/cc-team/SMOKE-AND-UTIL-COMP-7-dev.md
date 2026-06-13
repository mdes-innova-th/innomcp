<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: COMP-7 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: stop | tokens: {"prompt_tokens":63,"completion_tokens":1772,"total_tokens":1835,"prompt_tokens_details":{"cached_tokens":4,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1491,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 16s
 generated: 2026-06-13T05:28:33.125Z -->
"use client";

import React, { ReactNode, useState } from "react";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
}

export default function Tabs({ tabs, defaultTab }: TabsProps) {
  const [activeTab, setActiveTab] = useState<string>(
    defaultTab ?? (tabs[0]?.id ?? "")
  );

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex border-b border-gray-200" role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors focus:outline-none border-b-2 ${
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="py-4" role="tabpanel">
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  );
}
