"use client";

import { useState, useEffect } from "react";

export interface DashboardItem {
  id: string;
  type: 'stat-card' | 'chart' | 'activities';
  title: string;
  colSpan?: number;
  data?: unknown;
  stacked?: boolean;
  stackedAxis?: "x" | "y";
}

export const defaultDashboardItems: DashboardItem[] = [
  {
    id: "total-users",
    type: "stat-card",
    title: "Total Users",
    colSpan: 1,
  },
  {
    id: "active-users",
    type: "stat-card", 
    title: "Active Users (24h)",
    colSpan: 1,
  },
  {
    id: "today-activities",
    type: "stat-card",
    title: "Today's Activities", 
    colSpan: 1,
  },
  {
    id: "activity-chart",
    type: "chart",
    title: "Activity Trends (Last 7 Days)",
    colSpan: 2,
  },
  {
    id: "recent-activities",
    type: "activities",
    title: "Recent Activities",
    colSpan: 1,
  },
];

export function useDashboardLayout() {
  const [items, setItems] = useState<DashboardItem[]>(defaultDashboardItems);
  const [isLayoutSaved, setIsLayoutSaved] = useState(false);

  // Load layout from localStorage on mount
  useEffect(() => {
    const savedLayout = localStorage.getItem('dashboard-layout');
    if (savedLayout) {
      try {
        const parsedLayout = JSON.parse(savedLayout);
        // Validate that saved layout has all required items
        if (Array.isArray(parsedLayout) && parsedLayout.length === defaultDashboardItems.length) {
          setItems(parsedLayout);
          setIsLayoutSaved(true);
        }
      } catch (error) {
        console.error('Failed to parse saved layout:', error);
        // Fallback to default layout
        setItems(defaultDashboardItems);
      }
    }
  }, []);

  // Save layout to localStorage when items change
  useEffect(() => {
    if (items.length > 0) {
      localStorage.setItem('dashboard-layout', JSON.stringify(items));
      setIsLayoutSaved(true);
    }
  }, [items]);

  const reorderItems = (startIndex: number, endIndex: number) => {
    const result = Array.from(items);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setItems(result);
  };

  const resetLayout = () => {
    setItems(defaultDashboardItems);
    localStorage.removeItem('dashboard-layout');
  };

  return {
    items,
    setItems,
    reorderItems,
    resetLayout,
    isLayoutSaved,
  };
}
