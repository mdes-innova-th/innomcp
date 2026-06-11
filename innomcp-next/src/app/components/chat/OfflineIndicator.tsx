"use client";

import React from "react";

interface OfflineIndicatorProps {
  isOffline: boolean;
  isReconnecting?: boolean;
  className?: string;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isOffline, isReconnecting = false, className = "",
}) => {
  if (!isOffline) return null;
  return (
    <div className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
      <span>{isReconnecting ? "กำลังเชื่อมต่อใหม่..." : "ออฟไลน์"}</span>
    </div>
  );
};

export default OfflineIndicator;
