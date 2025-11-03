"use client";

import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import DashboardChartRender from "@/app/dashboard-echarts/components/complexchart/base/lib/DashboardChartRender";
// LoadingSpinner removed for charts - avoid showing spinner while charts initialize
import { fetchWithApiProxy } from "@/app/lib/apiProxy";
import { getCSRFToken } from "@/utils/csrf";
import { useViolationGroups } from "./filter/ViolationGroupContext";
import {
  toDisplayDate as sharedToDisplayDate,
  toIsoDate as sharedToIsoDate,
  validateDateRange as sharedValidateDateRange,
  getDefaultDates as sharedGetDefaultDates,
  mapChartType,
} from "./sharedChartUtils";
import ViolationGroupChartFilter from "@/app/dashboard-echarts/components/complexchart/base/filter/ViolationGroupChartFilter";

type ViolationTypeData = {
  group_name: string;
  url_count: number;
};

type ViolationGroupChartProps = {
  onDataLabelClick?: (
    groupName: string,
    startDate?: string,
    endDate?: string
  ) => void;
  chartType?: "bar" | "bubble" | "line" | "area" | "pie" | "donut" | "radar";
  onError?: () => void;
  onLoad?: () => void;
  legendClassName?: string; // เพิ่ม prop นี้
  colors?: string[]; // เพิ่ม prop สำหรับ custom colors
  stacked?: boolean;
  stackedAxis?: "x" | "y";
};

// Define a type for the imperative handle
export type ViolationGroupChartHandle = {
  getChartData: () => string[][];
  getTitle: () => string;
  refreshData: () => void;
};

// Custom hook: ดึงข้อมูลและเตรียมข้อมูลสำหรับรายงาน
function useViolationTypeData(
  chartType:
    | "bar"
    | "bubble"
    | "line"
    | "area"
    | "pie"
    | "donut"
    | "radar" = "bar",
  onLoad?: () => void,
  onError?: () => void
) {
  const { startDate: defaultStartDate, endDate: defaultEndDate } =
    sharedGetDefaultDates();
  const toDisplayDate = sharedToDisplayDate;
  const toIsoDate = sharedToIsoDate;

  const [data, setData] = useState<ViolationTypeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);
  const [sourceType, setSourceType] = useState<string>(""); // no default
  // Force refresh trigger
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Helper: get localStorage key by chartType
  const getSourceTypeKey = (type: string) => `violationTypeSourceType_${type}`;

  // On mount, load from localStorage if exists (per chartType)
  useEffect(() => {
    const key = getSourceTypeKey(chartType);
    const saved =
      typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (saved) setSourceType(saved);
  }, [chartType]);

  const validateDateRange = sharedValidateDateRange;

  const host = process.env.NEXT_PUBLIC_NODE_HOST || "";
  const { selectedGroups } = useViolationGroups();

  // Load data on component mount and when date filters change
  useEffect(() => {
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
        // show icon in UI; keep error message text only
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

      const endpoint = `${host}/api/urlstats/violation-groups-count`;

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
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, sourceType, selectedGroups, refreshTrigger]);

  // Force refresh method
  const refreshData = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // สำหรับรายงาน/export
  const getChartData = () =>
    data.map((item) => [item.group_name, item.url_count.toString()]);
  const getTitle = () =>
    `เว็บไซต์ผิดกฎหมาย (แยกตามประเภทความผิด)${
      sourceType === "import"
        ? " (การนำเข้าทั้งหมด)"
        : sourceType === "petition"
        ? " (มีคำร้อง)"
        : sourceType === "court"
        ? " (มีคำสั่งศาล)"
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
    refreshData,
    defaultStartDate,
    defaultEndDate,
  };
}

// Pure chart view component
type ViolationGroupChartViewProps = {
  data: ViolationTypeData[];
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
  onDataLabelClick?: (
    groupName: string,
    startDate?: string,
    endDate?: string
  ) => void;
  chartType: "bar" | "bubble" | "line" | "area" | "pie" | "donut" | "radar";
  defaultStartDate: string;
  defaultEndDate: string;
  stacked?: boolean;
  stackedAxis?: "x" | "y";
};

const ViolationGroupChartView = ({
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
  onDataLabelClick,
  chartType,
  defaultStartDate,
  defaultEndDate,
  stacked,
  stackedAxis,
}: ViolationGroupChartViewProps) => {
  const startDateInputRef = useRef<HTMLInputElement>(
    null
  ) as React.RefObject<HTMLInputElement>;
  const endDateInputRef = useRef<HTMLInputElement>(
    null
  ) as React.RefObject<HTMLInputElement>;
  const chartContainerRef = useRef<HTMLDivElement>(null);
  // Group and sum data by group_name (category)
  const groupedData = useMemo(() => {
    const result: { [key: string]: number } = {};
    data.forEach((item) => {
      if (!result[item.group_name]) {
        result[item.group_name] = 0;
      }
      result[item.group_name] += item.url_count;
    });
    return result;
  }, [data]);
  const chartData = {
    dataPoints: Object.entries(groupedData).map(([group_name, url_count]) => ({
      x: group_name, // x-axis label
      y: url_count, // y-axis value or bubble size
      category: group_name, // category for color/legend
    })),
  };

  const handleToday = () => {
    // ใช้ local date (Asia/Bangkok) ไม่ใช่ UTC
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    const localISODate = new Date(now.getTime() - offsetMs)
      .toISOString()
      .split("T")[0];
    setStartDate(localISODate);
    setEndDate(localISODate);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-visible">
      <ViolationGroupChartFilter
        sourceType={sourceType}
        setSourceType={setSourceType}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        onToday={handleToday}
        toDisplayDate={toDisplayDate}
        toIsoDate={toIsoDate}
        startDateInputRef={startDateInputRef}
        endDateInputRef={endDateInputRef}
        defaultStartDate={defaultStartDate}
        defaultEndDate={defaultEndDate}
        chartType={chartType}
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
                  title={
                    "เว็บไซต์ผิดกฎหมาย แยกตามประเภทความผิด" +
                    ` (${
                      sourceType === "import"
                        ? "การนำเข้า"
                        : sourceType === "petition"
                        ? "มีคำร้อง"
                        : "มีคำสั่งศาล"
                    })`
                  }
                  showTitle={true}
                  showDataLabels={true}
                  showXAxis={true}
                  showYAxis={true}
                  onBarLabelClick={
                    onDataLabelClick && chartType === "bar"
                      ? (groupName) =>
                          onDataLabelClick(groupName, startDate, endDate)
                      : undefined
                  }
                  onBubbleLabelClick={
                    onDataLabelClick && chartType === "bubble"
                      ? (groupName) =>
                          onDataLabelClick(groupName, startDate, endDate)
                      : undefined
                  }
                  legendClassName={legendClassName}
                  colors={colors}
                  type={mappedType}
                  stacked={stacked ?? false}
                  stackedAxis={stackedAxis ?? "y"}
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
            <div className="text-lg font-bold text-gray-800 text-center mt-1 mb-2">
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

const ViolationGroupChart = forwardRef<
  ViolationGroupChartHandle,
  ViolationGroupChartProps
>((props, ref) => {
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
    refreshData,
    defaultStartDate,
    defaultEndDate,
    // setData, // ลบออกเพราะไม่ได้ใช้
  } = useViolationTypeData(props.chartType, props.onLoad, props.onError);
  const {
    onDataLabelClick,
    legendClassName,
    colors,
    chartType = "bar",
  } = props;
  useImperativeHandle(
    ref,
    () => ({
      getChartData,
      getTitle,
      refreshData,
    }),
    [getChartData, getTitle, refreshData]
  );
  return (
    <ViolationGroupChartView
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
      stacked={props.stacked}
      stackedAxis={props.stackedAxis}
      onDataLabelClick={onDataLabelClick}
      chartType={chartType}
      defaultStartDate={defaultStartDate}
      defaultEndDate={defaultEndDate}
    />
  );
});
ViolationGroupChart.displayName = "ViolationGroupChart";
export default ViolationGroupChart;
