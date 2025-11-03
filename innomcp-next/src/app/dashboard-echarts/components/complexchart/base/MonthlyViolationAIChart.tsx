import React, {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import DashboardChartRender from "@/app/dashboard-echarts/components/complexchart/base/lib/DashboardChartRender";
import MonthlyViolationAIChartFilter from "@/app/dashboard-echarts/components/complexchart/base/filter/MonthlyViolationAIChartFilter";
import { useViolationGroups } from "@/app/dashboard-echarts/components/complexchart/base/filter/ViolationGroupContext";
import {
  toDisplayMonth as sharedToDisplayMonth,
  toIsoMonth as sharedToIsoMonth,
  validateMonthRange as sharedValidateMonthRange,
  getDefaultMonths as sharedGetDefaultMonths,
  mapChartType,
} from "@/app/dashboard-echarts/components/complexchart/base/sharedChartUtils";

// LoadingSpinner removed for charts - avoid showing spinner while charts initialize
import { fetchWithApiProxy } from "@/app/lib/apiProxy";
import { getCSRFToken } from "@/utils/csrf";

// Types
export type MonthlyViolationData = {
  month: string;
  url_count: number;
  group_name: string;
};

export type MonthlyViolationChartHandle = {
  getChartData: () => [string, string][];
  getTitle: () => string;
  refreshData: () => void;
};

export type MonthlyViolationChartProps = {
  onDataLabelClick?: (date: string, groupName: string) => void;
  chartType?: "bar" | "bubble" | "line" | "area" | "pie" | "donut" | "radar";
  onError?: () => void;
  onLoad?: () => void;
  legendClassName?: string;
  colors?: string[];
  stacked?: boolean;
  stackedAxis?: "x" | "y";
};

// Custom hook: useMonthlyViolationAIData
function useMonthlyViolationAIData({
  onError,
  onLoad,
}: {
  onError?: () => void;
  onLoad?: () => void;
}) {
  const validateDateRange = sharedValidateMonthRange;

  const { startMonth: defaultStartDate, endMonth: defaultEndDate } =
    sharedGetDefaultMonths();
  const [data, setData] = useState<MonthlyViolationData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startMonth, setStartDate] = useState<string>(defaultStartDate);
  const [endMonth, setEndDate] = useState<string>(defaultEndDate);
  const [sourceType, setSourceType] = useState<string>("");

  // On mount, load from localStorage if exists
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("aiMonthlyViolationSourceType")
        : null;
    if (saved) setSourceType(saved);
  }, []);

  const host = process.env.NEXT_PUBLIC_NODE_HOST || "";
  const { selectedGroups } = useViolationGroups();

  // Extract fetchData function to be reusable
  const fetchData = useCallback(async () => {
    // loading spinner removed; skip loading state
    setError(null);
    if (!sourceType) {
      setData([]);
      return;
    }
    if (startMonth && endMonth && !validateDateRange(startMonth, endMonth)) {
      setError("เดือนที่เริ่มต้นต้องไม่เกินเดือนสิ้นสุด");
      onError?.();
      return;
    }

    const body = {
      startMonth,
      endMonth,
      sourceType,
      selectedGroups: selectedGroups || [],
    };

    const endpoint = `${host}/api/urlstats/by-month-ai-count`;

    const csrfToken = await getCSRFToken();
    if (!csrfToken) {
      setError("ไม่สามารถรับ CSRF token ได้");
      onError?.();
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
    // loading state not used
  }, [
    startMonth,
    endMonth,
    sourceType,
    selectedGroups,
    onError,
    onLoad,
    host,
    validateDateRange,
  ]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMonth, endMonth, sourceType, selectedGroups]);

  const toDisplayMonth = sharedToDisplayMonth;
  const toIsoMonth = sharedToIsoMonth;

  // Reset handlers
  const resetToThisMonth = () => {
    // ใช้เวลาตามโซน Asia/Bangkok
    const now = new Date();
    // แปลงเป็นเวลาประเทศไทย (UTC+7)
    const bangkokOffset = 7 * 60; // นาที
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const bangkokDate = new Date(utc + bangkokOffset * 60000);
    const month = `${bangkokDate.getFullYear()}-${(bangkokDate.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;
    setStartDate(month);
    setEndDate(month);
  };
  const resetAll = () => {
    const { startMonth, endMonth } = sharedGetDefaultMonths();
    setStartDate(startMonth);
    setEndDate(endMonth);
    setSourceType("");
    if (typeof window !== "undefined") {
      localStorage.removeItem("aiMonthlyViolationSourceType");
    }
  };

  return {
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
    resetToThisMonth,
    resetAll,
    validateDateRange,
  };
}

// Pure view: MonthlyViolationAIChartView
type MonthlyViolationAIChartViewProps = {
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
  resetToThisMonth: () => void;
  resetAll: () => void;
  onDataLabelClick?: (date: string, groupName: string) => void;
  legendClassName?: string;
  colors?: string[];
  chartType?: "bar" | "bubble" | "line" | "area" | "pie" | "donut" | "radar";
  stacked?: boolean;
  stackedAxis?: "x" | "y";
};

const MonthlyViolationAIChartView: React.FC<
  MonthlyViolationAIChartViewProps
> = ({
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
  resetToThisMonth,
  resetAll,
  onDataLabelClick,
  legendClassName,
  colors,
  chartType = "bar",
  stacked = true,
  stackedAxis = "y",
}) => {
  const startMonthInputRef = useRef<HTMLInputElement>(
    null
  ) as React.RefObject<HTMLInputElement>;
  const endMonthInputRef = useRef<HTMLInputElement>(
    null
  ) as React.RefObject<HTMLInputElement>;
  const chartContainerRef = useRef<HTMLDivElement>(null);
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
      <MonthlyViolationAIChartFilter
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
        onThisMonth={resetToThisMonth}
        onReset={resetAll}
        chartRef={chartContainerRef}
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
          <div
            ref={chartContainerRef}
            data-chart-type={chartType}
            className="w-full overflow-x-auto"
          >
            {(() => {
              const { mappedType, isArea } = mapChartType(chartType);
              return (
                <DashboardChartRender
                  data={chartData.dataPoints}
                  stacked={stacked}
                  title={`เว็บไซต์ผิดกฎหมายที่นำเข้าโดยโครงการ AI แยกตามเดือน (${
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
                          typeof x === "string" && group
                            ? onDataLabelClick(x, group)
                            : undefined
                      : undefined
                  }
                  legendClassName={legendClassName}
                  colors={colors}
                  type={mappedType}
                  area={isArea}
                  isDonut={chartType === "donut"}
                  stackedAxis={stackedAxis}
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
                      "en-US",
                      { year: "numeric", month: "numeric" }
                    )}`
                  : `ช่วงเดือน ${new Date(
                      startMonth + "-01"
                    ).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "numeric",
                    })} - ${new Date(endMonth + "-01").toLocaleDateString(
                      "en-US",
                      { year: "numeric", month: "numeric" }
                    )}`)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main component: MonthlyViolationAIChart (with imperative handle)
export const MonthlyViolationAIChart = forwardRef<
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
    resetToThisMonth,
    resetAll,
  } = useMonthlyViolationAIData({ onError, onLoad });

  useImperativeHandle(
    ref,
    () => ({
      getChartData: () =>
        data.map((item) => [item.month, item.url_count.toString()]),
      getTitle: () => "เว็บไซต์ผิดกฎหมายที่นำเข้าโดยโครงการ AI (แยกตามเดือน)",
      refreshData: fetchData,
    }),
    [data, fetchData]
  );

  return (
    <MonthlyViolationAIChartView
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
      resetToThisMonth={resetToThisMonth}
      resetAll={resetAll}
      onDataLabelClick={onDataLabelClick}
      legendClassName={legendClassName}
      colors={colors}
      chartType={chartType}
      stacked={props.stacked}
      stackedAxis={props.stackedAxis}
    />
  );
});

MonthlyViolationAIChart.displayName = "MonthlyViolationAIChart";
