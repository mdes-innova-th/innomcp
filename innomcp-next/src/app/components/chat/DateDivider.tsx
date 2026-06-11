"use client";

import React from "react";

interface DateDividerProps {
  /** A date string that can be parsed by `new Date()` */
  date: string;
  /** Optional additional class names for the wrapper element */
  className?: string;
}

/**
 * DateDivider – a horizontal line with a centered date label.
 *
 * Displays "วันนี้" for today, "เมื่อวาน" for yesterday,
 * or the date formatted as "DD MMMM YYYY" with Thai month names.
 */
const DateDivider: React.FC<DateDividerProps> = ({ date, className = "" }) => {
  const parsedDate = new Date(date);
  const today = new Date();
  
  // Normalise dates to drop time – compare only year/month/day
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const targetStart = new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate()
  );

  let label: string;

  if (targetStart.getTime() === todayStart.getTime()) {
    label = "วันนี้";
  } else if (targetStart.getTime() === yesterdayStart.getTime()) {
    label = "เมื่อวาน";
  } else {
    // Format: "วัน เดือน(ไทย) ปี"
    const formatter = new Intl.DateTimeFormat("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    label = formatter.format(parsedDate);
  }

  return (
    <div className={`flex items-center gap-4 py-2 ${className}`}>
      <hr className="flex-1 border-t border-gray-300" />
      <span className="shrink-0 text-xs text-gray-500 whitespace-nowrap">
        {label}
      </span>
      <hr className="flex-1 border-t border-gray-300" />
    </div>
  );
};

export default DateDivider;