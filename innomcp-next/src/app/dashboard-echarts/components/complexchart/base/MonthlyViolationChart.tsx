"use client";

import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import DashboardChartRender from "@/app/dashboard-echarts/components/complexchart/base/lib/DashboardChartRender";
import MonthlyViolationChartFilter from "@/app/dashboard-echarts/components/complexchart/base/filter/MonthlyViolationChartFilter";
import { useViolationGroups } from "@/app/dashboard-echarts/components/complexchart/base/filter/ViolationGroupContext";
import {
  toDisplayMonth as sharedToDisplayMonth,
  toIsoMonth as sharedToIsoMonth,
  validateMonthRange as sharedValidateMonthRange,
  getDefaultMonths,
  mapChartType,
} from "@/app/dashboard-echarts/components/complexchart/base/sharedChartUtils";

import { fetchWithApiProxy } from "@/app/lib/apiProxy";
import { getCSRFToken } from "@/utils/csrf";

type MonthlyViolationData = {
  month: string;
  group_name: string;
  url_count: number;
};

type MonthlyViolationChartProps = {
  onDataLabelClick?: (date: string, groupName: string) => void;
  chartType?: "bar" | "bubble" | "line" | "area" | "pie" | "donut" | "radar";
  onError?: () => void;
  onLoad?: () => void;
  legendClassName?: string;
  colors?: string[];
  stacked?: boolean;
  stackedAxis?: "x" | "y";
};

// Define a type for the imperative handle
export type MonthlyViolationChartHandle = {
  getChartData: () => string[][];
  getTitle: () => string;
  refreshData: () => void;
};

// Custom hook: useMonthlyViolationData
function useMonthlyViolationData({
  onError,
  onLoad,
}: {
  onError?: () => void;
  onLoad?: () => void;
}) {
  // Default months come from shared helper
  const { startMonth: defaultStartDate, endMonth: defaultEndDate } =
    getDefaultMonths();
  const [data, setData] = useState<MonthlyViolationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startMonth, setStartDate] = useState<string>(defaultStartDate);
  const [endMonth, setEndDate] = useState<string>(defaultEndDate);
  const [sourceType, setSourceType] = useState<string>("");

  // On mount, load from localStorage if exists
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("MonthlyViolationSourceType")
        : null;
    if (saved) setSourceType(saved);
  }, []);

  const validateDateRange = sharedValidateMonthRange;

  const host = process.env.NEXT_PUBLIC_NODE_HOST || "";
  const { selectedGroups } = useViolationGroups();

  // Extract fetchData function to be reusable
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    if (!sourceType) {
      setLoading(false);
      setData([]);
      return;
    }
    if (startMonth && endMonth && !validateDateRange(startMonth, endMonth)) {
      // show icon in UI instead of embedding emoji in the string
      setError("เดือนที่เริ่มต้นต้องไม่เกินเดือนสิ้นสุด");
      onError?.();
      setLoading(false);
      return;
    }

    const body = {
      startMonth,
      endMonth,
      sourceType,
      selectedGroups: selectedGroups || [],
    };

    const endpoint = `${host}/api/urlstats/by-month-count`;

    const csrfToken = await getCSRFToken();
    if (!csrfToken) {
      setError("ไม่สามารถรับ CSRF token ได้");
      onError?.();
      setLoading(false);
      return;
    }

    while (true) {
      try {
        const result = await fetchWithApiProxy(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify(body),
        });
        setData(result.data || []);
        onLoad?.();
        break;
      } catch {
        setError("ไม่สามารถโหลดข้อมูลได้ กรุณาลองอีกครั้ง");
        onError?.();
        break;
      }
    }
    setLoading(false);
  };

  // Fetch data
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMonth, endMonth, sourceType, selectedGroups]);

  // month helpers from sharedChartUtils
  const toDisplayMonth = sharedToDisplayMonth;
  const toIsoMonth = sharedToIsoMonth;

  // Reset/this month helpers
  const reset = () => {
    const { startMonth, endMonth } = getDefaultMonths();
    setStartDate(startMonth);
    setEndDate(endMonth);
    setSourceType("");
    if (typeof window !== "undefined") {
      localStorage.removeItem("MonthlyViolationSourceType");
    }
  };
  const setThisMonth = () => {
    // ใช้เวลาตามโซน Asia/Bangkok (UTC+7)
    const now = new Date();
    const bangkokOffset = 7 * 60; // นาที
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const bangkokDate = new Date(utc + bangkokOffset * 60000);
    const month = `${bangkokDate.getFullYear()}-${(bangkokDate.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;
    setStartDate(month);
    setEndDate(month);
  };

  return {
    data,
    loading,
    error,
    startMonth,
    endMonth,
    sourceType,
    setStartDate,
    setEndDate,
    setSourceType,
    toDisplayMonth,
    toIsoMonth,
    fetchData,
    reset,
    setThisMonth,
    validateDateRange,
  };
}

// View component: MonthlyViolationChartView
type MonthlyViolationChartViewProps = {
  data: MonthlyViolationData[];
  error: string | null;
  startMonth: string;
  endMonth: string;
  sourceType: string;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  setSourceType: (v: string) => void;
  toDisplayMonth: (iso: string) => string;
  toIsoMonth: (display: string) => string;
  reset: () => void;
  setThisMonth: () => void;
  onDataLabelClick?: (date: string, groupName: string) => void;
  legendClassName?: string;
  colors?: string[];
  chartType?: "bar" | "bubble" | "line" | "area" | "pie" | "donut" | "radar";
};
const MonthlyViolationChartView = ({
  data,
  error,
  startMonth,
  endMonth,
  sourceType,
  setStartDate,
  setEndDate,
  setSourceType,
  toDisplayMonth,
  toIsoMonth,
  reset,
  setThisMonth,
  onDataLabelClick,
  legendClassName,
  colors,
  chartType = "bar",
}: MonthlyViolationChartViewProps) => {
  const startMonthInputRef = useRef<HTMLInputElement>(
    null
  ) as React.RefObject<HTMLInputElement>;
  const endMonthInputRef = useRef<HTMLInputElement>(
    null
  ) as React.RefObject<HTMLInputElement>;
  const chartRef = useRef<HTMLDivElement>(null);
  const chartData = {
    dataPoints: data.map((item) => ({
      x: item.month
        ? new Date(item.month + "-01").toLocaleDateString("en-US", {
            year: "numeric",
            month: "numeric",
          })
        : "",
      y: item.url_count,
      category: item.group_name,
    })),
  };
  return (
    <div className="w-full h-full flex flex-col overflow-visible">
      <MonthlyViolationChartFilter
        sourceType={sourceType}
        setSourceType={setSourceType}
        startMonth={startMonth}
        setStartMonth={setStartDate}
        endMonth={endMonth}
        setEndMonth={setEndDate}
        toDisplayMonth={toDisplayMonth}
        toIsoMonth={toIsoMonth}
        startMonthInputRef={startMonthInputRef}
        endMonthInputRef={endMonthInputRef}
        onThisMonth={setThisMonth}
        onReset={reset}
        chartRef={chartRef}
      />
      {/* Chart content */}
      <div className="flex-grow overflow-visible">
        {error ? (
          <div className="text-red-600 bg-red-100 border border-red-300 rounded px-4 py-2 text-center my-4">
            <div className="flex items-center justify-center">
              <i className="fa fa-exclamation-circle mr-2" aria-hidden="true" />
              <span>{error}</span>
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="text-gray-600 bg-gray-100 border border-gray-300 rounded px-4 py-2 text-center my-4">
            ไม่พบข้อมูล
          </div>
        ) : (
          <div data-chart-type={chartType} className="w-full overflow-x-auto">
            {(() => {
              const { mappedType, isArea } = mapChartType(chartType);
              return (
                <DashboardChartRender
                  data={chartData.dataPoints}
                  stacked={true}
                  title={`เว็บไซต์ผิดกฎหมาย แยกตามเดือน (${
                    sourceType === "import"
                      ? "การนำเข้า"
                      : sourceType === "petition"
                      ? "มีคำร้อง"
                      : "มีคำสั่งศาล"
                  })`}
                  showTitle={true}
                  showDataLabels={true}
                  showXAxis={true}
                  showYAxis={true}
                  onLineLabelClick={
                    onDataLabelClick
                      ? (x, group) =>
                          typeof x === "string"
                            ? onDataLabelClick(x, group ?? "")
                            : undefined
                      : undefined
                  }
                  legendClassName={legendClassName}
                  colors={colors}
                  type={mappedType}
                  area={isArea}
                  isDonut={chartType === "donut"}
                />
              );
            })()}
            <div className="text-2xl font-semibold text-blue-700 text-center mt-2">
              รวมทั้งหมด{" "}
              {data
                .reduce((sum, item) => sum + item.url_count, 0)
                .toLocaleString()}{" "}
              URL
            </div>
            <div className="text-lg text-gray-800 text-center mt-1 mb-2">
              {startMonth &&
                endMonth &&
                (startMonth === endMonth
                  ? `เดือน ${new Date(startMonth + "-01").toLocaleDateString(
                      "th-TH",
                      {
                        year: "numeric",
                        month: "long",
                      }
                    )}`
                  : `ช่วงเดือน ${new Date(
                      startMonth + "-01"
                    ).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "long",
                    })} - ${new Date(endMonth + "-01").toLocaleDateString(
                      "th-TH",
                      {
                        year: "numeric",
                        month: "long",
                      }
                    )}`)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main component: MonthlyViolationChart
const MonthlyViolationChart = forwardRef<
  MonthlyViolationChartHandle,
  MonthlyViolationChartProps
>((props, ref) => {
  const {
    onDataLabelClick,
    onError,
    onLoad,
    legendClassName,
    colors,
    chartType = "bar",
  } = props;
  const {
    data,
    error,
    startMonth,
    endMonth,
    sourceType,
    setStartDate,
    setEndDate,
    setSourceType,
    toDisplayMonth,
    toIsoMonth,
    fetchData,
    reset,
    setThisMonth,
  } = useMonthlyViolationData({ onError, onLoad });
  const chartRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(
    ref,
    () => ({
      ...(chartRef.current as HTMLDivElement),
      getChartData: () =>
        data.map((item) => [item.month, item.url_count.toString()]),
      getTitle: () =>
        `เว็บไซต์ผิดกฎหมาย แยกตามเดือน ${
          sourceType === "import"
            ? "(การนำเข้าทั้งหมด)"
            : sourceType === "petition"
            ? "(มีคำร้อง)"
            : sourceType === "court"
            ? "(มีคำสั่งศาล)"
            : ""
        }`,
      refreshData: fetchData,
    }),
    [data, sourceType, fetchData]
  );
  return (
    <div ref={chartRef} className="w-full h-full">
      <MonthlyViolationChartView
        data={data}
        error={error}
        startMonth={startMonth}
        endMonth={endMonth}
        sourceType={sourceType}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        setSourceType={setSourceType}
        toDisplayMonth={toDisplayMonth}
        toIsoMonth={toIsoMonth}
        reset={reset}
        setThisMonth={setThisMonth}
        onDataLabelClick={onDataLabelClick}
        legendClassName={legendClassName}
        colors={colors}
        chartType={chartType}
      />
    </div>
  );
});
MonthlyViolationChart.displayName = "MonthlyViolationChart";

export { MonthlyViolationChart };
