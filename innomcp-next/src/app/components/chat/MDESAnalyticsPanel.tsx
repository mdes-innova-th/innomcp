'use client';

import React from 'react';

// ========================
// Type definitions
// ========================
interface AnalyticsData {
  totalMessages: number;
  totalSessions: number;
  avgResponseMs: number;
  topTools: Array<{ name: string; count: number }>;
  modelUsage: Array<{ model: string; count: number; percentage: number }>;
  errorRate: number;
  activeUsers: number;
}

interface MDESAnalyticsPanelProps {
  data?: AnalyticsData;
  isLoading?: boolean;
  onClose?: () => void;
  className?: string;
}

// ========================
// Sub-components
// ========================
function SummaryCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: 'indigo' | 'red';
}) {
  const bgColor = color === 'indigo' ? 'bg-indigo-600' : 'bg-red-600';
  return (
    <div className={`${bgColor} text-white p-4 rounded-lg shadow`}>
      <div className="text-xs uppercase tracking-wider opacity-80">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function LoadingSkeleton({
  className,
  onClose,
}: {
  className?: string;
  onClose?: () => void;
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow-md p-6 space-y-6 animate-pulse ${
        className ?? ''
      }`}
    >
      {/* Header placeholder */}
      <div className="flex justify-between items-center">
        <div className="h-6 bg-gray-300 rounded w-36"></div>
        {onClose && <div className="h-6 w-6 bg-gray-300 rounded"></div>}
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-300 rounded-lg"></div>
        ))}
      </div>

      {/* Bar chart skeleton */}
      <div className="h-24 bg-gray-300 rounded"></div>

      {/* Top tools skeleton */}
      <div className="h-24 bg-gray-300 rounded"></div>

      {/* Active users skeleton */}
      <div className="flex items-center space-x-2">
        <div className="h-3 w-3 bg-gray-300 rounded-full"></div>
        <div className="h-4 bg-gray-300 rounded w-40"></div>
      </div>
    </div>
  );
}

// ========================
// Main component
// ========================
export default function MDESAnalyticsPanel({
  data,
  isLoading,
  onClose,
  className,
}: MDESAnalyticsPanelProps) {
  // Show skeleton while loading or if data is not yet available
  if (isLoading || !data) {
    return <LoadingSkeleton className={className} onClose={onClose} />;
  }

  // Format large numbers
  const fmt = (n: number) => n.toLocaleString('th-TH');

  return (
    <div
      className={`bg-white rounded-lg shadow-md p-6 space-y-6 ${className ?? ''}`}
    >
      {/* Header with close button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-indigo-900">สถิติการใช้งาน</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            aria-label="ปิด"
          >
            ✕
          </button>
        )}
      </div>

      {/* Summary cards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="ข้อความทั้งหมด"
          value={fmt(data.totalMessages)}
          color="indigo"
        />
        <SummaryCard
          title="เซสชันทั้งหมด"
          value={fmt(data.totalSessions)}
          color="indigo"
        />
        <SummaryCard
          title="เวลาตอบสนองเฉลี่ย"
          value={`${data.avgResponseMs} ms`}
          color="indigo"
        />
        <SummaryCard
          title="อัตราข้อผิดพลาด"
          value={`${data.errorRate.toFixed(2)}%`}
          color="red"
        />
      </div>

      {/* Model usage bar chart */}
      <div>
        <h3 className="text-lg font-semibold text-indigo-800 mb-3">
          การใช้งานโมเดล
        </h3>
        <div className="space-y-2">
          {data.modelUsage.map((item) => (
            <div key={item.model} className="flex items-center">
              <span
                className="w-24 text-sm text-gray-700 truncate"
                title={item.model}
              >
                {item.model}
              </span>
              <div className="flex-1 mx-2 bg-gray-200 rounded-full h-5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-5 rounded-full transition-all duration-300"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
              <span className="w-12 text-sm text-right text-gray-600">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top 5 tools used */}
      <div>
        <h3 className="text-lg font-semibold text-indigo-800 mb-3">
          เครื่องมือที่ใช้มากที่สุด
        </h3>
        <ul className="space-y-1">
          {data.topTools.slice(0, 5).map((tool) => (
            <li
              key={tool.name}
              className="flex justify-between items-center py-1 px-2 bg-indigo-50 rounded"
            >
              <span className="text-gray-800">{tool.name}</span>
              <span className="text-indigo-700 font-mono text-sm">
                {tool.count}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Active users indicator */}
      <div className="flex items-center space-x-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
        <span className="text-gray-700">
          ผู้ใช้ที่กำลังใช้งาน:{' '}
          <span className="font-semibold text-indigo-700">
            {data.activeUsers}
          </span>
        </span>
      </div>
    </div>
  );
}