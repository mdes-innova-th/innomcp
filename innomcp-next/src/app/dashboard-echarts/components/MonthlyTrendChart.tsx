"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRealTime } from "@/app/dashboard-echarts/context/RealTimeContext";
import * as echarts from "echarts";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import { fetchWithApiProxy } from "@/app/lib/apiProxy";

type MonthlyTrendChartProps = {
  cornerLabel?: string;
  toprank?: number; // Number of top categories to display (default 2)
  monthsBack?: number; // Number of months to look back (default 5)
};

type CategoryData = {
  name: string;
  count: number;
  percentage: number;
};

type MonthlyTrendData = {
  month: string;
  categories: CategoryData[];
};

const MonthlyTrendChart = ({
  cornerLabel,
  toprank = 2,
  monthsBack = 5,
}: MonthlyTrendChartProps) => {
  const [data, setData] = useState<MonthlyTrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ใช้ useRef เพื่อเก็บ current data และ chart instances
  const currentDataRef = useRef<MonthlyTrendData[]>([]);
  const chartInstancesRef = useRef<Map<string, echarts.ECharts>>(new Map());
  const firstRenderMapRef = useRef<Map<string, boolean>>(new Map());

  const host = process.env.NEXT_PUBLIC_NODE_HOST || "";

  // ฟังก์ชันตรวจสอบการเปลี่ยนแปลงข้อมูล
  const hasDataChanged = useCallback(
    (newData: MonthlyTrendData[], oldData: MonthlyTrendData[]): boolean => {
      if (newData.length !== oldData.length) return true;

      return newData.some((newItem, index) => {
        const oldItem = oldData[index];
        if (!oldItem || newItem.month !== oldItem.month) return true;

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

        const endpoint = `${host}/api/urlstats/monthly-trends?monthsBack=${monthsBack}&toprank=${toprank}`;
        const result = await fetchWithApiProxy(endpoint, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const responseData = result?.data || result;

        if (
          responseData &&
          Array.isArray(responseData) &&
          responseData.length > 0
        ) {
          // Accept items that either include a `month` string (preferred) or a `year` number
          const isValidData = responseData.every(
            (item: { month?: unknown; year?: unknown; categories?: unknown }) =>
              item &&
              (typeof item.month === "string" ||
                typeof item.year === "number") &&
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
            // Normalize data to ensure `month` is always a string (frontend depends on month)
            const normalized: MonthlyTrendData[] = responseData.map(
              (item: {
                month?: string;
                year?: number;
                categories: CategoryData[];
              }) => ({
                month:
                  typeof item.month === "string"
                    ? item.month
                    : // fallback to year or empty string
                    item.year !== undefined
                    ? String(item.year)
                    : "",
                categories: item.categories,
              })
            );

            // Sort data by month in descending order
            const sortedData = normalized.sort(
              (a, b) =>
                new Date(b.month).getTime() - new Date(a.month).getTime()
            );

            // สำหรับการโหลดครั้งแรก ให้อัพเดทข้อมูลเสมอ
            setData(sortedData);
            currentDataRef.current = sortedData;
            setError(null);
          } else {
            console.error("Invalid monthly trends payload:", responseData);
            setError("Invalid data structure received");
          }
        } else {
          setError("No data available for the selected period.");
        }
      } catch {
        setError("Failed to load data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [host, monthsBack, toprank]);

  // Realtime refresh (no spinner)
  useEffect(() => {
    if (!lastUpdateTime) return;
    const refresh = async () => {
      try {
        setIsRefreshing(true);
        const endpoint = `${host}/api/urlstats/monthly-trends?monthsBack=${monthsBack}&toprank=${toprank}`;
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
          const normalized: MonthlyTrendData[] = responseData.map(
            (item: {
              month?: string;
              year?: number;
              categories: CategoryData[];
            }) => ({
              month:
                typeof item.month === "string"
                  ? item.month
                  : item.year !== undefined
                  ? String(item.year)
                  : "",
              categories: item.categories,
            })
          );
          const sortedData = normalized.sort(
            (a, b) => new Date(b.month).getTime() - new Date(a.month).getTime()
          );

          // ใช้ hasDataChanged เพื่อตรวจสอบว่าข้อมูลเปลี่ยนแปลงจริงหรือไม่
          if (hasDataChanged(sortedData, currentDataRef.current)) {
            setData(sortedData);
            currentDataRef.current = sortedData;
            console.log(
              "[MonthlyTrendChart] Data changed, updating with merge..."
            );
          } else {
            console.log(
              "[MonthlyTrendChart] No data changes detected, skipping update"
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
  }, [lastUpdateTime, host, monthsBack, toprank, hasDataChanged]);

  useEffect(() => {
    if (realtimeData) {
      console.log("[MonthlyTrendChart] Realtime update received");
    }
  }, [realtimeData]);

  useEffect(() => {
    if (!data.length || loading) {
      console.log(
        `[MonthlyTrendChart] Skipping render - data length: ${data.length}, loading: ${loading}`
      );
      return;
    }

    console.log(`[MonthlyTrendChart] Starting to render ${data.length} charts`);
    data.forEach((monthData) => {
      const chartDom = document.getElementById(
        `monthlyTrendChart-${monthData.month}`
      );
      if (!chartDom) {
        console.warn(
          `[MonthlyTrendChart] DOM element not found for month ${monthData.month}`
        );
        return;
      }

      const validCategories = monthData.categories
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
          `[MonthlyTrendChart] No valid categories for month ${monthData.month}`
        );
        return;
      }

      console.log(
        `[MonthlyTrendChart] Found ${validCategories.length} valid categories for month ${monthData.month}`
      );

      // ใช้ chart instance ที่มีอยู่หรือสร้างใหม่
      const chartKey = `monthlyTrendChart-${monthData.month}`;
      let myChart = chartInstancesRef.current.get(chartKey);

      if (!myChart) {
        console.log(
          `[MonthlyTrendChart] Creating new chart for month ${monthData.month}`
        );
        myChart = echarts.init(chartDom);
        chartInstancesRef.current.set(chartKey, myChart);
      } else {
        console.log(
          `[MonthlyTrendChart] Reusing existing chart for month ${monthData.month}`
        );
      }

      // ตรวจสอบว่า chart ถูกสร้างสำเร็จหรือไม่
      if (!myChart) {
        console.error(
          `[MonthlyTrendChart] Failed to create chart for month ${monthData.month}`
        );
        return;
      }
      const randomColors = generateRandomColors(validCategories.length);

      const seriesData = [
        {
          name: `${monthData.month} Categories`,
          type: "bar" as const,
          data: validCategories.map((category, categoryIndex) => {
            const firstCategoryPercentage = validCategories[0].percentage;
            let scaledValue = 200;

            if (categoryIndex !== 0) {
              scaledValue =
                (category.percentage / firstCategoryPercentage) * scaledValue;
            }

            return {
              value: scaledValue,
              originalValue: category.percentage,
              count: category.count,
              name: category.name,
              itemStyle: {
                color: randomColors[categoryIndex],
                borderRadius: [8, 8, 8, 8],
              },
            };
          }),
          barWidth: 40,
          label: {
            show: true,
            position: "top" as const,
            formatter: labelFormatter,
            fontSize: 9,
            fontWeight: "bold" as const,
            color: "#374151",
          },
        },
      ];

      const option: echarts.EChartsOption = {
        tooltip: {
          trigger: "axis",
          axisPointer: {
            type: "shadow",
          },
          formatter: tooltipFormatter,
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
          top: 40,
          bottom: 5,
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
        `[MonthlyTrendChart] Chart rendered successfully for month ${monthData.month}`
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

  // Use `unknown` and type guards for formatter parameters
  const labelFormatter = (params: unknown): string => {
    if (typeof params === "object" && params !== null && "data" in params) {
      const data = (
        params as { data: { originalValue: number; count: number } }
      ).data;
      return `${data.originalValue.toFixed(
        2
      )}%\n${data.count.toLocaleString()}`;
    }
    return "";
  };

  const tooltipFormatter = (params: unknown): string => {
    if (Array.isArray(params)) {
      let tooltip = `<div style="font-weight: bold; margin-bottom: 8px;">${
        params[0]?.data?.month || ""
      }</div>`;

      params.forEach((param) => {
        if (typeof param === "object" && param !== null && "data" in param) {
          const data = (
            param as {
              data: { name: string; originalValue: number; count: number };
            }
          ).data;
          tooltip += `
            <div style="margin-bottom: 4px;">
              <span style="display: inline-block; width: 10px; height: 10px; background-color: ${
                param.color
              }; border-radius: 50%; margin-right: 8px;"></span>
              ${data.name}: ${data.originalValue.toFixed(
            2
          )}% (${data.count.toLocaleString()} URLs)
            </div>
          `;
        }
      });

      return tooltip;
    }
    return "";
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-lg relative">
        {cornerLabel && (
          <div className="absolute top-0 right-0 bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
            {cornerLabel}
          </div>
        )}
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-lg relative">
        {cornerLabel && (
          <div className="absolute top-0 right-0 bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
            {cornerLabel}
          </div>
        )}
        <p className="text-red-500 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg relative">
      {cornerLabel && (
        <div className="absolute top-0 right-0 bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
          {cornerLabel}
        </div>
      )}
      {isRefreshing && (
        <div className="flex absolute top-0 left-0 m-1 p-1 text-[15px] text-gray-700">
          <LoadingSpinner color="red" size="sm" type="dots" />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((monthData) => {
          const validCategories = monthData.categories
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

          // Calculate height dynamically based on the number of categories
          const baseHeight = 80; // Base height for the card
          const heightPerCategory = 30; // Additional height per category
          const calculatedHeight =
            baseHeight + validCategories.length * heightPerCategory;

          return (
            <div
              key={monthData.month}
              className="bg-gray-100 rounded-lg p-2 shadow-md flex flex-col"
              style={{ height: `${calculatedHeight}px` }}
            >
              {/* Month header */}
              <div className="text-center font-bold text-sm text-gray-700 mb-1">
                {monthData.month}
              </div>

              {/* Split into two sides */}
              <div className="flex flex-1 gap-1">
                {/* Left side - Chart */}
                <div className="flex-1">
                  <div
                    id={`monthlyTrendChart-${monthData.month}`}
                    style={{ width: "100%", height: "100%" }}
                  ></div>
                </div>

                {/* Right side - Categories */}
                <div className="w-20 flex flex-col justify-center">
                  <div className="space-y-1">
                    {validCategories.map((category, catIndex) => (
                      <div
                        key={`${monthData.month}-${catIndex}`}
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
        })}
      </div>
    </div>
  );
};

export default MonthlyTrendChart;
