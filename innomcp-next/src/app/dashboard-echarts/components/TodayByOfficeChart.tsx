"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import * as echarts from "echarts";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import { fetchWithApiProxy } from "@/app/lib/apiProxy";
import { getCSRFToken } from "@/utils/csrf";
import { useRealTime } from "@/app/dashboard-echarts/context/RealTimeContext";

export interface TodayByOfficeChartProps {
  cornerLabel?: string;
}

interface OfficeStat {
  department_id: number;
  department_name: string;
  // Some API responses may return aggregated `url_count`, others return an
  // individual row per URL with `creatdate` but no `url_count`. Make
  // `url_count` optional and default to 1 when missing.
  url_count?: number;
  creatdate?: string;
}

interface HeatSeriesData {
  series: echarts.SeriesOption[];
  maxCount: number;
  xBuckets: number[];
}

const TodayByOfficeChart: React.FC<TodayByOfficeChartProps> = ({
  cornerLabel = "TODAY OFFICE",
}) => {
  const [data, setData] = useState<OfficeStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // refs for current data for smart updates
  const currentDataRef = useRef<OfficeStat[]>([]);
  // flag for first render removed (not needed with current setOption strategy)

  const host = process.env.NEXT_PUBLIC_NODE_HOST || "";

  const { lastUpdateTime } = useRealTime();

  const hasDataChanged = useCallback(
    (newData: OfficeStat[], oldData: OfficeStat[]) => {
      if (newData.length !== oldData.length) return true;
      return newData.some((n, i) => {
        const o = oldData[i];
        if (!o) return true;
        return (
          n.department_id !== o.department_id ||
          n.url_count !== o.url_count ||
          n.department_name !== o.department_name
        );
      });
    },
    []
  );

  // compute start/end of today as plain values so other hooks can use them
  const startOfDay = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const endOfDay = (() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  })();

  // (chart update helper removed to avoid unused variable lint)

  // initial load
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const csrfToken = await getCSRFToken();
        const endpoint = `${host}/api/urlstats/today-by-office`;
        const result = await fetchWithApiProxy(endpoint, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken || "",
          },
        });

        const actual = result?.data?.data || result?.data || result;
        const arr = Array.isArray(actual) ? actual : [];

        // validate array items
        const isValid = arr.every((it: unknown) => {
          if (!it || typeof it !== "object") return false;
          const o = it as Record<string, unknown>;
          // valid if it has department id/name and either a numeric url_count
          // or a creatdate timestamp string (individual rows)
          const hasDept =
            typeof o.department_id === "number" &&
            typeof o.department_name === "string";
          const hasCount = typeof o.url_count === "number";
          const hasDate = typeof o.creatdate === "string";
          return hasDept && (hasCount || hasDate);
        });
        if (!isValid) {
          throw new Error("Invalid data structure received");
        }

        const typed = arr as OfficeStat[];
        setData(typed);
        currentDataRef.current = arr as OfficeStat[];
      } catch (err) {
        console.error("TodayByOfficeChart fetch error:", err);
        setData([]);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [host]);

  // realtime soft refresh
  useEffect(() => {
    if (!lastUpdateTime) return;
    const refresh = async () => {
      setIsRefreshing(true);
      try {
        const csrfToken = await getCSRFToken();
        const endpoint = `${host}/api/urlstats/today-by-office`;
        const result = await fetchWithApiProxy(endpoint, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken || "",
          },
        });
        const actual = result?.data?.data || result?.data || result;
        const arr = Array.isArray(actual) ? actual : [];
        if (arr.length) {
          const typed = arr as OfficeStat[];
          if (hasDataChanged(typed, currentDataRef.current)) {
            setData(typed);
            currentDataRef.current = typed;
          }
        }
      } catch (err: unknown) {
        // keep existing data on soft-refresh errors
        console.debug("[TodayByOfficeChart] soft refresh error", err);
      } finally {
        setIsRefreshing(false);
        // soft refresh complete
      }
    };

    refresh();
  }, [lastUpdateTime, host, hasDataChanged]);

  // Prepare categories (department names) for a time-vs-department plot.
  const categories = useMemo(() => {
    const names: string[] = [];
    data.forEach((d) => {
      if (!names.includes(d.department_name)) names.push(d.department_name);
    });
    return names;
  }, [data]);

  // Points: [time(ms), departmentName, count]

  // Build heatmap matrix bucketed into 10-minute intervals across the day.
  // We convert data into [timeIndex, deptIndex, count] triples used by ECharts
  // heatmap series. Also produce an array of bucket timestamps for x-axis labels.
  const intervalMs = 10 * 60 * 1000; // 10 minutes
  const seriesData = useMemo<HeatSeriesData>(() => {
    const bucketCount = Math.floor((endOfDay - startOfDay) / intervalMs) + 1;

    // map dept -> bucketIndex -> count
    const deptMap = new Map<string, number[]>();
    categories.forEach((c) => deptMap.set(c, new Array(bucketCount).fill(0)));

    data.forEach((d) => {
      const t = d.creatdate ? new Date(d.creatdate).getTime() : startOfDay;
      const idx = Math.floor((t - startOfDay) / intervalMs);
      const safeIdx = Math.max(0, Math.min(bucketCount - 1, idx));
      const dept = d.department_name;
      const add = typeof d.url_count === "number" ? d.url_count : 1;
      if (!deptMap.has(dept)) deptMap.set(dept, new Array(bucketCount).fill(0));
      const arr = deptMap.get(dept)!;
      arr[safeIdx] = (arr[safeIdx] || 0) + add;
    });

    // build heatmap data triples: [timeIndex, deptIndex, count]
    const heatData: [number, number, number][] = [];
    let max = 0;
    categories.forEach((dept, deptIdx) => {
      const arr = deptMap.get(dept) || new Array(bucketCount).fill(0);
      for (let tIdx = 0; tIdx < bucketCount; tIdx++) {
        const v = arr[tIdx] || 0;
        heatData.push([tIdx, deptIdx, v]);
        if (v > max) max = v;
      }
    });

    // x labels as timestamps for each bucket start
    const xBuckets: number[] = [];
    for (let b = 0; b < bucketCount; b++) {
      xBuckets.push(startOfDay + b * intervalMs);
    }

    const series: echarts.SeriesOption[] = [
      {
        name: "heat",
        type: "heatmap",
        data: heatData,
        // progressive rendering can help with many points
        progressive: 5000,
        emphasis: { itemStyle: { borderColor: "#333", borderWidth: 1 } },
      } as echarts.SeriesOption,
    ];

    return { series, maxCount: max, xBuckets };
  }, [data, categories, startOfDay, endOfDay, intervalMs]);

  // current time (ms) updated every 5 seconds so we can draw a live vertical line
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const clampedNow = useMemo(() => {
    if (now < startOfDay) return startOfDay;
    if (now > endOfDay) return endOfDay;
    return now;
  }, [now, startOfDay, endOfDay]);

  const option = useMemo(() => {
    const sd = seriesData as HeatSeriesData;
    const series = sd.series;
    const xBuckets = sd.xBuckets;
    // format time for labels
    const formatTime = (ts: number) => {
      const dt = new Date(ts);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    };

    // color ramp for heatmap: brighter but still light (low -> high)
    const heatColors = [
      "#e6f2ff", // light bright blue
      "#bfe6ff",
      "#80ccff",
      "#fff0b8", // light bright yellow
      "#ffd27a",
      "#ffb36b",
      "#ff9378",
      "#ff6b6b", // warm bright
    ];

    return {
      tooltip: {
        trigger: "item",
        formatter: (params: unknown) => {
          // params.value: [xIndex, yIndex, value]
          const p = params as Record<string, unknown>;
          const v = p?.value as unknown;
          if (!v || !Array.isArray(v)) return "-";
          const timeIdx = v[0] as number;
          const deptIdx = v[1] as number;
          const val = v[2] as number;
          const time =
            xBuckets && xBuckets[timeIdx] ? new Date(xBuckets[timeIdx]) : null;
          const timeStr = time
            ? `${String(time.getHours()).padStart(2, "0")}:${String(
                time.getMinutes()
              ).padStart(2, "0")}`
            : String(timeIdx);
          const deptName = categories[deptIdx] || String(deptIdx);
          return `เวลา: ${timeStr}<br/>หน่วยงาน: ${deptName}<br/>จำนวน: ${val}`;
        },
      },
      grid: { left: 120, right: 120, bottom: 40, top: 60 },
      xAxis: {
        type: "category",
        data: (xBuckets || []).map((ts: number) => formatTime(ts)),
        axisLabel: {
          interval: Math.max(0, Math.floor((xBuckets || []).length / 6)),
        },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      yAxis: {
        type: "category",
        data: categories,
        axisTick: { show: false },
        axisLine: { show: false },
      },
      visualMap: {
        min: 0,
        max: Math.max(1, sd.maxCount),
        calculable: true,
        orient: "vertical",
        right: 10,
        top: 60,
        inRange: {
          color: heatColors,
        },
      },
      series,
    } as echarts.EChartsOption;
  }, [seriesData, categories]);
  // Update only the current-time markLine when clampedNow changes so the

  // Track if we've rendered the main option for the first time so subsequent
  // updates can use echarts' merge behavior (replaceMerge) for better realtime
  // performance and to avoid re-creating components unnecessarily.
  const isFirstRenderRef = useRef<boolean>(true);

  const updateChartWithMerge = useCallback(
    (chart: echarts.ECharts, newOption: echarts.EChartsOption) => {
      if (isFirstRenderRef.current) {
        // First render: do a full replace to ensure axes/components created
        chart.setOption(newOption, { notMerge: true });
        isFirstRenderRef.current = false;
      } else {
        // Subsequent updates: merge series only (fast)
        chart.setOption(newOption, {
          notMerge: false,
          lazyUpdate: true,
          replaceMerge: ["series"],
        });
      }
    },
    []
  );

  // Update only the current-time markLine when clampedNow changes so the
  // whole chart option doesn't need to be replaced every second.
  useEffect(() => {
    if (!instanceRef.current) return;
    try {
      const dt = new Date(clampedNow);
      const pad = (n: number) => String(n).padStart(2, "0");
      const label = `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(
        dt.getSeconds()
      )}`;
      // map clampedNow to nearest x bucket index
      const sd = seriesData as HeatSeriesData;
      const xBuckets = sd.xBuckets || [];
      let nearestIdx = 0;
      if (xBuckets.length) {
        let bestDiff = Infinity;
        for (let i = 0; i < xBuckets.length; i++) {
          const diff = Math.abs(xBuckets[i] - clampedNow);
          if (diff < bestDiff) {
            bestDiff = diff;
            nearestIdx = i;
          }
        }
      }

      instanceRef.current.setOption({
        series: [
          {
            // target by index (first series)
            markLine: {
              symbol: ["", ""],
              silent: true,
              lineStyle: {
                type: "dashed",
                color: "blue",
                width: 3,
              },
              data: [
                {
                  xAxis: nearestIdx,
                  label: {
                    show: true,
                    formatter: () => label,
                    position: "end",
                  },
                },
              ],
            },
          },
        ],
      });
    } catch (e) {
      // ignore transient errors when chart not ready
      console.debug("TodayByOfficeChart: update markLine failed", e);
    }
  }, [clampedNow, seriesData]);

  const chartRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  // Use a callback ref so we can initialize the chart when the DOM node is
  // actually mounted. This avoids the bug where the component mounts showing
  // a loading spinner (no chart node) and the effect with `[]` never runs
  // when the node later appears.
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const setChartRef = useCallback(
    (el: HTMLDivElement | null) => {
      // assign to the ref so other effects can access it
      chartRef.current = el;

      // if an instance already exists, don't re-init
      if (!el) {
        // element removed -> cleanup
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
          resizeObserverRef.current = null;
        }
        if (instanceRef.current) {
          instanceRef.current.dispose();
          instanceRef.current = null;
        }
        return;
      }

      if (instanceRef.current) {
        // already initialized
        return;
      }

      const chart = echarts.init(el);
      instanceRef.current = chart;

      const ro = new ResizeObserver(() => chart.resize());
      ro.observe(el);
      resizeObserverRef.current = ro;

      // If data was already loaded before the node mounted, render the option
      try {
        // access latest option via the closure using our merge helper
        updateChartWithMerge(chart, option);
      } catch (e) {
        // ignore any errors during initial setOption
        console.debug("TodayByOfficeChart: setOption during init failed", e);
      }
    },
    [option, updateChartWithMerge]
  );

  useEffect(() => {
    if (!instanceRef.current) return;
    updateChartWithMerge(instanceRef.current, option);
  }, [option, updateChartWithMerge]);

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg relative">
      {cornerLabel && (
        <div className="absolute top-0 right-0 bg-purple-700 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
          {cornerLabel}
        </div>
      )}
      {isRefreshing && (
        <div className="flex absolute top-0 left-0 m-1 p-1 text-[15px] text-gray-700">
          <LoadingSpinner color="red" size="sm" type="dots" />
        </div>
      )}

      {/* Content area: loading / error / empty / chart */}
      <div className="min-h-[200px] flex items-center justify-center">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner color="light-gray" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">
            เกิดข้อผิดพลาด: {error}
          </div>
        ) : !data.length ? (
          // Render a small placeholder chart so the card layout and axes remain visible
          <div className="w-full h-[320px]">
            <div className="p-6 text-center text-gray-400">ยังไม่มีข้อมูลของวันนี้</div>
            <div ref={setChartRef} className="w-full h-[200px] opacity-60" />
          </div>
        ) : (
          <div ref={setChartRef} className="w-full h-[320px]" />
        )}
      </div>
    </div>
  );
};

export default TodayByOfficeChart;
