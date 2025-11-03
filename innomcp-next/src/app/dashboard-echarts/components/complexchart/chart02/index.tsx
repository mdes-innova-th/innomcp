"use client";

import React, { useRef, useState, useEffect } from "react";
import { FaEye, FaChevronDown, FaChevronUp } from "react-icons/fa";
import ViolationGroupChart, {
  type ViolationGroupChartHandle,
} from "@/app/dashboard-echarts/components/complexchart/base/ViolationGroupChart";
import { useRealTime } from "@/app/dashboard-echarts/context/RealTimeContext";

type ReportPayload = {
  tableHeaders: string[];
  tableRows: string[][];
  filename: string;
  valueSuffix?: string;
  dateRange?: { startDate?: string; endDate?: string };
  title: string;
  subtitle?: string;
  chartDivRef: React.RefObject<HTMLDivElement>;
};

type Props = {
  id?: string;
  title?: string;
  chartType?: React.ComponentProps<typeof ViolationGroupChart>["chartType"];
  colors?: string[];
  onDataLabelClick?: React.ComponentProps<
    typeof ViolationGroupChart
  >["onDataLabelClick"];
  onOpenReport: (payload: ReportPayload) => void;
  onOpenUrlModal?: (payload: {
    groupName: string;
    urls?: string[];
    startDate?: string;
    endDate?: string;
  }) => void;
  stacked?: boolean;
  stackedAxis?: "x" | "y";
};

export default function Chart02({
  id = "02",
  title = "",
  chartType = "bar",
  colors,
  onDataLabelClick,
  onOpenReport,
  onOpenUrlModal,
  stacked = false,
  stackedAxis = "y",
}: Props) {
  const chartRef = useRef<ViolationGroupChartHandle | null>(null);
  const chartDivRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() =>
    getCollapsedState("chartCollapsed02", true)
  );

  // WebSocket real-time data update
  const { data: realtimeData, lastUpdateTime, markAsRead } = useRealTime();

  useEffect(() => {
    if (!isCollapsed) {
      // When expanded, keep loading true until onLoad is called
      setLoading(true);
      setReady(false);
    }
  }, [isCollapsed]);

  // Auto-refresh chart when new data arrives via WebSocket
  useEffect(() => {
    if (
      realtimeData &&
      lastUpdateTime &&
      chartRef.current &&
      ready &&
      !isCollapsed
    ) {
      console.log(
        "[Chart02] Refreshing chart due to WebSocket update:",
        lastUpdateTime
      );

      // โดยปกติ ViolationGroupChart จะมี method สำหรับ refresh ข้อมูล
      if (typeof chartRef.current.refreshData === "function") {
        chartRef.current.refreshData();
      }

      // Mark the update as read
      markAsRead();
    }
  }, [realtimeData, lastUpdateTime, ready, isCollapsed, markAsRead]);

  function getCollapsedState(key: string, defaultValue: boolean): boolean {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      const storedValue = localStorage.getItem(key);
      return storedValue !== null ? JSON.parse(storedValue) : defaultValue;
    }
    return defaultValue;
  }
  function setCollapsedState(key: string, value: boolean): void {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  const toggle = () => {
    const ns = !isCollapsed;
    setIsCollapsed(ns);
    setCollapsedState("chartCollapsed02", ns);
  };

  const handlePreview = () => {
    const chartTitle =
      typeof chartRef.current?.getTitle === "function"
        ? chartRef.current.getTitle()
        : title;
    const rows =
      typeof chartRef.current?.getChartData === "function"
        ? chartRef.current.getChartData()
        : [];
    onOpenReport({
      tableHeaders: ["ประเภทความผิด", "จำนวน URL"],
      tableRows: rows,
      filename: `${chartTitle.replace(/\s+/g, "_").toLowerCase()}_report.docx`,
      valueSuffix: "URL",
      dateRange: { startDate: "", endDate: "" },
      title: chartTitle,
      subtitle: "",
      chartDivRef: chartDivRef as React.RefObject<HTMLDivElement>,
    });
  };

  const handleLabelClick = async (
    groupName: string,
    startDate?: string,
    endDate?: string
  ) => {
    try {
      const params = new URLSearchParams();
      params.append("groupName", groupName);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      const host = process.env.NEXT_PUBLIC_NODE_BACKEND_HOST || "";
      const endpoint = `${host}/api/urlstats/list-by-group?${params.toString()}`;
      const res = await fetch(endpoint, {
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      onOpenUrlModal?.({
        groupName,
        urls: data.urls || [],
        startDate: startDate || "",
        endDate: endDate || "",
      });
    } catch {
      onOpenUrlModal?.({
        groupName,
        urls: [],
        startDate: startDate || "",
        endDate: endDate || "",
      });
    }
  };

  return (
    <div
      data-chart-id={id}
      ref={chartDivRef}
      className={`bg-white w-full max-w-full rounded-lg shadow-lg transition-all duration-300 ${
        isCollapsed ? "h-16" : "min-h-[400px] h-auto"
      }`}
    >
      <div className="p-2">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="bg-gray-100 hover:bg-gray-200 cursor-pointer p-1.5 h-8 w-8 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
              title={isCollapsed ? "ขยาย" : "ย่อ"}
              aria-label={isCollapsed ? "ขยายกราฟ" : "ย่อกราฟ"}
            >
              {isCollapsed ? (
                <FaChevronDown size={16} />
              ) : (
                <FaChevronUp size={16} />
              )}
            </button>
            <button
              onClick={handlePreview}
              className="text-sm flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors shadow-sm cursor-pointer"
              title="พรีวิวและดาวน์โหลดรายงาน"
              style={{
                display: !isCollapsed && !loading && ready ? undefined : "none",
              }}
            >
              <FaEye className="mr-2" size={16} /> พรีวิวรายงาน
            </button>
          </div>
        </div>
        {!isCollapsed && (
          <div className="mt-4">
            <ViolationGroupChart
              chartType={chartType}
              ref={chartRef}
              onDataLabelClick={onDataLabelClick || handleLabelClick}
              colors={colors}
              stacked={stacked}
              stackedAxis={stackedAxis}
              onLoad={() => {
                setLoading(false);
                setReady(true);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
