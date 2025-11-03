"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRealTime } from "@/app/dashboard-echarts/context/RealTimeContext";
import * as echarts from "echarts";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import { fetchWithApiProxy } from "@/app/lib/apiProxy";

interface CategoryData {
  name: string;
  count: number;
  percentage: number;
}

interface YearTrendData {
  year: number;
  categories: CategoryData[];
  order_id?: string;
}

interface YearsTrendProps {
  cornerLabel?: string;
  toprank?: number; // Number of top categories to display (default 2)
  yearsBack?: number; // Number of years to look back (default 5)
}

const YearsTrendChart = ({
  cornerLabel,
  toprank = 2,
  yearsBack = 5,
}: YearsTrendProps) => {
  const [data, setData] = useState<YearTrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ใช้ useRef เพื่อเก็บ current data และ chart instances
  const currentDataRef = useRef<YearTrendData[]>([]);
  const chartInstancesRef = useRef<Map<string, echarts.ECharts>>(new Map());
  const firstRenderMapRef = useRef<Map<string, boolean>>(new Map());

  const host = process.env.NEXT_PUBLIC_NODE_HOST || "";

  // ฟังก์ชันตรวจสอบการเปลี่ยนแปลงข้อมูล
  const hasDataChanged = useCallback(
    (newData: YearTrendData[], oldData: YearTrendData[]): boolean => {
      if (newData.length !== oldData.length) return true;

      return newData.some((newItem, index) => {
        const oldItem = oldData[index];
        if (!oldItem || newItem.year !== oldItem.year) return true;

        // ตรวจสอบ categories
        if (newItem.categories.length !== oldItem.categories.length)
          return true;

        return newItem.categories.some((newCat, catIndex) => {
          const oldCat = oldItem.categories[catIndex];
          return (
            !oldCat ||
            newCat.name !== oldCat.name ||
            newCat.count !== oldCat.count ||
            newCat.percentage !== oldCat.percentage
          );
        });
      });
    },
    []
  );

  // ฟังก์ชันสำหรับ smart chart update
  const updateChartWithMerge = useCallback(
    (
      chart: echarts.ECharts,
      newOption: echarts.EChartsOption,
      chartKey: string
    ) => {
      const isFirstRender = !firstRenderMapRef.current.get(chartKey);

      if (isFirstRender) {
        chart.setOption(newOption, { notMerge: true });
        firstRenderMapRef.current.set(chartKey, true);
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

  // Generate random colors
  const generateRandomColors = (count: number): string[] => {
    const colors = [];
    for (let i = 0; i < count; i++) {
      const hue = Math.floor(Math.random() * 360);
      const saturation = Math.floor(Math.random() * 30) + 70; // 70-100%
      const lightness = Math.floor(Math.random() * 20) + 50; // 50-70%
      colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    return colors;
  };

  const { data: realtimeData, lastUpdateTime } = useRealTime();

  // Initial load
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Call real API endpoint for yearly trends
        const endpoint = `${host}/api/urlstats/yearly-trends?yearsBack=${yearsBack}&toprank=${toprank}`;
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
            (item: { year?: unknown; categories?: unknown }) =>
              item &&
              typeof item.year === "number" &&
              Array.isArray(item.categories) &&
              item.categories.every(
                (cat: {
                  name?: unknown;
                  count?: unknown;
                  percentage?: unknown;
                }) =>
                  typeof cat.name === "string" &&
                  typeof cat.count === "number" &&
                  typeof cat.percentage === "number"
              )
          );

          if (isValidData) {
            // Sort data by year in descending order
            const sortedData = responseData.sort((a, b) => b.year - a.year);

            // สำหรับการโหลดครั้งแรก ให้อัพเดทข้อมูลเสมอ
            setData(sortedData);
            currentDataRef.current = sortedData;
            setError(null);
          } else {
            setError("Invalid data structure received");
          }
        } else if (
          responseData &&
          Array.isArray(responseData) &&
          responseData.length === 0
        ) {
          setError("ไม่พบข้อมูลในช่วงเวลาที่เลือก");
        } else {
          setError("Invalid data format received");
        }
      } catch {
        setError("ไม่สามารถโหลดข้อมูลได้");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [host, yearsBack, toprank]);

  // Realtime refresh (no spinner)
  useEffect(() => {
    if (!lastUpdateTime) return;
    const refresh = async () => {
      try {
        setIsRefreshing(true);
        const endpoint = `${host}/api/urlstats/yearly-trends?yearsBack=${yearsBack}&toprank=${toprank}`;
        const result = await fetchWithApiProxy(endpoint, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        const responseData = result?.data || result;
        if (responseData && Array.isArray(responseData)) {
          const sortedData = responseData.sort((a, b) => b.year - a.year);

          // ใช้ hasDataChanged เพื่อตรวจสอบว่าข้อมูลเปลี่ยนแปลงจริงหรือไม่
          if (hasDataChanged(sortedData, currentDataRef.current)) {
            setData(sortedData);
            currentDataRef.current = sortedData;
            console.log(
              "[YearsTrendChart] Data changed, updating with merge..."
            );
          } else {
            console.log(
              "[YearsTrendChart] No data changes detected, skipping update"
            );
          }
        }
      } catch {
        // ignore soft refresh errors
      } finally {
        setIsRefreshing(false);
      }
    };
    refresh();
  }, [lastUpdateTime, host, yearsBack, toprank, hasDataChanged]);

  useEffect(() => {
    if (realtimeData) {
      console.log("[YearsTrendChart] Realtime update received");
    }
  }, [realtimeData]);

  useEffect(() => {
    if (!data.length || loading) {
      console.log(
        `[YearsTrendChart] Skipping render - data length: ${data.length}, loading: ${loading}`
      );
      return;
    }

    console.log(`[YearsTrendChart] Starting to render ${data.length} charts`);
    data.forEach((yearData) => {
      const chartDom = document.getElementById(
        `yearsTrendChart-${yearData.year}`
      );
      if (!chartDom) {
        console.warn(
          `[YearsTrendChart] DOM element not found for year ${yearData.year}`
        );
        return;
      }

      // Check if there are any valid categories to display for this year
      const validCategories = yearData.categories
        .slice(0, toprank)
        .filter(
          (category) =>
            category &&
            category.name &&
            category.name.trim() !== "" &&
            category.name.toLowerCase() !== "nodata" &&
            category.count > 0
        );

      if (validCategories.length === 0) {
        console.warn(
          `[YearsTrendChart] No valid categories for year ${yearData.year}`
        );
        return;
      }

      console.log(
        `[YearsTrendChart] Found ${validCategories.length} valid categories for year ${yearData.year}`
      );

      // ใช้ chart instance ที่มีอยู่หรือสร้างใหม่
      const chartKey = `yearsTrendChart-${yearData.year}`;
      let myChart = chartInstancesRef.current.get(chartKey);

      if (!myChart) {
        console.log(
          `[YearsTrendChart] Creating new chart for year ${yearData.year}`
        );
        myChart = echarts.init(chartDom);
        chartInstancesRef.current.set(chartKey, myChart);
      } else {
        console.log(
          `[YearsTrendChart] Reusing existing chart for year ${yearData.year}`
        );
      }

      // ตรวจสอบว่า chart ถูกสร้างสำเร็จหรือไม่
      if (!myChart) {
        console.error(
          `[YearsTrendChart] Failed to create chart for year ${yearData.year}`
        );
        return;
      }
      const randomColors = generateRandomColors(validCategories.length);

      // Create a single series with all categories as data points
      const seriesData = [
        {
          name: `${yearData.year} Categories`,
          type: "bar" as const,
          data: validCategories.map((category, categoryIndex) => {
            // Scale values: first category uses full height, others scaled proportionally
            const firstCategoryPercentage = validCategories[0].percentage;
            let scaledValue = 200; // Increased for fuller height utilization

            if (categoryIndex !== 0) {
              // Other categories scaled proportionally to the first
              scaledValue =
                (category.percentage / firstCategoryPercentage) * scaledValue;
            }

            return {
              value: scaledValue,
              originalValue: category.percentage, // Keep original for tooltip
              count: category.count,
              name: category.name,
              order_id: yearData.order_id,
              year: yearData.year,
              itemStyle: {
                color: randomColors[categoryIndex],
                borderRadius: [8, 8, 8, 8], // Rounded all corners
              },
            };
          }),
          barWidth: 40, // Fixed pixel width instead of percentage
          label: {
            show: true,
            position: "top" as const, // Back to top position
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter: function (params: any) {
              const data = params.data;
              return `${data.originalValue.toFixed(
                2
              )}%\n${data.count.toLocaleString()}`;
            },
            fontSize: 9, // Keep smaller font
            fontWeight: "bold" as const,
            color: "#374151", // Dark gray for better visibility on top
          },
        },
      ];

      const option: echarts.EChartsOption = {
        tooltip: {
          trigger: "axis",
          axisPointer: {
            type: "shadow",
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter: function (params: any) {
            if (!Array.isArray(params) || params.length === 0) return "";

            let tooltip = `<div style="font-weight: bold; margin-bottom: 8px;">${params[0].data.year}</div>`;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            params.forEach((param: any) => {
              const data = param.data;
              tooltip += `
                <div style="margin-bottom: 4px;">
                  <span style="display: inline-block; width: 10px; height: 10px; background-color: ${
                    param.color
                  }; border-radius: 50%; margin-right: 8px;"></span>
                  ${data.name}: ${data.originalValue.toFixed(
                2
              )}% (${data.count.toLocaleString()} URLs)
                  ${
                    data.order_id
                      ? `<br/><span style="color: #666; font-size: 12px; margin-left: 18px;">Order ID: ${data.order_id}</span>`
                      : ""
                  }
                </div>
              `;
            });

            return tooltip;
          },
        },
        xAxis: {
          show: false,
          type: "category",
          data: validCategories.map((cat) => cat.name),
        },
        yAxis: {
          show: false,
          type: "value",
        },
        series: seriesData,
        grid: {
          left: 2,
          right: 2,
          top: 40, // Further reduced top margin
          bottom: 5, // Minimal bottom margin
          containLabel: true,
        },
      };

      // เพิ่ม animation options
      const optionWithAnimation = {
        ...option,
        animation: true,
        animationDuration: 1000,
        animationEasing: "cubicInOut" as const,
      };

      // ใช้ updateChartWithMerge สำหรับการอัพเดทที่ smart
      updateChartWithMerge(myChart, optionWithAnimation, chartKey);

      console.log(
        `[YearsTrendChart] Chart rendered successfully for year ${yearData.year}`
      );
    });
  }, [data, loading, toprank, updateChartWithMerge]);

  // Handle window resize for all charts
  useEffect(() => {
    const handleResize = () => {
      chartInstancesRef.current.forEach((chart) => {
        try {
          chart.resize();
        } catch {
          // ignore if chart is disposed
        }
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Cleanup effect สำหรับ component unmount
  useEffect(() => {
    const chartInstances = chartInstancesRef.current;
    const firstRenderMap = firstRenderMapRef.current;

    return () => {
      // Dispose all chart instances
      chartInstances.forEach((chart) => {
        try {
          chart.dispose();
        } catch {
          // ignore
        }
      });
      chartInstances.clear();
      firstRenderMap.clear();
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-lg relative">
        {cornerLabel && (
          <div className="absolute top-0 right-0 bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
            {yearsBack} {cornerLabel}
          </div>
        )}
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-lg relative">
        {cornerLabel && (
          <div className="absolute top-0 right-0 bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
            {yearsBack} {cornerLabel}
          </div>
        )}
        <div className="text-center text-red-500 py-8">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg relative">
      {cornerLabel && (
        <div className="absolute top-0 right-0 bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
          {yearsBack} {cornerLabel}
        </div>
      )}
      {isRefreshing && (
        <div className="flex absolute top-0 left-0 m-1 p-1 text-[15px] text-gray-700">
          <LoadingSpinner color="red" size="sm" type="dots" />
        </div>
      )}

      {/* Each year in its own frame with chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data
          .map((yearData) => {
            const validCategories = yearData.categories
              .slice(0, toprank)
              .filter(
                (category) =>
                  category &&
                  category.name &&
                  category.name.trim() !== "" &&
                  category.name.toLowerCase() !== "nodata" &&
                  category.count > 0
              );

            if (validCategories.length === 0) return null;

            // Calculate height based on toprank: increased for better chart visibility
            const baseHeight = 80; // Increased base height for better chart space
            const heightPerCategory = 30; // Increased height per category
            const calculatedHeight = baseHeight + toprank * heightPerCategory;

            return (
              <div
                key={yearData.year}
                className="bg-gray-100 rounded-lg p-2 shadow-md flex flex-col"
                style={{ height: `${calculatedHeight}px` }}
              >
                {/* Year header - smaller margin */}
                <div className="text-center font-bold text-sm text-gray-700 mb-1">
                  {yearData.year}
                </div>

                {/* Split into two sides - more space for chart */}
                <div className="flex flex-1 gap-1">
                  {/* Left side - Chart takes more space */}
                  <div className="flex-1">
                    <div
                      id={`yearsTrendChart-${yearData.year}`}
                      style={{ width: "100%", height: "100%" }}
                    ></div>
                  </div>

                  {/* Right side - Categories (smaller width) */}
                  <div className="w-20 flex flex-col justify-center">
                    <div className="space-y-1">
                      {validCategories.map((category, catIndex) => (
                        <div
                          key={`${yearData.year}-${catIndex}`}
                          className="text-xs text-gray-600 text-center break-words"
                        >
                          {category.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
          .filter(Boolean)}
      </div>
    </div>
  );
};

export default YearsTrendChart;
