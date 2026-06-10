"use client";

import React from "react";

export interface StatusRibbonProps {
  isSocketReady: boolean;
  isWaitingForResponse: boolean;
  streamStatus: string;
  agentCount?: number;
  activeModels?: string[];
}

const StatusRibbon: React.FC<StatusRibbonProps> = ({
  isSocketReady,
  isWaitingForResponse,
  streamStatus,
  agentCount,
  activeModels,
}) => {
  const isStreaming = streamStatus === "streaming";
  const isActive    = isWaitingForResponse || isStreaming;
  const modelLabel  = activeModels && activeModels.length > 0 ? activeModels[0] : null;

  if (!isSocketReady) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2.5 py-1 text-[11.5px] font-medium text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-300">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
        <span>ออฟไลน์</span>
      </div>
    );
  }

  if (isActive) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-indigo-500/10 px-2.5 py-1 text-[11.5px] font-medium text-indigo-700 ring-1 ring-indigo-500/20 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/25">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" aria-hidden="true" />
        <span>
          {agentCount && agentCount > 0
            ? `MDES กำลังวิเคราะห์ ${agentCount} ส่วน`
            : "MDES กำลังประมวลผล"}
        </span>
        {modelLabel && (
          <span className="ml-1 rounded bg-indigo-100 px-1 py-0.5 font-mono text-[10px] text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
            {modelLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      <span>พร้อมใช้งาน</span>
    </div>
  );
};

export default StatusRibbon;
