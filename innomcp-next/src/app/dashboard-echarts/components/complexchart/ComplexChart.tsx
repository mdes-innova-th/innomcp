"use client";

import { useState, useEffect } from "react";
import { ViolationGroupProvider } from "@/app/dashboard-echarts/components/complexchart/base/filter/ViolationGroupContext";
import { useRealTime } from "@/app/dashboard-echarts/context/RealTimeContext";
import "@/app/dashboard-echarts/styles/dashboard.css";
import Chart01 from "@/app/dashboard-echarts/components/complexchart/chart01";
import Chart02 from "@/app/dashboard-echarts/components/complexchart/chart02";
import Chart03 from "@/app/dashboard-echarts/components/complexchart/chart03";
import Chart04 from "@/app/dashboard-echarts/components/complexchart/chart04";
import Chart05 from "@/app/dashboard-echarts/components/complexchart/chart05";
import Chart06 from "@/app/dashboard-echarts/components/complexchart/chart06";
import Chart07 from "@/app/dashboard-echarts/components/complexchart/chart07";
import GambleChart01 from "@/app/dashboard-echarts/components/complexchart/gamblechart01";
import GambleChart02 from "@/app/dashboard-echarts/components/complexchart/gamblechart02";
import ReportPreviewModal from "@/app/dashboard-echarts/modal/ReportPreviewModal";
import DashboardChartReel from "@/app/dashboard-echarts/components/complexchart/ComplexChartReel";

// Main Complex Dashboard Component with WebSocket Event Handling
export default function ComplexChart() {
  const { updateData } = useRealTime();

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

      console.log("[Dashboard] Received WebSocket update:", eventType, data);

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

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  type ChartRefType = React.RefObject<HTMLDivElement> | null;
  const [activeChartRef, setActiveChartRef] = useState<ChartRefType>(null);
  const [reportTitle, setReportTitle] = useState("");
  const [reportSubtitle, setReportSubtitle] = useState("");
  const [reportData, setReportData] = useState<{
    tableHeaders: string[];
    tableRows: string[][];
    filename: string;
    valueSuffix?: string;
    dateRange?: { startDate?: string; endDate?: string };
    columnAlignments?: ("left" | "center" | "right")[];
  }>({
    tableHeaders: [],
    tableRows: [],
    filename: "",
    dateRange: { startDate: "", endDate: "" },
  });

  // --- Single report open handler used by all charts ---
  const openReport = (payload: {
    tableHeaders: string[];
    tableRows: string[][];
    filename: string;
    valueSuffix?: string;
    dateRange?: { startDate?: string; endDate?: string };
    title: string;
    subtitle?: string;
    chartDivRef: React.RefObject<HTMLDivElement> | null;
    columnAlignments?: ("left" | "center" | "right")[];
  }) => {
    setActiveChartRef(
      payload.chartDivRef as unknown as React.RefObject<HTMLDivElement>
    );
    setReportTitle(payload.title);
    setReportSubtitle(payload.subtitle || "");
    setReportData({
      tableHeaders: payload.tableHeaders,
      tableRows: payload.tableRows,
      filename: payload.filename,
      valueSuffix: payload.valueSuffix,
      dateRange: payload.dateRange || { startDate: "", endDate: "" },
      columnAlignments: payload.columnAlignments,
    });
    setIsReportModalOpen(true);
  };

  // Render chart slides using the new chart components
  const chartSlides = [
    <Chart01
      key="01"
      id="01"
      title={"สถิติความผิดจำแนกตามประเภท"}
      chartType={"donut"}
      colors={chartColors}
      onOpenReport={openReport}
    />,
    <Chart02
      key="02"
      id="02"
      title={"สถิติความผิดจำแนกตามประเภท"}
      chartType={"bar"}
      colors={chartColors}
      onOpenReport={openReport}
    />,
    <Chart03
      key="03"
      id="03"
      title={"สถิติรายวัน"}
      chartType={"bar"}
      stacked={true}
      stackedAxis="x"
      colors={chartColors}
      onOpenReport={openReport}
    />,
    <Chart04
      key="04"
      id="04"
      title={"สถิติรายเดือน"}
      chartType={"bar"}
      stacked={true}
      stackedAxis="x"
      colors={chartColors}
      onOpenReport={openReport}
    />,
    <Chart05
      key="05"
      id="05"
      title={"ระยะเวลาการดำเนินการเฉลี่ย"}
      chartType={"line"}
      colors={chartColors}
      onOpenReport={openReport}
    />,
  ];

  const aiChartSlides = [
    <Chart06
      key="06"
      id="06"
      title={"เว็บไซต์ผิดกฎหมายที่นำเข้าโดยโครงการ AI รายวัน"}
      colors={chartColors}
      onOpenReport={openReport}
    />,
    <Chart07
      key="07"
      id="07"
      title={"เว็บไซต์ผิดกฎหมายที่นำเข้าโดยโครงการ AI รายเดือน"}
      colors={chartColors}
      onOpenReport={openReport}
    />,
  ];

  const gambleChartSlides = [
    <GambleChart01
      key="08"
      id="08"
      title={"เว็บไซต์ผิดกฎหมายการพนัน แยกตามกลุ่มโดเมนเนม"}
      colors={chartColors}
      onOpenReport={openReport}
    />,
    <GambleChart02
      key="09"
      id="09"
      title={"กลุ่มโดเมนเนมจาก URL แยกตามตัวเลขหลัก"}
      colors={chartColors}
      onOpenReport={openReport}
    />,
  ];

  return (
    <ViolationGroupProvider>
      {/* กรอบ Swiper สำหรับกราฟปกติ */}

      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        สถิติภาพรวมเว็บไซต์ผิดกฎหมาย
      </h3>
      <div className="w-full bg-white border-2 border-gray-200 rounded-lg p-2 mb-6">
        <DashboardChartReel slides={chartSlides} id="main-dashboard-charts" />
      </div>

      {/* กรอบ Swiper สำหรับกราฟ AI */}

      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        สถิติจากโครงการ AI
      </h3>
      <div className="w-full bg-white border-2 border-gray-200 rounded-lg p-2 mb-6">
        <DashboardChartReel slides={aiChartSlides} id="ai-dashboard-charts" />
      </div>

      {/* กรอบ Swiper สำหรับกราฟการพนัน */}

      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        สถิติเว็บไซต์การพนัน
      </h3>
      <div className="w-full bg-white border-2 border-gray-200 rounded-lg p-2 mb-6">
        <DashboardChartReel
          slides={gambleChartSlides}
          id="gamble-dashboard-charts"
        />
      </div>

      {/* Report Preview Modal */}
      {isReportModalOpen && activeChartRef && (
        <ReportPreviewModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          chartRef={activeChartRef as React.RefObject<HTMLDivElement>}
          title={reportTitle}
          subtitle={reportSubtitle}
          tableHeaders={reportData.tableHeaders}
          tableRows={reportData.tableRows}
          filename={reportData.filename}
          valueSuffix={reportData.valueSuffix}
          dateRange={reportData.dateRange}
          columnAlignments={reportData.columnAlignments}
        />
      )}
    </ViolationGroupProvider>
  );
}
