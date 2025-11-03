"use client";

import { useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/context/ThemeContext";
import {
  RealTimeProvider,
  useRealTime,
} from "@/app/dashboard-echarts/context/RealTimeContext";
import useConnectWebsocket from "@/app/dashboard-echarts/hooks/useConnectWebsocket";
import "@/app/dashboard-echarts/styles/dashboard.css";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import ComplexChart from "@/app/dashboard-echarts/components/complexchart/ComplexChart";
import HeaderDashboard from "@/app/components/HeaderDashboard";

// Complex Chart Page Component
function ComplexChartPageContent() {
  const { theme } = useTheme();
  const { updateData, setRealtimeEnabled } = useRealTime();

  // WebSocket hook for realtime functionality
  const {
    isEnabled: isMonitorOn,
    connectionState,
    enable,
    disable,
  } = useConnectWebsocket(false);

  useEffect(() => {
    // Setup WebSocket event listener
    const handleDashboardUpdate = (event: CustomEvent) => {
      const { event: eventType, data } = event.detail;

      console.log("[ComplexChart] Received WebSocket update:", eventType);

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
    }
  };

  // compute indicator classes for connection status
  const statusClass = !isMonitorOn
    ? "bg-gray-500"
    : connectionState === "connected"
    ? "bg-green-500"
    : "bg-red-500";

  const statusTextClass = !isMonitorOn
    ? "text-gray-700"
    : connectionState === "connected"
    ? "text-green-600"
    : "text-red-600";

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
    // กำหนด layout ของหน้าให้ใกล้เคียงหรือเหมือนกับ page.tsx หน้าแรก
    <div
      className={`min-h-screen mx-4 mt-8 ${
        theme === "light" ? "bg-gray-100" : "bg-transparent"
      }`}
    >
      <HeaderDashboard />

      <div className="p-6">
        <div className="bg-white rounded-lg p-6 shadow-lg">
          <ComplexChart />
        </div>
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
          <span
            aria-hidden
            className={`inline-block w-4 h-4 rounded-full mr-2 shadow-sm transition-colors duration-200 ${statusClass} ${
              isMonitorOn && connectionState !== "off" ? "status-blink" : ""
            }`}
          />
          <span className={`text-sm font-medium ${statusTextClass}`}>
            {statusLabel}
          </span>
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
  );
}

// Main Export with RealTimeProvider wrapper
export default function ComplexChartPage() {
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
      <ComplexChartPageContent />
    </RealTimeProvider>
  );
}
