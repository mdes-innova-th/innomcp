'use client';

import React, { useCallback } from 'react';

interface GovernmentQuickActionsProps {
  onAction: (prompt: string) => void;
  compact?: boolean;
}

type QuickAction = {
  emoji: string;
  label: string;
  prompt: string;
};

const quickActions: QuickAction[] = [
  {
    emoji: '📋',
    label: 'สรุปเอกสาร',
    prompt: 'สรุปเอกสารนี้เป็นภาษาไทยที่เข้าใจง่าย',
  },
  {
    emoji: '🌤️',
    label: 'พยากรณ์อากาศ',
    prompt: 'รายงานสภาพอากาศและการเตือนภัยธรรมชาติในประเทศไทยวันนี้',
  },
  {
    emoji: '🗺️',
    label: 'ข้อมูลพื้นที่',
    prompt: 'ข้อมูลภูมิศาสตร์และสถิติจังหวัดในประเทศไทย',
  },
  {
    emoji: '🔍',
    label: 'ค้นหากฎหมาย',
    prompt: 'ค้นหาและอธิบายกฎหมายหรือระเบียบราชการที่เกี่ยวข้อง',
  },
  {
    emoji: '📊',
    label: 'วิเคราะห์ข้อมูล',
    prompt: 'วิเคราะห์ข้อมูลตารางหรือ CSV และสรุปเป็น insights',
  },
  {
    emoji: '🎨',
    label: 'สร้างรูปภาพ',
    prompt: 'สร้างภาพกราฟิกหรือ infographic สำหรับงานราชการ',
  },
];

export default function GovernmentQuickActions({
  onAction,
  compact = false,
}: GovernmentQuickActionsProps) {
  const handleAction = useCallback(
    (prompt: string) => {
      onAction(prompt);
    },
    [onAction],
  );

  if (compact) {
    return (
      <div className="flex items-center justify-center gap-1.5" role="group" aria-label="ทางลัดด่วน">
        {quickActions.map((action) => (
          <button
            key={action.prompt}
            type="button"
            onClick={() => handleAction(action.prompt)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-xl leading-none text-gray-600 transition-colors hover:bg-indigo-100 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            aria-label={action.label}
            title={action.label}
          >
            {action.emoji}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3"
      role="group"
      aria-label="ทางลัดด่วนสำหรับหน่วยงานราชการ"
    >
      {quickActions.map((action) => (
        <button
          key={action.prompt}
          type="button"
          onClick={() => handleAction(action.prompt)}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <span className="text-[28px] leading-none" aria-hidden="true">
            {action.emoji}
          </span>
          <span className="text-sm font-medium text-gray-700">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
}