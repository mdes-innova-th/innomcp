import React, {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import DashboardChartRender from "@/app/dashboard-echarts/components/complexchart/base/lib/DashboardChartRender";
import DailyViolationAIChartFilter from "@/app/dashboard-echarts/components/complexchart/base/filter/DailyViolationAIChartFilter";
import { useViolationGroups } from "@/app/dashboard-echarts/components/complexchart/base/filter/ViolationGroupContext";
import {
  toDisplayDate,
  toIsoDate,
  validateDateRange,
  getDefaultDates,
  mapChartType,
} from "@/app/dashboard-echarts/components/complexchart/base/sharedChartUtils";

// LoadingSpinner removed for charts - avoid showing spinner while charts initialize
import { fetchWithApiProxy } from "@/app/lib/apiProxy";
import { getCSRFToken } from "@/utils/csrf";

type DailyViolationData = {
  date: string;
  group_name: string;
  url_count: number;
};

export type DailyViolationChartHandle = {
  getChartData: () => string[][];
  getTitle: () => string;
  refreshData: () => void;
};

export type DailyViolationChartProps = {
  onDataLabelClick?: (date: string, groupName: string) => void;
  chartType?: "bar" | "bubble" | "line" | "area" | "pie" | "donut" | "radar";
  onError?: () => void;
  onLoad?: () => void;
  legendClassName?: string;
  colors?: string[];
  stacked?: boolean;
  stackedAxis?: "x" | "y";
};

export const DailyViolationAIChart = forwardRef<
  DailyViolationChartHandle,
  DailyViolationChartProps
>((props, ref) => {
  const { startDate: defaultStartDate, endDate: defaultEndDate } =
    getDefaultDates();
  const [data, setData] = useState<DailyViolationData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);
  const [sourceType, setSourceType] = useState<string>("");
  const {
    onDataLabelClick,
    onError,
    onLoad,
    legendClassName,
    colors,
    chartType = "line",
  } = props;

  // On mount, load from localStorage if exists
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("aiDailyViolationSourceType")
        : null;
    if (saved) setSourceType(saved);
  }, []);

  // helpers (date helpers imported from sharedChartUtils)

  const host = process.env.NEXT_PUBLIC_NODE_HOST || "";
  const { selectedGroups } = useViolationGroups();

  // Extract fetchData function to be reusable
  const fetchData = useCallback(async () => {
    setError(null);
    if (!sourceType) {
      setData([]);
      if (typeof props?.onLoad === "function") props.onLoad();
      return;
    }
    if (startDate && endDate && !validateDateRange(startDate, endDate)) {
      setError("วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด");
      onError?.();
      return;
    }

    const body = {
      startDate,
      endDate,
      sourceType,
      selectedGroups: selectedGroups || [],
    };

    const endpoint = `${host}/api/urlstats/by-date-ai-count`;

    const csrfToken = await getCSRFToken();
    if (!csrfToken) {
      setError("ไม่สามารถรับ CSRF token ได้");
      onError?.();
      // loading state removed; just return
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
  }, [
    startDate,
    endDate,
    sourceType,
    selectedGroups,
    onError,
    onLoad,
    props,
    host,
  ]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, sourceType, selectedGroups]);

  useImperativeHandle(
    ref,
    () => ({
      getChartData: () =>
        data.map((item) => [
          new Date(item.date).toLocaleDateString("th-TH"),
          item.group_name,
          item.url_count.toString(),
        ]),
      getTitle: () => "เว็บไซต์ผิดกฎหมายที่นำเข้าโดยโครงการ AI (แยกตามวันที่)",
      refreshData: fetchData,
    }),
    [data, fetchData]
  );

  const startDateInputRef = useRef<HTMLInputElement>(
    null
  ) as React.RefObject<HTMLInputElement>;
  const endDateInputRef = useRef<HTMLInputElement>(
    null
  ) as React.RefObject<HTMLInputElement>;
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const handleToday = () => {
  // ใช้ local date (Asia/Bangkok) ไม่ใช่ UTC
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  const localISODate = new Date(now.getTime() - offsetMs).toISOString().split("T")[0];
  setStartDate(localISODate);
  setEndDate(localISODate);
  };
  
  const handleReset = () => {
    const { startDate: s, endDate: e } = getDefaultDates();
    setStartDate(s);
    setEndDate(e);
    setSourceType("");
    if (typeof window !== "undefined") {
      localStorage.removeItem("aiDailyViolationSourceType");
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-visible">
      <DailyViolationAIChartFilter
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
        onToday={handleToday}
        onReset={handleReset}
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
                  data={data.map((item) => ({
                    x: item.date,
                    y: item.url_count,
                    category: item.group_name,
                  }))}
                  title={`เว็บไซต์ผิดกฎหมายที่นำเข้าโดยโครงการ AI แยกตามวันที่ (${
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
                      ? (x, group) => onDataLabelClick(String(x), group ?? "")
                      : undefined
                  }
                  legendClassName={legendClassName}
                  colors={colors}
                  area={isArea}
                  areaOpacity={0.4}
                  type={mappedType}
                  stacked={props.stacked}
                  stackedAxis={props.stackedAxis}
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
});

DailyViolationAIChart.displayName = "DailyViolationAIChart";
