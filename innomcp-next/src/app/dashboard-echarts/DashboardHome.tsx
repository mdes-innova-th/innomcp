"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useTheme } from "@/app/context/ThemeContext";
import { useRouter } from "next/navigation";
import {
  RealTimeProvider,
  useRealTime,
} from "@/app/dashboard-echarts/context/RealTimeContext";
import useConnectWebsocket from "@/app/dashboard-echarts/hooks/useConnectWebsocket";
import "@/app/dashboard-echarts/styles/dashboard.css";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import UrlCountDonutChart from "@/app/dashboard-echarts/components/UrlCountDonutChart";
import TopOfficeCard from "@/app/dashboard-echarts/components/TopOfficeCard";
import TopCategoryCard from "@/app/dashboard-echarts/components/TopCategoryCard";
import TopCourtCard from "@/app/dashboard-echarts/components/TopCourtCard";
import YearsTrendChart from "@/app/dashboard-echarts/components/YearsTrendChart";
import MonthlyTrendChart from "@/app/dashboard-echarts/components/MonthlyTrendChart";
import YearlyProcessTimeChart from "@/app/dashboard-echarts/components/YearlyProcessTimeChart";
import TodayByOfficeChart from "@/app/dashboard-echarts/components/TodayByOfficeChart";
import PlatformsCard from "@/app/dashboard-echarts/components/PlatformsCard";
import RegisterCard from "@/app/dashboard-echarts/components/RegisterCard";
import HeaderDashboard from "@/app/components/HeaderDashboard";

// Main Dashboard Component with WebSocket Event Handling
function DashboardHomeContent() {
  const { theme } = useTheme();

  const { updateData, setRealtimeEnabled } = useRealTime();

  // WebSocket hook for realtime functionality
  const {
    isEnabled: isMonitorOn,
    connectionState,
    enable,
    disable,
  } = useConnectWebsocket(false);

  // Store chart colors in state to avoid SSR hydration mismatch
  const [chartColors, setChartColors] = useState<string[]>([]);

  useEffect(() => {
    function getChartColors(count = 20): string[] {
      if (typeof window === "undefined") return [];
      const styles = getComputedStyle(document.documentElement);
      return Array.from({ length: count }, (_, i) =>
        styles.getPropertyValue(`--chart-color-${i + 1}`).trim()
      ).filter((c): c is string => !!c);
    }
    setChartColors(getChartColors());

    // Setup WebSocket event listener
    const handleDashboardUpdate = (event: CustomEvent) => {
      const { event: eventType, data } = event.detail;

      console.log("[Dashboard] Received WebSocket update:", eventType);

      // อัปเดตข้อมูลใน RealTimeContext
      if (data) {
        updateData(data);
      }
    };

    // Listen for WebSocket dashboard updates
    window.addEventListener(
      "webddsb:dashboard",
      handleDashboardUpdate as EventListener
    );

    return () => {
      window.removeEventListener(
        "webddsb:dashboard",
        handleDashboardUpdate as EventListener
      );
    };
  }, [updateData]);

  // Real-time toggle handler
  const handleToggleMonitor = () => {
    if (isMonitorOn) {
      disable();
      setRealtimeEnabled(false);
    } else {
      enable();
      setRealtimeEnabled(true);
      // เชื่อมต่อ WebSocket เท่านั้น ไม่ดึงข้อมูล
    }
  };

  // compute indicator classes for connection status
  // three visual states: off (gray), connected (green), disconnected (red)
  const statusClass = !isMonitorOn
    ? "bg-gray-500"
    : connectionState === "connected"
    ? "bg-green-500"
    : "bg-red-500";

  // text color for the Real-time label to match the status indicator
  const statusTextClass = !isMonitorOn
    ? "text-gray-700"
    : connectionState === "connected"
    ? "text-green-600"
    : "text-red-600";
  // label text for the Real-time status
  const statusLabel = !isMonitorOn ? (
    "Real-time: ปิด"
  ) : connectionState === "connected" ? (
    <span className="rounded bg-green-500 text-white font-semibold px-3 py-0.5">
      Real-time
    </span>
  ) : (
    "Real-time: ไม่เชื่อมต่อ"
  );

  return (
    <>
      <div
        className={`min-h-screen ${
          theme === "light" ? "bg-gray-100" : "bg-transparent"
        }`}
      >
        <HeaderDashboard />

        <div className="p-6 space-y-8">
          {/* Main Stats Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* URL Count Donut Chart Card */}
            <div className="bg-white rounded-lg p-2 shadow-lg">
              <UrlCountDonutChart colors={chartColors} countType="total" />
            </div>

            {/* Contracted Card */}
            <div className="bg-white rounded-lg p-2 shadow-lg">
              <UrlCountDonutChart
                colors={chartColors}
                countType="petition"
                cornerLabel="PT"
              />
            </div>

            {/* Unlisted Card */}
            <div className="bg-white rounded-lg p-2 shadow-lg">
              <UrlCountDonutChart
                colors={chartColors}
                countType="court"
                cornerLabel="CT"
              />
            </div>

            {/* AI Imports Card */}
            <div className="bg-white rounded-lg p-2 shadow-lg">
              <UrlCountDonutChart
                colors={chartColors}
                countType="ai"
                cornerLabel="AI"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Organizations*/}
            <TopOfficeCard cornerLabel="TOP OFFICE" toprank={5} />

            {/* Top Categories */}
            <TopCategoryCard cornerLabel="TOP CATEGORY" toprank={5} />

            {/* Top Court */}
            <TopCourtCard cornerLabel="TOP COURT" toprank={5} />
          </div>

          {/* Today Office Bar Chart */}
          <TodayByOfficeChart cornerLabel="TODAY OFFICE" />

          {/* Years Trends Card */}
          <YearsTrendChart
            cornerLabel="YEARS TRENDS"
            toprank={5}
            yearsBack={3}
          />

          {/* Monthly Trends Card */}
          <MonthlyTrendChart
            cornerLabel="MONTHLY TRENDS"
            toprank={5}
            monthsBack={6}
          />

          {/* Yearly Process Time Card */}
          <YearlyProcessTimeChart cornerLabel="PROCESS TIME" yearsBack={5} />

          {/* Platforms Pie Chart Card */}
          <PlatformsCard cornerLabel="PLATFORMS" />

          {/* Register Card */}
          <RegisterCard cornerLabel="REGISTER" />
        </div>

        {/* Fixed Real-time Control Button */}
        <div className="fixed m-0 rounded-t-2xl border border-gray-400 bg-gray-50 bottom-0 right-10 z-[900]">
          <button
            type="button"
            onClick={handleToggleMonitor}
            aria-pressed={isMonitorOn}
            aria-label={isMonitorOn ? "ปิด Real-time" : "เปิด Real-time"}
            title={isMonitorOn ? "ปิด Real-time" : "เปิด Real-time"}
            className="inline-flex items-center cursor-pointer p-2 transition-all duration-200"
          >
            {/* visible circle with label */}
            <span
              aria-hidden
              className={`inline-block w-4 h-4 rounded-full mr-2 shadow-sm transition-colors duration-200 ${statusClass} ${
                isMonitorOn && connectionState !== "off" ? "status-blink" : ""
              }`}
            />
            <span className={`text-sm font-medium ${statusTextClass}`}>
              {statusLabel}
            </span>
            {/* screen-reader-only status text */}
            <span className="sr-only">
              {isMonitorOn
                ? connectionState === "connected"
                  ? "เชื่อมต่อแล้ว"
                  : "ตัดการเชื่อมต่อ"
                : "ปิด Real-time"}
            </span>
          </button>
        </div>
      </div>
    </>
  );
}

// Main Export with RealTimeProvider wrapper
export default function DashboardHome() {
  const { isLoggedIn, isAuthLoading } = useAuth();
  const router = useRouter();

  // Redirect once auth check completes and user is not logged in
  useEffect(() => {
    if (!isAuthLoading && !isLoggedIn) {
      router.push("/user/login");
    }
  }, [isAuthLoading, isLoggedIn, router]);

  if (isAuthLoading) {
    return (
      <div className="w-full flex items-center justify-center p-8">
        <span className="text-sm text-gray-600">
          <LoadingSpinner color="light-gray" />
        </span>
      </div>
    );
  }

  if (!isLoggedIn) return null; // already redirecting

  return (
    <RealTimeProvider>
      <DashboardHomeContent />
    </RealTimeProvider>
  );
}
