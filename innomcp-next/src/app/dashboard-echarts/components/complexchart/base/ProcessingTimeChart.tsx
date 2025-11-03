"use client";

import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import DashboardChartRender from "@/app/dashboard-echarts/components/complexchart/base/lib/DashboardChartRender";
import ProcessingTimeChartFilter from "@/app/dashboard-echarts/components/complexchart/base/filter/ProcessingTimeChartFilter";
import { useViolationGroups } from "@/app/dashboard-echarts/components/complexchart/base/filter/ViolationGroupContext";
import {
  toDisplayDate as sharedToDisplayDate,
  toIsoDate as sharedToIsoDate,
  validateDateRange as sharedValidateDateRange,
  getDefaultDates as sharedGetDefaultDates,
  getChartColorsFromCSS as sharedGetChartColorsFromCSS,
  mapChartType,
} from "@/app/dashboard-echarts/components/complexchart/base/sharedChartUtils";

// LoadingSpinner removed for charts - avoid showing spinner while charts initialize
import { fetchWithApiProxy } from "@/app/lib/apiProxy";
import { getCSRFToken } from "@/utils/csrf";

type ProcessingTimeData = {
  group_name: string;
  avg_hours: number | null;
};

type ProcessingTimeChartProps = {
  forReport?: boolean;
  chartType?: "bar" | "bubble" | "line" | "area" | "pie" | "donut" | "radar";
  onError?: () => void;
  onLoad?: () => void;
  legendClassName?: string;
  colors?: string[];
  stacked?: boolean;
  stackedAxis?: "x" | "y";
};

export type ProcessingTimeChartHandle = {
  getChartData: () => string[][];
  getTitle: () => string;
  refreshData: () => void;
};

// Custom hook: ดึงข้อมูลและเตรียมข้อมูลสำหรับรายงาน
function useProcessingTimeData(onLoad?: () => void, onError?: () => void) {
  const { startDate: defaultStartDate, endDate: defaultEndDate } =
    sharedGetDefaultDates();

  const [data, setData] = useState<ProcessingTimeData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);
  const [groupByValue, setGroupByValue] = useState<string>(""); // Start with empty value
  const [displayMetric, setDisplayMetric] = useState<string>(""); // Start with empty value

  // Load from localStorage on mount
  useEffect(() => {
    const savedGroupBy =
      typeof window !== "undefined"
        ? localStorage.getItem("processingTimeGroupBy")
        : null;
    const savedMetric =
      typeof window !== "undefined"
        ? localStorage.getItem("processingTimeMetric")
        : null;
    if (savedGroupBy) setGroupByValue(savedGroupBy);
    if (savedMetric) setDisplayMetric(savedMetric);
  }, []);

  const toDisplayDate = sharedToDisplayDate;
  const toIsoDate = sharedToIsoDate;
  const validateDateRange = sharedValidateDateRange;

  const host = process.env.NEXT_PUBLIC_NODE_HOST || "";
  const { selectedGroups, violationGroups } = useViolationGroups();

  // Extract fetchData function to be reusable
  const fetchData = async () => {
    setError(null);
    if (!groupByValue || !displayMetric) {
      setData([]);
      return;
    }
    if (startDate && endDate && !validateDateRange(startDate, endDate)) {
      setError("วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด");
      onLoad?.();
      return;
    }

    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (groupByValue) params.append("sourceType", groupByValue);
    if (displayMetric) params.append("durationType", displayMetric);

    const endpoint = `${host}/api/urlstats/processing-time?${params.toString()}`;

    const csrfToken = await getCSRFToken();
    if (!csrfToken) {
      setError("ไม่สามารถรับ CSRF token ได้");
      onError?.();
      return;
    }

    try {
      const result = await fetchWithApiProxy(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          startDate,
          endDate,
          groupByValue,
          displayMetric,
          selectedGroups: selectedGroups || [],
        }),
      });
      // If user selected specific violation group ids, the backend may not
      // always apply that filter; as a safety we filter client-side by
      // mapping ids -> names (from violationGroups) and only keeping items
      // whose group_name matches one of the selected names.
      let fetched: ProcessingTimeData[] = Array.isArray(result.data)
        ? result.data
        : [];
      if (selectedGroups && selectedGroups.length > 0 && violationGroups) {
        const allowedNames = violationGroups
          .filter((g) => selectedGroups.includes(g.id))
          .map((g) => g.name);
        fetched = fetched.filter((item) =>
          allowedNames.includes(item.group_name)
        );
      }
      setData(fetched);
      onLoad?.();
    } catch {
      setError("ไม่สามารถโหลดข้อมูลได้ กรุณาลองอีกครั้ง");
      onLoad?.();
    }
  };

  // Load data
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, groupByValue, displayMetric, selectedGroups]);

  // Helper: แปลงค่าตัวเลือกเป็น label ภาษาไทย
  function getGroupByLabel(val: string) {
    switch (val) {
      case "url":
        return "ยังไม่มีคำร้อง";
      case "petition":
        return "มีคำร้อง";
      case "court":
        return "มีคำร้อง-คำสั่งศาล";
      default:
        return "";
    }
  }
  function getDisplayMetricLabel(val: string) {
    switch (val) {
      case "url_to_inspect1":
        return "บันทึก URL-ฝ่ายต้นทางตรวจสอบ";
      case "inspect1_to_inspect2":
        return "ฝ่ายต้นทางตรวจสอบ-ฝ่ายกฎหมายตรวจสอบ";
      case "inspect2_to_petition":
        return "ฝ่ายกฎหมายตรวจสอบ-วันที่มีคำร้อง";
      case "petition_to_court":
        return "วันที่มีคำร้อง-วันที่มีคำสั่งศาล";
      case "url_to_court":
        return "ทั้งหมด บันทึก URL-วันที่มีคำสั่งศาล";
      default:
        return "";
    }
  }
  function formatLabelForChart(val: number | null | undefined): string {
    if (val == null || isNaN(val)) return "-";
    const totalHours = Number(val);
    const totalMinutes = Math.round(totalHours * 60);
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    return `${days} วัน ${hours} ชม. ${minutes} นาที`;
  }

  // สำหรับรายงาน/export
  const getChartData = () =>
    data.map((item) => [item.group_name, formatLabelForChart(item.avg_hours)]);
  const getTitle = () => {
    const groupLabel = groupByValue
      ? `กลุ่ม: ${getGroupByLabel(groupByValue)}`
      : "";
    const metricLabel = displayMetric
      ? `ช่วง: ${getDisplayMetricLabel(displayMetric)}`
      : "";
    return `ระยะเวลาการดำเนินการเฉลี่ย ${groupLabel} ${metricLabel}`.trim();
  };

  return {
    data,
    error,
    startDate,
    endDate,
    groupByValue,
    displayMetric,
    setStartDate,
    setEndDate,
    setGroupByValue,
    setDisplayMetric,
    getDefaultDates: sharedGetDefaultDates,
    validateDateRange,
    toDisplayDate,
    toIsoDate,
    getChartData,
    getTitle,
    fetchData,
    formatLabelForChart,
    getGroupByLabel,
    getDisplayMetricLabel,
    defaultStartDate,
    defaultEndDate,
  };
}

// Pure chart view component
type ProcessingTimeChartViewProps = {
  data: ProcessingTimeData[];
  error: string | null;
  startDate: string;
  endDate: string;
  groupByValue: string;
  displayMetric: string;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  setGroupByValue: (v: string) => void;
  setDisplayMetric: (v: string) => void;
  getDefaultDates: () => { startDate: string; endDate: string };
  validateDateRange: (start: string, end: string) => boolean;
  toDisplayDate: (iso: string) => string;
  toIsoDate: (display: string) => string;
  formatLabelForChart: (val: number | null | undefined) => string;
  legendClassName?: string;
  colors?: string[];
  chartType?: "bar" | "bubble" | "line" | "area" | "pie" | "donut" | "radar";
  stacked?: boolean;
  stackedAxis?: "x" | "y";
};

const ProcessingTimeChartView = ({
  data,
  error,
  startDate,
  endDate,
  groupByValue,
  displayMetric,
  setStartDate,
  setEndDate,
  setGroupByValue,
  setDisplayMetric,
  getDefaultDates,
  toDisplayDate,
  toIsoDate,
  formatLabelForChart,
  legendClassName,
  colors,
  chartType = "line",
  stacked = false,
  stackedAxis = "y",
}: ProcessingTimeChartViewProps) => {
  const startDateInputRef = useRef<HTMLInputElement>(
    null
  ) as React.RefObject<HTMLInputElement>;
  const endDateInputRef = useRef<HTMLInputElement>(
    null
  ) as React.RefObject<HTMLInputElement>;
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Use shared chart colors helper
  const getChartColorsFromCSS = sharedGetChartColorsFromCSS;

  // Helper functions for labels
  function getGroupByLabel(val: string) {
    switch (val) {
      case "url":
        return "ยังไม่มีคำร้อง";
      case "petition":
        return "มีคำร้อง";
      case "order":
        return "มีคำร้อง-คำสั่งศาล";
      default:
        return "";
    }
  }
  function getDisplayMetricLabel(val: string) {
    switch (val) {
      case "url_to_inspect1":
        return "บันทึก URL-ฝ่ายต้นทางตรวจสอบ";
      case "inspect1_to_inspect2":
        return "ฝ่ายต้นทางตรวจสอบ-ฝ่ายกฎหมายตรวจสอบ";
      case "inspect2_to_petition":
        return "ฝ่ายกฎหมายตรวจสอบ-วันที่มีคำร้อง";
      case "petition_to_order":
        return "วันที่มีคำร้อง-วันที่มีคำสั่งศาล";
      case "total":
        return "ทั้งหมด บันทึก URL-วันที่มีคำสั่งศาล";
      default:
        return "";
    }
  }

  const chartData = {
    dataPoints: data.map((item) => {
      const value = Number(item.avg_hours);
      return {
        x: item.group_name,
        y: isNaN(value) ? 0 : value,
        category: item.group_name,
      };
    }),
  };

  // Handler for today/reset
  const handleToday = () => {
  // ใช้ local date (Asia/Bangkok) ไม่ใช่ UTC
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  const localISODate = new Date(now.getTime() - offsetMs).toISOString().split("T")[0];
  setStartDate(localISODate);
  setEndDate(localISODate);
  };
  const handleReset = () => {
    const { startDate: defaultStart, endDate: defaultEnd } = getDefaultDates();
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setGroupByValue("");
    setDisplayMetric("");
    if (typeof window !== "undefined") {
      localStorage.removeItem("processingTimeGroupBy");
      localStorage.removeItem("processingTimeMetric");
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-visible">
      <ProcessingTimeChartFilter
        groupByValue={groupByValue}
        setGroupByValue={setGroupByValue}
        displayMetric={displayMetric}
        setDisplayMetric={setDisplayMetric}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        toDisplayDate={toDisplayDate}
        toIsoDate={toIsoDate}
        startDateInputRef={startDateInputRef}
        endDateInputRef={endDateInputRef}
        onToday={handleToday}
        onReset={handleReset}
        chartRef={chartContainerRef}
      />
      {/* Chart area */}
      <div className="flex-grow overflow-visible">
        {error ? (
          <div className="text-red-600 bg-red-100 border border-red-300 rounded px-4 py-2 text-center my-4">
            <div className="flex items-center justify-center">
              <i className="fa fa-exclamation-circle mr-2" aria-hidden="true" />
              <span>{error}</span>
            </div>
          </div>
        ) : !groupByValue || !displayMetric ? (
          <div className="text-gray-600 bg-gray-100 border border-gray-300 rounded px-4 py-2 text-center my-4">
            ไม่พบข้อมูล
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
                    "ระยะเวลาการดำเนินการเฉลี่ยแยกตามประเภทความผิด" +
                    (groupByValue
                      ? ` | กลุ่ม: ${getGroupByLabel(groupByValue)}`
                      : "") +
                    (displayMetric
                      ? ` | ช่วง: ${getDisplayMetricLabel(displayMetric)}`
                      : "")
                  }
                  showTitle={true}
                  showDataLabels={true}
                  legendClassName={legendClassName}
                  colors={
                    colors && colors.length > 0
                      ? colors
                      : getChartColorsFromCSS()
                  }
                  labelFormatter={formatLabelForChart}
                  type={mappedType}
                  area={isArea}
                  isDonut={chartType === "donut"}
                  stacked={stacked}
                  stackedAxis={stackedAxis}
                />
              );
            })()}
            {/* Chart summary information */}
            <div className="text-2xl font-semibold text-green-700 text-center mt-2">
              จำนวนข้อมูล: {data.length} รายการ
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

const ProcessingTimeChart = forwardRef<
  ProcessingTimeChartHandle,
  ProcessingTimeChartProps
>((props, ref) => {
  const { onLoad, legendClassName, colors, chartType = "line" } = props;
  const {
    data,
    error,
    startDate,
    endDate,
    groupByValue,
    displayMetric,
    setStartDate,
    setEndDate,
    setGroupByValue,
    setDisplayMetric,
    getDefaultDates,
    validateDateRange,
    toDisplayDate,
    toIsoDate,
    getChartData,
    getTitle,
    fetchData,
    formatLabelForChart,
  } = useProcessingTimeData(onLoad, props.onError);

  useImperativeHandle(
    ref,
    () => ({
      getChartData,
      getTitle,
      refreshData: fetchData,
    }),
    [getChartData, getTitle, fetchData]
  );

  return (
    <ProcessingTimeChartView
      data={data}
      error={error}
      startDate={startDate}
      endDate={endDate}
      groupByValue={groupByValue}
      displayMetric={displayMetric}
      setStartDate={setStartDate}
      setEndDate={setEndDate}
      setGroupByValue={setGroupByValue}
      setDisplayMetric={setDisplayMetric}
      getDefaultDates={getDefaultDates}
      validateDateRange={validateDateRange}
      toDisplayDate={toDisplayDate}
      toIsoDate={toIsoDate}
      formatLabelForChart={formatLabelForChart}
      legendClassName={legendClassName}
      colors={colors}
      chartType={chartType}
      stacked={props.stacked}
      stackedAxis={props.stackedAxis}
    />
  );
});

ProcessingTimeChart.displayName = "ProcessingTimeChart";

export default ProcessingTimeChart;
