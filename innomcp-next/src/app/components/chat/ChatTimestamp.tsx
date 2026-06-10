'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface ChatTimestampProps {
  timestamp: number;       // unix ms
  format?: "relative" | "absolute" | "both";
  className?: string;
}

const MONTHS_THAI = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

function padTwo(n: number): string {
  return n < 10 ? '0' + n : '' + n;
}

function getAbsoluteTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const day = date.getDate();
  const month = MONTHS_THAI[date.getMonth()];
  const year = date.getFullYear();
  return `${padTwo(hours)}:${padTwo(minutes)} น. วันที่ ${day} ${month} ${year}`;
}

function getRelativeTime(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'เมื่อสักครู่';
  }
  if (diffMin < 60) {
    return `${diffMin} นาทีที่แล้ว`;
  }
  if (diffHour < 24) {
    // Check if it was yesterday: if the date was yesterday (calendar date diff = 1)
    // But easier: if diffHour < 24 and same day? Actually if it's more than 24 hours but < 48 and date changes, we check yesterday
    // We'll use diffDay = 0 for today, 1 for yesterday.
    // Since diffDay is based on 24h intervals, a message from yesterday 23h ago would have diffDay=0 but is actually yesterday if date changed.
    // More robust: compare calendar dates.
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const calendarDiff = Math.round((nowDate.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));
    if (calendarDiff === 1) {
      return 'เมื่อวาน';
    }
    // If same calendar day, show hours
    if (calendarDiff === 0) {
      return `${diffHour} ชั่วโมงที่แล้ว`;
    }
    // Otherwise fallback to date
    return `วันที่ ${padTwo(date.getDate())}/${padTwo(date.getMonth() + 1)}/${date.getFullYear()}`;
  }
  if (diffDay === 1) {
    return 'เมื่อวาน';
  }
  // More than 1 day ago
  return `วันที่ ${padTwo(date.getDate())}/${padTwo(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export default function ChatTimestamp({
  timestamp,
  format = 'relative',
  className = '',
}: ChatTimestampProps) {
  const [now, setNow] = useState<Date>(() => new Date());
  const date = new Date(timestamp);
  const absoluteStr = getAbsoluteTime(date);

  // Update every minute for relative display
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60 * 1000); // every minute
    return () => clearInterval(interval);
  }, []);

  const relativeStr = getRelativeTime(date, now);

  // Determine display text
  let displayText: string;
  let tooltipText: string | undefined;
  let ariaLabel: string = absoluteStr; // always full date for accessibility

  if (format === 'relative') {
    displayText = relativeStr;
  } else if (format === 'absolute') {
    displayText = absoluteStr;
  } else { // 'both'
    displayText = relativeStr;
    tooltipText = absoluteStr;
  }

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // When element loses focus, maybe update time? Not needed, but we keep it.
  }, []);

  return (
    <span
      className={`inline-block text-gray-500 text-xs ${className}`}
      title={tooltipText}
      aria-label={ariaLabel}
      role="time"
      onBlur={handleBlur}
    >
      {displayText}
    </span>
  );
}