"use client";

import React from "react";

export type ToolType = 'auto' | 'weather' | 'calculation' | 'art' | 'data' | 'datetime' | 'officer';

interface ToolTypeBadgeProps {
  toolType?: ToolType;
  toolsUsed?: string[];
  theme: string;
}

const ToolTypeBadge: React.FC<ToolTypeBadgeProps> = ({ toolType, toolsUsed, theme }) => {
  if (!toolType || toolType !== 'auto' || !toolsUsed || toolsUsed.length === 0) {
    return null;
  }

  // Map tool names to types
  const getToolTypeFromName = (toolName: string): { type: ToolType; icon: string; label: string; color: string; borderColor: string } | null => {
    const lowerName = toolName.toLowerCase();
    
    if (lowerName.includes('weather') || lowerName.includes('nwp') || lowerName.includes('tmd')) {
      return {
        type: 'weather',
        icon: '🌤️',
        label: 'สภาพอากาศ',
        color: 'text-blue-600 dark:text-blue-300',
        borderColor: 'border-blue-500'
      };
    }
    
    if (lowerName.includes('calculator') || lowerName.includes('newton') || lowerName.includes('math')) {
      return {
        type: 'calculation',
        icon: '🔢',
        label: 'คำนวณ',
        color: 'text-green-600 dark:text-green-300',
        borderColor: 'border-green-500'
      };
    }
    
    if (lowerName.includes('echart') || lowerName.includes('chart') || lowerName.includes('image')) {
      return {
        type: 'art',
        icon: '🎨',
        label: 'ศิลปะ',
        color: 'text-pink-600 dark:text-pink-300',
        borderColor: 'border-pink-500'
      };
    }
    
    if (lowerName.includes('worldbank') || lowerName.includes('archive') || lowerName.includes('nasa') || lowerName.includes('govdata')) {
      return {
        type: 'data',
        icon: '📊',
        label: 'ข้อมูล',
        color: 'text-orange-600 dark:text-orange-300',
        borderColor: 'border-orange-500'
      };
    }
    
    if (lowerName.includes('datetime') || lowerName.includes('time') || lowerName.includes('date')) {
      return {
        type: 'datetime',
        icon: '⏰',
        label: 'วัน-เวลา',
        color: 'text-cyan-600 dark:text-cyan-300',
        borderColor: 'border-cyan-500'
      };
    }
    
    return null;
  };

  // Get unique tool types from tools used
  const toolTypeInfo = toolsUsed
    .map(getToolTypeFromName)
    .filter((info): info is NonNullable<typeof info> => info !== null)
    .reduce((acc, current) => {
      if (!acc.find(item => item.type === current.type)) {
        acc.push(current);
      }
      return acc;
    }, [] as Array<{ type: ToolType; icon: string; label: string; color: string; borderColor: string }>);

  if (toolTypeInfo.length === 0) {
    return null;
  }

  // Phase 10.53 — tighter chips: thinner border (was 2 px), smaller text,
  // remove the redundant "AI ใช้เครื่องมือ:" prefix since the icon already
  // signals "tool category". Now reads as one compact row, not a banner.
  return (
    <div className="mt-2 mb-3 flex flex-wrap gap-1.5">
      {toolTypeInfo.map((info) => (
        <div
          key={info.type}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all ${info.borderColor.replace('border-', 'border-')}/40 ${info.color} ${
            theme === 'light' ? 'bg-white/85 shadow-sm' : 'bg-card shadow-sm'
          }`}
        >
          <span className="text-[13px] leading-none">{info.icon}</span>
          <span>{info.label}</span>
        </div>
      ))}
    </div>
  );
};

export default ToolTypeBadge;
