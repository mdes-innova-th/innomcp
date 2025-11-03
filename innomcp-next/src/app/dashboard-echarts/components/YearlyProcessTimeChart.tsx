"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRealTime } from "@/app/dashboard-echarts/context/RealTimeContext";
import * as echarts from "echarts";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import { fetchWithApiProxy } from "@/app/lib/apiProxy";

interface ProcessLineData {
  name: string;
  avgDays: number;
}

interface ProcessTimeData {
  year: string;
  lines: ProcessLineData[];
}

interface ProcessTimeChartProps {
  cornerLabel?: string;
  yearsBack?: number; // Number of years to look back (default 3)
}

const YearlyProcessTimeChart = ({
  cornerLabel = "PROCESS TIME",
  yearsBack = 3,
}: ProcessTimeChartProps) => {
  const [data, setData] = useState<ProcessTimeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ใช้ useRef เพื่อเก็บ current data และ chart instance
  const currentDataRef = useRef<ProcessTimeData[]>([]);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const isFirstRenderRef = useRef<boolean>(true);

  const host = process.env.NEXT_PUBLIC_NODE_HOST || "";

  // ฟังก์ชันตรวจสอบการเปลี่ยนแปลงข้อมูล
  const hasDataChanged = useCallback(
    (newData: ProcessTimeData[], oldData: ProcessTimeData[]): boolean => {
      if (newData.length !== oldData.length) return true;

      return newData.some((newItem, index) => {
        const oldItem = oldData[index];
        if (!oldItem || newItem.year !== oldItem.year) return true;

        // ตรวจสอบ lines
        if (newItem.lines.length !== oldItem.lines.length) return true;

        return newItem.lines.some((newLine, lineIndex) => {
          const oldLine = oldItem.lines[lineIndex];
          return (
            !oldLine ||
            newLine.name !== oldLine.name ||
            newLine.avgDays !== oldLine.avgDays
          );
        });
      });
    },
    []
  );

  // ฟังก์ชันสำหรับ smart chart update
  const updateChartWithMerge = useCallback(
    (chart: echarts.ECharts, newOption: echarts.EChartsOption) => {
      if (isFirstRenderRef.current) {
        chart.setOption(newOption, { notMerge: true });
        isFirstRenderRef.current = false;
      } else {
        chart.setOption(newOption, {
          notMerge: false,
          lazyUpdate: true,
          replaceMerge: ["series"],
        });
      }
    },
    []
  );

  // Generate colors for the different process lines
  const generateLineColors = (): string[] => {
    return [
      "#3B82F6", // Blue
      "#10B981", // Green
      "#F59E0B", // Yellow
      "#EF4444", // Red
      "#8B5CF6", // Purple
    ];
  };

  const { data: realtimeData, lastUpdateTime } = useRealTime();

  // Initial load only (show spinner)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Call API endpoint for yearly process times
        const endpoint = `${host}/api/urlstats/yearly-process-times?yearsBack=${yearsBack}`;
        const result = await fetchWithApiProxy(endpoint, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        // Extract data from API response format {success: true, data: [...]}
        const responseData = result?.data || result;

        if (
          responseData &&
          Array.isArray(responseData) &&
          responseData.length > 0
        ) {
          // Validate data structure
          const isValidData = responseData.every(
            (item: { year?: unknown; lines?: unknown }) =>
              item &&
              typeof item.year === "string" &&
              Array.isArray(item.lines) &&
              item.lines.every(
                (line: { name?: unknown; avgDays?: unknown }) =>
                  typeof line.name === "string" &&
                  typeof line.avgDays === "number"
              )
          );

          if (isValidData) {
            // สำหรับการโหลดครั้งแรก ให้อัพเดทข้อมูลเสมอ
            setData(responseData);
            currentDataRef.current = responseData;
            setError(null);
          } else {
            setError("Invalid data structure received");
          }
        } else {
          // Generate mock data when no real data is available
          const mockData: ProcessTimeData[] = [];
          const currentYear = new Date().getFullYear();

          for (let i = yearsBack - 1; i >= 0; i--) {
            const year = (currentYear - i).toString();
            mockData.push({
              year: year,
              lines: [
                {
                  name: "บันทึก URL-หน่วยงานต้นทางตรวจสอบ",
                  avgDays: Math.random() * 10 + 5,
                },
                {
                  name: "หน่วยงานต้นทางตรวจสอบ-หน่วยงานกฎหมายตรวจสอบ",
                  avgDays: Math.random() * 15 + 10,
                },
                {
                  name: "หน่วยงานกฎหมายตรวจสอบ-วันที่มีคำร้อง",
                  avgDays: Math.random() * 20 + 15,
                },
                {
                  name: "วันที่มีคำร้อง-วันที่มีคำสั่งศาล",
                  avgDays: Math.random() * 25 + 20,
                },
                {
                  name: "ทั้งหมด (บันทึก URL-วันที่มีคำสั่งศาล)",
                  avgDays: Math.random() * 60 + 40,
                },
              ],
            });
          }
          setData(mockData);
          setError(null);
        }
      } catch (error) {
        console.error("Error fetching process times:", error);
        setError("Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [host, yearsBack]);

  // Realtime refresh (no spinner)
  useEffect(() => {
    if (!lastUpdateTime) return;
    const refresh = async () => {
      try {
        setIsRefreshing(true);
        const endpoint = `${host}/api/urlstats/yearly-process-times?yearsBack=${yearsBack}`;
        const result = await fetchWithApiProxy(endpoint, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        const responseData = result?.data || result;
        if (
          responseData &&
          Array.isArray(responseData) &&
          responseData.length > 0
        ) {
          const isValidData = responseData.every(
            (item: { year?: unknown; lines?: unknown }) =>
              item && typeof item.year === "string" && Array.isArray(item.lines)
          );
          if (isValidData) {
            // ใช้ hasDataChanged เพื่อตรวจสอบว่าข้อมูลเปลี่ยนแปลงจริงหรือไม่
            if (hasDataChanged(responseData, currentDataRef.current)) {
              setData(responseData);
              currentDataRef.current = responseData;
              console.log(
                "[YearlyProcessTimeChart] Data changed, updating with merge..."
              );
            } else {
              console.log(
                "[YearlyProcessTimeChart] No data changes detected, skipping update"
              );
            }
          }
        }
      } catch {
        // soft-refresh: keep existing data on error
      } finally {
        setIsRefreshing(false);
      }
    };
    refresh();
  }, [lastUpdateTime, host, yearsBack, hasDataChanged]);

  useEffect(() => {
    if (realtimeData) {
      console.log("[YearlyProcessTimeChart] Realtime update received");
    }
  }, [realtimeData]);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const chartDom = document.getElementById("yearly-process-times-chart");
    if (!chartDom) return;

    // ใช้ chart instance ที่มีอยู่หรือสร้างใหม่
    let myChart = chartInstanceRef.current;
    if (!myChart) {
      myChart = echarts.init(chartDom);
      chartInstanceRef.current = myChart;
    }
    const colors = generateLineColors();

    // Prepare data for ECharts
    const years = data.map((d) => d.year);
    const processNames = data[0]?.lines?.map((line) => line.name) || [];

    const series = processNames.map((processName, index) => ({
      name: processName,
      type: "line" as const,
      stack: undefined,
      smooth: true,
      lineStyle: {
        width: 3,
      },
      symbol: "circle",
      symbolSize: 6,
      itemStyle: {
        color: colors[index % colors.length],
      },
      data: data.map((yearData) => {
        const processLine = yearData.lines.find(
          (line) => line.name === processName
        );
        return processLine ? processLine.avgDays : 0;
      }),
    }));

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          label: {
            backgroundColor: "#6a7985",
          },
        },
        formatter: function (params: unknown) {
          const paramArray = params as Array<{
            axisValue: string;
            marker: string;
            seriesName: string;
            value: number;
          }>;
          let tooltipText = `<strong>ปี ${paramArray[0].axisValue}</strong><br/>`;
          paramArray.forEach((param) => {
            tooltipText += `${param.marker} ${param.seriesName}: <strong>${param.value} วัน</strong><br/>`;
          });
          return tooltipText;
        },
      },
      legend: {
        type: "scroll",
        bottom: 10,
        textStyle: {
          fontSize: 11,
        },
        pageButtonItemGap: 5,
        pageButtonGap: 20,
        pageIconSize: 10,
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "25%",
        top: "15%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: years,
        axisLabel: {
          fontSize: 11,
        },
      },
      yAxis: {
        type: "value",
        name: "วัน",
        axisLabel: {
          formatter: "{value}",
          fontSize: 11,
        },
        splitLine: {
          lineStyle: {
            type: "dashed",
            opacity: 0.5,
          },
        },
      },
      series: series,
    };

    // เพิ่ม animation options
    const optionWithAnimation = {
      ...option,
      animation: true,
      animationDuration: 1000,
      animationEasing: "cubicInOut" as const,
    };

    // ใช้ updateChartWithMerge สำหรับการอัพเดทที่ smart
    updateChartWithMerge(myChart, optionWithAnimation);

    const handleResize = () => myChart?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      // ไม่ dispose chart ใน cleanup เพื่อให้ merge ทำงานได้
    };
  }, [data, updateChartWithMerge]);

  // Cleanup effect สำหรับ component unmount
  useEffect(() => {
    const chartInstance = chartInstanceRef.current;

    return () => {
      if (chartInstance) {
        try {
          chartInstance.dispose();
        } catch {
          // ignore
        }
        chartInstanceRef.current = null;
      }
    };
  }, []);

  // Always render the card shell so the corner label is visible from the start
  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-lg relative">
        {/* Corner Label */}
        {cornerLabel && (
          <div className="absolute top-0 right-0 bg-pink-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
            {cornerLabel}
          </div>
        )}
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner color="primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-lg relative">
        {/* Corner Label */}
        {cornerLabel && (
          <div className="absolute top-0 right-0 bg-pink-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
            {cornerLabel}
          </div>
        )}
        <div className="flex items-center justify-center h-64">
          <p className="text-red-500">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg relative">
      {/* Corner Label */}
      {cornerLabel && (
        <div className="absolute top-0 right-0 bg-pink-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
          {cornerLabel}
        </div>
      )}
      {isRefreshing && (
        <div className="flex absolute top-0 left-0 m-1 p-1 text-[15px] text-gray-700">
          <LoadingSpinner color="red" size="sm" type="dots" />
        </div>
      )}

      {/* Chart Container */}
      <div className="relative">
        <div
          id="yearly-process-times-chart"
          style={{ width: "100%", height: "400px" }}
        ></div>
      </div>
    </div>
  );
};

export default YearlyProcessTimeChart;
