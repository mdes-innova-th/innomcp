"use client";

import React from "react";

interface ProviderInfo {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  model: string;
  capabilities: string[];
  priority: number;
  enabled: boolean;
  healthy?: boolean;
  latencyMs?: number;
  isDefault?: boolean;
}

interface ProviderCardProps {
  provider: ProviderInfo;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  className?: string;
}

const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  onToggle,
  onEdit,
  onDelete,
  onTest,
  className = "",
}) => {
  const {
    id,
    name,
    type,
    model,
    capabilities,
    priority,
    enabled,
    healthy,
    latencyMs,
    isDefault,
  } = provider;

  // Limit displayed capabilities to 3, show "+N" if more
  const displayCaps = capabilities.slice(0, 3);
  const extraCaps = capabilities.length - 3;

  // Health status color
  const dotColor = healthy === undefined ? "bg-gray-400" : healthy ? "bg-green-500" : "bg-red-500";

  // Latency display
  const latencyDisplay = latencyMs !== undefined ? `${latencyMs}ms` : "-";

  return (
    <div
      className={`border border-gray-200 rounded-lg bg-white p-4 space-y-3 transition-opacity ${
        enabled ? "opacity-100" : "opacity-60"
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        {/* Provider icon placeholder */}
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
          {name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 truncate">{name}</span>
            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              {type}
            </span>
            {isDefault && (
              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                ค่าเริ่มต้น
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">รุ่น:</span>
        <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700 text-xs">
          {model}
        </span>

        {displayCaps.map((cap, idx) => (
          <span
            key={idx}
            className="inline-block px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700 border border-purple-200"
          >
            {cap}
          </span>
        ))}
        {extraCaps > 0 && (
          <span className="text-xs text-gray-400">+{extraCaps}</span>
        )}

        <span className="ml-auto inline-block px-2 py-0.5 rounded text-xs bg-gray-50 text-gray-600 border border-gray-200">
          ลำดับ {priority}
        </span>
      </div>

      {/* Health row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
          <span className="text-sm text-gray-600">
            {healthy === undefined ? "ไม่ทราบ" : healthy ? "ปกติ" : "ผิดปกติ"}
          </span>
        </div>
        <span className="text-sm text-gray-400 mx-2">|</span>
        <span className="text-sm text-gray-500">
          เวลาตอบสนอง: {latencyDisplay}
        </span>
        <button
          type="button"
          onClick={() => onTest(id)}
          className="ml-auto text-sm px-3 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
        >
          ทดสอบ
        </button>
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        {/* Toggle switch */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-sm text-gray-600">
            {enabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
          </span>
          <div className="relative">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggle(id, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 peer-checked:bg-blue-600 rounded-full peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
          </div>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(id)}
            className="text-sm px-3 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
          >
            แก้ไข
          </button>
          <button
            type="button"
            onClick={() => onDelete(id)}
            className="text-sm px-3 py-1 rounded-md border border-red-200 bg-white hover:bg-red-50 text-red-600 transition-colors"
          >
            ลบ
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProviderCard;