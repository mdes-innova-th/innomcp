"use client";

import React, { useRef, useState, useEffect } from "react";
import { useRealTime } from "@/app/dashboard-echarts/context/RealTimeContext";
import * as echarts from "echarts";
import { fetchWithApiProxy } from "@/app/lib/apiProxy";
import { getCSRFToken } from "@/utils/csrf";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";

type UrlCountData = {
  source_type: string;
  url_count: number;
  total_urls: number;
};

type ChartDataItem = {
  x: string;
  y: number;
  label: string;
  percentage?: number;
  isEmpty?: boolean; // Add flag to identify empty segments
  itemStyle?: {
    // Add custom styling for segments
    color?: string;
  };
  emphasis?: {
    disabled?: boolean;
  };
};

type Props = {
  colors?: string[];
  countType?: "total" | "petition" | "court" | "percentage" | "ai";
  /** Controls the border radius (rounded corners) for donut chart segments. Default is 8. Set to 0 for no rounded corners. */
  borderRadius?: number;
  onLoad?: () => void;
  onError?: () => void;
  /** Content to display at the bottom-right corner of the card */
  cornerLabel?: React.ReactNode;
};

export default function UrlCountDonutChart({
  colors = ["#3b82f6", "#10b981", "#f59e0b"],
  countType = "total",
  borderRadius = 8, // Default border radius for rounded corners
  onLoad,
  onError,
  cornerLabel: cornerLabel,
}: Props) {
  const chartDivRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<UrlCountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [randomColors, setRandomColors] = useState<string[]>([]);

  // ใช้ useRef เพื่อเก็บ current data และ track การ init ครั้งแรก
  const currentDataRef = useRef<UrlCountData[]>([]);
  const isFirstRenderRef = useRef<boolean>(true);

  // Generate random colors with gray for empty space
  const generateRandomColors = (count: number = 10): string[] => {
    const generatedColors: string[] = [];
    for (let i = 0; i < count - 1; i++) {
      // Generate one less to reserve space for gray
      const hue = Math.floor(Math.random() * 360);
      const saturation = Math.floor(Math.random() * 40) + 60; // 60-100%
      const lightness = Math.floor(Math.random() * 30) + 40; // 40-70%
      generatedColors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    // Always add gray as the last color for empty space
    generatedColors.push("#d1d5db"); // Gray-300
    return generatedColors;
  };

  // Get colors array with gray for empty space (stable across renders)
  const getColorsWithGray = React.useCallback(() => {
    const baseColors = [...colors];
    // Add gray color for empty space segments
    baseColors.push("#d1d5db"); // Gray-300
    return baseColors;
  }, [colors]);

  // ฟังก์ชันตรวจสอบการเปลี่ยนแปลงข้อมูล
  const hasDataChanged = React.useCallback(
    (newData: UrlCountData[], oldData: UrlCountData[]): boolean => {
      if (newData.length !== oldData.length) return true;

      return newData.some((newItem, index) => {
        const oldItem = oldData[index];
        return (
          !oldItem ||
          newItem.source_type !== oldItem.source_type ||
          newItem.url_count !== oldItem.url_count ||
          newItem.total_urls !== oldItem.total_urls
        );
      });
    },
    []
  );

  // ฟังก์ชันสำหรับ smart chart update
  const updateChartWithMerge = React.useCallback(
    (
      chart: echarts.ECharts,
      newOption: echarts.EChartsOption,
      forceUpdate: boolean = false
    ) => {
      if (isFirstRenderRef.current || forceUpdate) {
        // ครั้งแรกหรือ force update ให้ใช้ replace
        chart.setOption(newOption, { notMerge: true });
        isFirstRenderRef.current = false;
      } else {
        // การอัพเดทครั้งต่อไปใช้ merge สำหรับความนุ่มนวล
        chart.setOption(newOption, {
          notMerge: false, // ใช้ merge mode
          lazyUpdate: true, // อัพเดทแบบ lazy
          replaceMerge: ["series"], // merge เฉพาะ series
        });
      }
    },
    []
  );

  // Initialize random colors on component mount
  useEffect(() => {
    setRandomColors(generateRandomColors(10));
  }, []);

  const host = process.env.NEXT_PUBLIC_NODE_HOST || "";

  // Load data on component mount and when realtime updates arrive
  const { data: realtimeData, lastUpdateTime } = useRealTime();

  useEffect(() => {
    if (realtimeData) {
      console.log("[UrlCountDonutChart] Realtime update received");
    }
  }, [realtimeData]);

  // Initial load
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const csrfToken = await getCSRFToken();
        const url =
          countType === "ai"
            ? `${host}/api/urlstats/ai-count`
            : `${host}/api/urlstats/total-count`;
        const result = await fetchWithApiProxy(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken || "",
          },
        });
        const actualData = result?.data?.data || result?.data || result;
        const dataArray = Array.isArray(actualData) ? actualData : [];

        // สำหรับการโหลดครั้งแรก ให้อัพเดทข้อมูลเสมอ
        setData(dataArray);
        currentDataRef.current = dataArray; // อัพเดท ref ด้วย
        setRandomColors(generateRandomColors(10));
        onLoad?.();
      } catch (err) {
        console.error("Error fetching URL count data:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMessage);
        onError?.();
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [host, countType, onLoad, onError]);

  // Realtime refresh (no spinner)
  useEffect(() => {
    if (!lastUpdateTime) return;
    const refresh = async () => {
      try {
        setIsRefreshing(true);
        const csrfToken = await getCSRFToken();
        const url =
          countType === "ai"
            ? `${host}/api/urlstats/ai-count`
            : `${host}/api/urlstats/total-count`;
        const result = await fetchWithApiProxy(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken || "",
          },
        });
        const actualData = result?.data?.data || result?.data || result;
        const dataArray = Array.isArray(actualData) ? actualData : [];

        // ใช้ hasDataChanged เพื่อตรวจสอบว่าข้อมูลเปลี่ยนแปลงจริงหรือไม่
        if (hasDataChanged(dataArray, currentDataRef.current)) {
          setData(dataArray);
          currentDataRef.current = dataArray; // อัพเดท ref ด้วย
          setRandomColors(generateRandomColors(10));
          console.log(
            "[UrlCountDonutChart] Data changed, updating with merge..."
          );
        } else {
          console.log(
            "[UrlCountDonutChart] No data changes detected, skipping update"
          );
        }
      } catch (err) {
        console.error("Error refreshing URL count data:", err);
      } finally {
        setIsRefreshing(false);
      }
    };
    refresh();
  }, [lastUpdateTime, host, countType, hasDataChanged]);

  // Transform data for the donut chart
  const chartData = React.useMemo((): ChartDataItem[] => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }

    const result: ChartDataItem[] = [];

    // Handle different countType values
    switch (countType) {
      case "percentage":
        // For percentage display, show both petition and court as percentage of total
        const totalItem = data.find((item) => item.source_type === "total");
        const petitionItem = data.find(
          (item) => item.source_type === "petition"
        );
        const courtItem = data.find((item) => item.source_type === "court");

        const totalCount = totalItem?.url_count || 0;

        if (totalCount > 0) {
          if (petitionItem && petitionItem.url_count > 0) {
            const petitionPercentage =
              (petitionItem.url_count / totalCount) * 100;
            result.push({
              x: "คำร้อง",
              y: petitionItem.url_count,
              label: `คำร้อง (${petitionPercentage.toFixed(2)}%)`,
              percentage: petitionPercentage,
            });
          }

          if (courtItem && courtItem.url_count > 0) {
            const courtPercentage = (courtItem.url_count / totalCount) * 100;
            result.push({
              x: "คำสั่งศาล",
              y: courtItem.url_count,
              label: `คำสั่งศาล (${courtPercentage.toFixed(2)}%)`,
              percentage: courtPercentage,
            });
          }

          // Add remaining URLs (those without petition or court)
          const remainingCount =
            totalCount -
            (petitionItem?.url_count || 0) -
            (courtItem?.url_count || 0);
          if (remainingCount > 0) {
            const remainingPercentage = (remainingCount / totalCount) * 100;
            result.push({
              x: "อื่นๆ",
              y: remainingCount,
              label: `อื่นๆ (${remainingPercentage.toFixed(2)}%)`,
              percentage: remainingPercentage,
            });
          }
        }
        break;

      case "petition":
        // For petition display, show percentage of total with gray empty space
        const totalForPetition = data.find(
          (item) => item.source_type === "total"
        );
        const petitionData = data.find(
          (item) => item.source_type === "petition"
        );

        if (totalForPetition && totalForPetition.url_count > 0) {
          const petitionPercentage =
            petitionData && petitionData.url_count > 0
              ? (petitionData.url_count / totalForPetition.url_count) * 100
              : 0;

          if (petitionPercentage > 0) {
            result.push({
              x: "คำร้อง",
              y: petitionPercentage,
              label: `คำร้อง (${petitionPercentage.toFixed(2)}%)`,
              percentage: petitionPercentage,
            });
          }

          // Add gray empty space for remaining percentage
          const emptyPercentage = 100 - petitionPercentage;
          if (emptyPercentage > 0) {
            result.push({
              x: "", // Empty name to hide from legend
              y: emptyPercentage,
              label: "", // Empty label to hide tooltips
              percentage: emptyPercentage,
              isEmpty: true,
              itemStyle: {
                color: "#d1d5db", // Gray-300
              },
              emphasis: {
                disabled: true, // Disable hover effects
              },
            });
          }
        } else {
          // If no total data, show 100% empty
          result.push({
            x: "", // Empty name to hide from legend
            y: 100,
            label: "", // Empty label to hide tooltips
            percentage: 100,
          });
        }
        break;

      case "court":
        // For court display, show percentage of total with gray empty space
        const totalForCourt = data.find((item) => item.source_type === "total");
        const courtData = data.find((item) => item.source_type === "court");

        if (totalForCourt && totalForCourt.url_count > 0) {
          const courtPercentage =
            courtData && courtData.url_count > 0
              ? (courtData.url_count / totalForCourt.url_count) * 100
              : 0;

          if (courtPercentage > 0) {
            result.push({
              x: "คำสั่งศาล",
              y: courtPercentage,
              label: `คำสั่งศาล (${courtPercentage.toFixed(2)}%)`,
              percentage: courtPercentage,
            });
          }

          // Add gray empty space for remaining percentage
          const emptyPercentage = 100 - courtPercentage;
          if (emptyPercentage > 0) {
            result.push({
              x: "", // Empty name to hide from legend
              y: emptyPercentage,
              label: "", // Empty label to hide tooltips
              percentage: emptyPercentage,
              isEmpty: true,
              itemStyle: {
                color: "#d1d5db", // Gray-300
              },
              emphasis: {
                disabled: true, // Disable hover effects
              },
            });
          }
        } else {
          // If no total data, show 100% empty
          result.push({
            x: "", // Empty name to hide from legend
            y: 100,
            label: "", // Empty label to hide tooltips
            percentage: 100,
            isEmpty: true,
            itemStyle: {
              color: "#d1d5db", // Gray-300
            },
            emphasis: {
              disabled: true, // Disable hover effects
            },
          });
        }
        break;

      case "ai":
        // For AI display, show percentage of total with gray empty space
        const totalForAI = data.find((item) => item.source_type === "total");
        const aiDataForChart = data.find((item) => item.source_type === "ai");

        if (totalForAI && totalForAI.url_count > 0) {
          const aiPercentageForChart =
            aiDataForChart && aiDataForChart.url_count > 0
              ? (aiDataForChart.url_count / totalForAI.url_count) * 100
              : 0;

          if (aiPercentageForChart > 0) {
            result.push({
              x: "AI",
              y: aiPercentageForChart,
              label: `AI (${aiPercentageForChart.toFixed(2)}%)`,
              percentage: aiPercentageForChart,
            });
          }

          // Add gray empty space for remaining percentage
          const emptyPercentage = 100 - aiPercentageForChart;
          if (emptyPercentage > 0) {
            result.push({
              x: "", // Empty name to hide from legend
              y: emptyPercentage,
              label: "", // Empty label to hide tooltips
              percentage: emptyPercentage,
              isEmpty: true,
              itemStyle: {
                color: "#d1d5db", // Gray-300
              },
              emphasis: {
                disabled: true, // Disable hover effects
              },
            });
          }
        } else {
          // If no total data, show 100% empty
          result.push({
            x: "", // Empty name to hide from legend
            y: 100,
            label: "", // Empty label to hide tooltips
            percentage: 100,
            isEmpty: true,
            itemStyle: {
              color: "#d1d5db", // Gray-300
            },
            emphasis: {
              disabled: true, // Disable hover effects
            },
          });
        }
        break;

      case "total":
      default:
        // For total API, show as 100% (no empty space needed since it represents complete data)
        const totalRow = data.find((item) => item.source_type === "total");

        if (totalRow && totalRow.url_count > 0) {
          result.push({
            x: "ทั้งหมด",
            y: totalRow.url_count, // Show as full circle
            label: "URL ทั้งหมด (100%)",
            percentage: 100,
          });
        }
        break;
    }

    return result;
  }, [data, countType]);
  // Chart container ref and instance (hooks must be declared before any early returns)
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    // If no data or no container, do nothing
    if (!chartContainerRef.current) return;

    if (!chartData || chartData.length === 0) return;

    const el = chartContainerRef.current;

    // ใช้ chart instance ที่มีอยู่หรือสร้างใหม่
    let chart = chartInstanceRef.current;
    if (!chart) {
      chart = echarts.init(el);
      chartInstanceRef.current = chart;
      isFirstRenderRef.current = true; // reset เมื่อสร้าง chart ใหม่
    }

    // Use percentage radii and center so the donut stays centered and responsive
    // Remove fixed pixel-based radius calculations and rely on echarts percentage sizes
    // Make the donut larger by increasing radii percentages
    const inner = "55%"; // inner radius as percentage (thicker donut)
    const outer = "65%"; // outer radius as percentage (bigger overall)

    const seriesData = chartData.map((d) => {
      const item: Record<string, unknown> = {
        name: d.x || "",
        value: typeof d.y === "number" ? d.y : 0,
      };
      if (d.itemStyle && d.itemStyle.color)
        item.itemStyle = { color: d.itemStyle.color };
      if (d.isEmpty) {
        item.itemStyle = { color: d.itemStyle?.color || "#d1d5db" };
        item.tooltip = { show: false };
        item.label = { show: false };
      }
      return item;
    });

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: "item",
        formatter: (params: unknown) => {
          const p = params as { name?: string; value?: number };
          if (!p || p.name === "") return "";
          const val =
            typeof p.value === "number" ? p.value : Number(p.value || 0);
          return `${p.name}: ${val.toLocaleString("th-TH")}`;
        },
      },
      legend:
        countType === "percentage"
          ? { orient: "vertical", left: "left", textStyle: { fontSize: 12 } }
          : { show: false },
      series: [
        {
          type: "pie",
          // percentage radii keep the donut proportional to container
          radius: [inner, outer],
          // center exactly in the middle of the container so overlay text is centered
          center: ["50%", "50%"],
          data: seriesData,
          itemStyle: { borderRadius: borderRadius },
          label: {
            show: countType === "percentage",
            formatter: (params: unknown) => {
              const p = params as { name?: string; value?: number };
              const val =
                typeof p.value === "number" ? p.value : Number(p.value || 0);
              return `${p.name}: ${val.toLocaleString("th-TH")}`;
            },
            fontSize: 12,
          },
          // เพิ่ม animation options สำหรับการ merge ที่นุ่มนวล
          animationType: "scale",
          animationEasing: "elasticOut",
          animationDelay: (idx: number) => idx * 100,
        },
      ],
      color: randomColors.length > 0 ? randomColors : getColorsWithGray(),
      // เพิ่ม global animation options
      animation: true,
      animationDuration: 1000,
      animationEasing: "cubicInOut",
    };

    // ใช้ updateChartWithMerge สำหรับการอัพเดทที่ smart
    updateChartWithMerge(chart, option);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      // ไม่ dispose chart ใน cleanup เพื่อให้ merge ทำงานได้
      // chart จะถูก dispose เมื่อ component unmount เท่านั้น
    };
  }, [
    chartData,
    randomColors,
    borderRadius,
    countType,
    getColorsWithGray,
    updateChartWithMerge,
  ]);

  // Cleanup effect สำหรับ component unmount
  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.dispose();
        } catch {
          // ignore
        }
        chartInstanceRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner color="light-gray" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        <p>เกิดข้อผิดพลาด: {error}</p>
      </div>
    );
  }

  // Get display value and label based on countType
  const getDisplayData = () => {
    const totalItem = data.find((item) => item.source_type === "total");
    const totalCount = totalItem?.url_count || 0;

    switch (countType) {
      case "percentage":
        // For percentage display, show total with breakdown
        return {
          value: totalCount,
          label: "URL ทั้งหมด (แยกตามประเภท)",
        };
      case "petition":
        // For petition display, show count and percentage
        const petitionData = data.find(
          (item) => item.source_type === "petition"
        );
        const petitionCount = petitionData?.url_count || 0;
        const petitionPercentage =
          totalCount > 0 ? (petitionCount / totalCount) * 100 : 0;
        return {
          value: petitionCount,
          percentage: petitionPercentage,
          label: `URL ที่ยื่นคำร้อง (${petitionPercentage.toFixed(2)}%)`,
        };
      case "court":
        // For court display, show count and percentage
        const courtData = data.find((item) => item.source_type === "court");
        const courtCount = courtData?.url_count || 0;
        const courtPercentage =
          totalCount > 0 ? (courtCount / totalCount) * 100 : 0;
        return {
          value: courtCount,
          percentage: courtPercentage,
          label: `URL ที่มีคำสั่งศาล (${courtPercentage.toFixed(2)}%)`,
        };
      case "ai":
        // For AI display, show count and percentage
        const aiData = data.find((item) => item.source_type === "ai");
        const totalData = data.find((item) => item.source_type === "total");
        const aiCount = aiData?.url_count || 0;
        const totalCountForAI = totalData?.url_count || 0;
        const aiPercentage =
          totalCountForAI > 0 ? (aiCount / totalCountForAI) * 100 : 0;

        return {
          value: aiCount,
          percentage: aiPercentage,
          label: `URL จาก AI (${aiPercentage.toFixed(2)}%)`,
        };
      case "total":
      default:
        // For total display, show total count
        return {
          value: totalCount,
          label: "URL ทั้งหมดที่นำเข้า",
        };
    }
  };

  const displayData = getDisplayData();

  return (
    <div ref={chartDivRef} className="w-full space-y-2 relative">
      {isRefreshing && (
        <div className="flex absolute top-0 left-0 m-1 p-1 text-[15px] text-gray-700">
          <LoadingSpinner color="red" size="sm" type="dots" />
        </div>
      )}
      {/* Donut Chart */}
      {chartData.length > 0 ? (
        <div className="p-0 relative">
          <div
            ref={chartContainerRef}
            // make container responsive: full width of parent and taller height to accommodate larger donut
            className="mx-auto w-full h-64"
          />

          {/* แสดงเปอร์เซ็นต์ตรงกลาง donut (centered) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              {(countType === "petition" ||
                countType === "court" ||
                countType === "ai") &&
              displayData.percentage !== undefined ? (
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {displayData.percentage.toFixed(2)}%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {displayData.value.toLocaleString("th-TH")}
                  </div>
                </div>
              ) : countType === "total" ? (
                <div className="text-3xl font-bold text-blue-600">
                  {displayData.value.toLocaleString("th-TH")}
                </div>
              ) : countType === "percentage" ? (
                <div>
                  <div className="text-xl font-bold text-blue-600">รวม</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {displayData.value.toLocaleString("th-TH")}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* แสดงรายละเอียดร้อยละสำหรับ percentage mode */}
          {countType === "percentage" && chartData.length > 0 && (
            <div className="mt-2 text-sm text-gray-600 space-y-1">
              {chartData
                .filter((item) => item.x !== "") // Filter out empty space items
                .map((item: ChartDataItem, index: number) => {
                  const colorArray =
                    randomColors.length > 0
                      ? randomColors
                      : getColorsWithGray();
                  return (
                    <div
                      key={index}
                      className="flex justify-between items-center"
                    >
                      <span className="flex items-center">
                        <div
                          className="w-3 h-3 rounded mr-2"
                          style={{
                            backgroundColor: colorArray[index],
                          }}
                        ></div>
                        {item.x}
                      </span>
                      <span className="font-medium">
                        {item.y.toLocaleString("th-TH")} (
                        {item.percentage?.toFixed(2)}%)
                      </span>
                    </div>
                  );
                })}
            </div>
          )}

          {/* แสดงข้อความที่มุมขวาล่าง */}
          {cornerLabel && (
            <div className="absolute bottom-2 right-2 pointer-events-none">
              <div className="bg-gray-200 px-2 py-1 rounded font-bold text-gray-700">
                {cornerLabel}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border p-1">
          <div className="flex items-center justify-center h-64 text-gray-500">
            <p>ไม่มีข้อมูล</p>
          </div>
        </div>
      )}
    </div>
  );
}
