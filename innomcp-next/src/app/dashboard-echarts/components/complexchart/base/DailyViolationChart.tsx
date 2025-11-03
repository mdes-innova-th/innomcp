"use client";

import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import DashboardChartRender from "@/app/dashboard-echarts/components/complexchart/base/lib/DashboardChartRender";
import DailyViolationChartFilter from "@/app/dashboard-echarts/components/complexchart/base/filter/DailyViolationChartFilter";
import { useViolationGroups } from "@/app/dashboard-echarts/components/complexchart/base/filter/ViolationGroupContext";
import {
  toDisplayDate,
  toIsoDate,
  mapChartType,
  validateDateRange as sharedValidateDateRange,
  getDefaultDates as sharedGetDefaultDates,
} from "@/app/dashboard-echarts/components/complexchart/base/sharedChartUtils";

// LoadingSpinner removed for charts - avoid showing spinner while charts initialize
import { fetchWithApiProxy } from "@/app/lib/apiProxy";
import { getCSRFToken } from "@/utils/csrf";
import React from "react";

type DailyViolationData = {
  date: string;
  group_name: string;
  url_count: number;
};

type ChartType = "bubble" | "line" | "bar" | "pie" | "area" | "donut" | "radar";

type DailyViolationChartProps = {
  onDataLabelClick?: (date: string, groupName: string) => void;
  onError?: () => void;
  onLoad?: () => void;
  legendClassName?: string; // เพิ่ม prop นี้
  colors?: string[]; // เพิ่ม prop สำหรับ custom colors
  chartType?: ChartType; // เพิ่ม prop สำหรับประเภท chart (เช่น 'line', 'bar')
  stacked?: boolean;
  stackedAxis?: "x" | "y";
};

// Define a type for the imperative handle
export type DailyViolationChartHandle = {
  getChartData: () => string[][];
  getTitle: () => string;
  refreshData: () => void;
};

// Custom hook: ดึงข้อมูลและเตรียมข้อมูลสำหรับรายงาน
function useDailyViolationData(
  defaultDays: number = 30,
  onLoad?: () => void,
  onError?: () => void
) {
  // Get default dates
  const { startDate: defaultStartDate, endDate: defaultEndDate } =
    sharedGetDefaultDates(defaultDays);

  const [data, setData] = useState<DailyViolationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);
  const [sourceType, setSourceType] = useState<string>("");

  // On mount, load from localStorage if exists
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("dailyViolationSourceType")
        : null;
    if (saved) setSourceType(saved);
  }, []);

  // Use shared validator
  const validateDateRange = sharedValidateDateRange;

  const host = process.env.NEXT_PUBLIC_NODE_HOST || "";
  const { selectedGroups } = useViolationGroups();

  // Extract fetchData function to be reusable
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    if (!sourceType) {
      setLoading(false);
      setData([]);
      onLoad?.();
      return;
    }
    if (startDate && endDate && !validateDateRange(startDate, endDate)) {
      setError("วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด");
      setLoading(false);
      onLoad?.();
      return;
    }

    const body = {
      startDate,
      endDate,
      sourceType,
      selectedGroups: selectedGroups || [],
    };

    const endpoint = `${host}/api/urlstats/by-date-count`;

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
        onLoad?.();
        break;
      }
    }
    setLoading(false);
  };

  // Load data on component mount and when date filters change
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, sourceType, selectedGroups]);

  // helpers moved to sharedChartUtils

  // สำหรับรายงาน/export
  const getChartData = () =>
    data.map((item) => [
      new Date(item.date).toLocaleDateString("th-TH"),
      item.group_name,
      item.url_count.toString(),
    ]);
  const getTitle = () =>
    `เว็บไซต์ผิดกฎหมาย แยกตามวันที่ ${
      sourceType === "import"
        ? "(การนำเข้าทั้งหมด)"
        : sourceType === "petition"
        ? "(มีคำร้อง)"
        : sourceType === "court"
        ? "(มีคำสั่งศาล)"
        : ""
    }`;

  return {
    data,
    loading,
    error,
    startDate,
    endDate,
    sourceType,
    setStartDate,
    setEndDate,
    setSourceType,
    toDisplayDate,
    toIsoDate,
    getChartData,
    getTitle,
    fetchData,
    defaultStartDate,
    defaultEndDate,
  };
}
type DailyViolationChartViewProps = {
  data: DailyViolationData[];
  error: string | null;
  startDate: string;
  endDate: string;
  sourceType: string;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  setSourceType: (v: string) => void;
  toDisplayDate: (v: string) => string;
  toIsoDate: (v: string) => string;
  legendClassName?: string;
  colors?: string[];
  chartType?: ChartType;
  stacked?: boolean;
  stackedAxis?: "x" | "y";
  onDataLabelClick?: (date: string, groupName: string) => void;
  onReset: () => void;
  onToday: () => void;
};

const DailyViolationChartView = ({
  data,
  error,
  startDate,
  endDate,
  sourceType,
  setStartDate,
  setEndDate,
  setSourceType,
  toDisplayDate,
  toIsoDate,
  legendClassName,
  colors,
  chartType = "line",
  stacked = false,
  stackedAxis = "y",
  onDataLabelClick,
  onReset,
  onToday,
}: DailyViolationChartViewProps) => {
  const startDateInputRef = useRef<HTMLInputElement>(
    null
  ) as React.RefObject<HTMLInputElement>;
  const endDateInputRef = useRef<HTMLInputElement>(
    null
  ) as React.RefObject<HTMLInputElement>;
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartData = {
    dataPoints: data.map((item) => ({
      x: item.date,
      y: item.url_count,
      category: item.group_name,
    })),
  };
  return (
    <div className="w-full h-full flex flex-col overflow-visible">
      <DailyViolationChartFilter
        sourceType={sourceType}
        setSourceType={setSourceType}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        toDisplayDate={toDisplayDate}
        toIsoDate={toIsoDate}
        startDateInputRef={startDateInputRef}
        endDateInputRef={endDateInputRef}
        onToday={onToday}
        onReset={onReset}
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
                  title={`เว็บไซต์ผิดกฎหมาย แยกตามวันที่ (${
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
                          onDataLabelClick(
                            typeof x === "string" ? x : String(x),
                            group ?? ""
                          )
                      : undefined
                  }
                  legendClassName={legendClassName}
                  colors={colors}
                  area={isArea}
                  areaOpacity={0.4}
                  type={mappedType}
                  stacked={stacked}
                  stackedAxis={stackedAxis}
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
              {startDate &&
                endDate &&
                (startDate === endDate
                  ? `วันที่ ${new Date(startDate).toLocaleDateString("th-TH")}`
                  : `ช่วงวันที่ ${new Date(startDate).toLocaleDateString(
                      "th-TH"
                    )} - ${new Date(endDate).toLocaleDateString("th-TH")}`)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
DailyViolationChartView.displayName = "DailyViolationChartView";

// Main component: ใช้ hook และส่งข้อมูลให้ chart view
const DailyViolationChart = forwardRef<
  DailyViolationChartHandle,
  DailyViolationChartProps
>((props, ref) => {
  const defaultDays =
    typeof process.env.NEXT_PUBLIC_DEFAULT_DATA_DAYS === "string"
      ? parseInt(process.env.NEXT_PUBLIC_DEFAULT_DATA_DAYS, 10)
      : 30;
  const {
    data,
    error,
    startDate,
    endDate,
    sourceType,
    setStartDate,
    setEndDate,
    setSourceType,
    toDisplayDate,
    toIsoDate,
    getChartData,
    getTitle,
    fetchData,
    defaultStartDate,
    defaultEndDate,
  } = useDailyViolationData(defaultDays, props.onLoad, props.onError);
  const { onDataLabelClick, legendClassName, colors } = props;
  // imperative handle สำหรับ export/report
  useImperativeHandle(
    ref,
    () => ({
      getChartData,
      getTitle,
      refreshData: fetchData,
    }),
    [getChartData, getTitle, fetchData]
  );

  // reset และ today handler
  const handleReset = () => {
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
    setSourceType("");
    if (typeof window !== "undefined") {
      localStorage.removeItem("dailyViolationSourceType");
    }
  };

  const handleToday = () => {
  // ใช้ local date (Asia/Bangkok) ไม่ใช่ UTC
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  const localISODate = new Date(now.getTime() - offsetMs).toISOString().split("T")[0];
  setStartDate(localISODate);
  setEndDate(localISODate);
  };
  
  return (
    <DailyViolationChartView
      data={data}
      error={error}
      startDate={startDate}
      endDate={endDate}
      sourceType={sourceType}
      setStartDate={setStartDate}
      setEndDate={setEndDate}
      setSourceType={setSourceType}
      toDisplayDate={toDisplayDate}
      toIsoDate={toIsoDate}
      legendClassName={legendClassName}
      colors={colors}
      onDataLabelClick={onDataLabelClick}
      onReset={handleReset}
      onToday={handleToday}
      chartType={props.chartType}
      stacked={props.stacked}
      stackedAxis={props.stackedAxis}
    />
  );
});
DailyViolationChart.displayName = "DailyViolationChart";

export default DailyViolationChart;
