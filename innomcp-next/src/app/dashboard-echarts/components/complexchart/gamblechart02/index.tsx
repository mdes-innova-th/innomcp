"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { FaEye, FaChevronDown, FaChevronUp } from "react-icons/fa";
import DashboardChartRender from "@/app/dashboard-echarts/components/complexchart/base/lib/DashboardChartRender";
import { fetchWithApiProxy } from "@/app/lib/apiProxy";
import { getCSRFToken } from "@/utils/csrf";
import GambleChartFilter from "@/app/dashboard-echarts/components/complexchart/base/filter/GambleChartFilter";
import {
  toDisplayDate,
  toIsoDate,
  getDefaultDates,
} from "@/app/dashboard-echarts/components/complexchart/base/sharedChartUtils";
import { useRealTime } from "@/app/dashboard-echarts/context/RealTimeContext";

export type GambleChartHandle = {
  getChartData: () => string[][];
  getTitle: () => string;
  refreshData: () => void;
};

type ReportPayload = {
  tableHeaders: string[];
  tableRows: string[][];
  filename: string;
  valueSuffix?: string;
  dateRange?: { startDate?: string; endDate?: string };
  title: string;
  subtitle?: string;
  chartDivRef: React.RefObject<HTMLDivElement>;
};

type GambleItem = {
  name: string;
  count: number;
};

type Props = {
  id?: string;
  title?: string;
  colors?: string[];
  onOpenReport: (payload: ReportPayload) => void;
};

const GambleChart02 = forwardRef<GambleChartHandle, Props>(
  ({ id = "09", title = "", colors, onOpenReport }, ref) => {
    const chartDivRef = useRef<HTMLDivElement | null>(null);
    const [data, setData] = useState<GambleItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [ready, setReady] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(() =>
      getCollapsedState("chartCollapsedGamble02", true)
    );
    // default dates
    const { startDate: defaultStartDate, endDate: defaultEndDate } =
      getDefaultDates();
    const [startDate, setStartDate] = useState<string>(defaultStartDate);
    const [endDate, setEndDate] = useState<string>(defaultEndDate);
    const startDateInputRef = useRef<HTMLInputElement>(
      null
    ) as React.RefObject<HTMLInputElement>;
    const endDateInputRef = useRef<HTMLInputElement>(
      null
    ) as React.RefObject<HTMLInputElement>;
    const [sourceType, setSourceType] = useState<string>("");

    const host = process.env.NEXT_PUBLIC_NODE_HOST || "";
    const { isRealtimeEnabled } = useRealTime();

    function getCollapsedState(key: string, defaultValue: boolean): boolean {
      if (
        typeof window !== "undefined" &&
        typeof localStorage !== "undefined"
      ) {
        const storedValue = localStorage.getItem(key);
        return storedValue !== null ? JSON.parse(storedValue) : defaultValue;
      }
      return defaultValue;
    }
    function setCollapsedState(key: string, value: boolean): void {
      if (
        typeof window !== "undefined" &&
        typeof localStorage !== "undefined"
      ) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    }

    const toggle = () => {
      const ns = !isCollapsed;
      setIsCollapsed(ns);
      setCollapsedState("chartCollapsedGamble02", ns);
    };

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setReady(false);
      try {
        // Mirror other charts: require a selected sourceType to fetch data
        if (!sourceType) {
          setData([]);
          setError(null);
          setLoading(false);
          setReady(false);
          return;
        }

        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
          // invalid range - notify user like other charts
          setData([]);
          setError("วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด");
          setLoading(false);
          setReady(false);
          return;
        }

        const body: Record<string, unknown> = {
          startDate,
          endDate,
          sourceType,
        };
        // selectedGroups is handled by filter context; include as param if present
        const selectedGroups =
          typeof window !== "undefined"
            ? localStorage.getItem("gambleGroupsSelected")
            : null;
        if (selectedGroups) {
          try {
            body.selectedGroups = JSON.parse(selectedGroups);
          } catch {
            body.selectedGroups = selectedGroups
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean);
          }
        }

        const endpoint = `${host}/api/urlgamble/map-url-groups`;
        const csrfToken = await getCSRFToken();
        const result = await fetchWithApiProxy(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
          body: JSON.stringify(body),
        });

        const processedData = Object.entries(
          result as { [key: string]: { urls: string[]; count: number } }
        ).map(([key, value]) => ({
          name: key,
          count: value.count,
        }));
        setData(processedData);
        setError(null);
        setReady(true);
      } catch (err: unknown) {
        console.error("[GambleChart02] fetch error:", err);
        const msg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: unknown }).message ?? "")
            : String(err ?? "");
        if (msg.includes("Status: 404") || msg.includes("404")) {
          setData([]);
          setError(null);
          setReady(true);
        } else {
          setData([]);
          setError("ไม่สามารถโหลดข้อมูลได้ กรุณาลองอีกครั้ง");
        }
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      // initial fetch
      fetchData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      // re-fetch when date/source filters change
      if (!isCollapsed) fetchData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate, sourceType, isCollapsed]);

    useImperativeHandle(ref, () => ({
      getChartData: () => data.map((item) => [item.name, String(item.count)]),
      getTitle: () => title || "กลุ่มโดเมนเนมจาก URL",
      refreshData: fetchData,
    }));

    // Handler for 'วันนี้' button
    const handleToday = () => {
      // Use local date (account for timezone offset) to produce YYYY-MM-DD
      const now = new Date();
      const offsetMs = now.getTimezoneOffset() * 60000;
      const localISODate = new Date(now.getTime() - offsetMs)
        .toISOString()
        .split("T")[0];
      setStartDate(localISODate);
      setEndDate(localISODate);
    };

    const handlePreview = async () => {
      const chartTitle = title || "กลุ่มโดเมนเนมจาก URL";
      try {
        const endpoint = `${host}/api/urlgamble/group-domains/report`;
        const csrfToken = await getCSRFToken();
        const body: Record<string, unknown> = {
          startDate,
          endDate,
          sourceType,
        };

        const selectedGroupsRaw =
          typeof window !== "undefined"
            ? localStorage.getItem("gambleGroupsSelected")
            : null;
        if (selectedGroupsRaw) {
          try {
            body.selectedGroups = JSON.parse(selectedGroupsRaw as string);
          } catch {
            body.selectedGroups = selectedGroupsRaw as string;
          }
        }

        const result = await fetchWithApiProxy(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
          },
          body: JSON.stringify(body),
        });

        type ReportRow = {
          group_name?: string;
          caselist_url?: string;
          import_date?: string | null;
          order?: Record<string, unknown> | null;
          petition?: Record<string, unknown> | null;
        };

        const payload = result as unknown;
        let rowsData: ReportRow[] = [];
        if (Array.isArray(payload)) rowsData = payload as ReportRow[];
        else if (payload && typeof payload === "object" && "data" in payload)
          rowsData = (payload as { data?: unknown }).data as ReportRow[];

        // Build headers (same as gamblechart01) to show detailed URL rows
        const headers = [
          "ลำดับ",
          "ชื่อกลุ่ม",
          "จำนวน",
          "URL",
          "วันที่นำเข้า",
          "วันที่คำร้อง",
          "เลขที่คำสั่งศาล(ดำ)",
          "วันที่คำสั่งศาล(ดำ)",
          "เลขที่คำสั่งศาล(แดง)",
          "วันที่คำสั่งศาล(แดง)",
        ];

        // Group by group_name like other chart
        const grouped: Record<string, ReportRow[]> = {};
        rowsData.forEach((r) => {
          const key = r.group_name ?? "";
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(r);
        });

        const groupedEntries = Object.entries(grouped);
        groupedEntries.sort((a, b) => b[1].length - a[1].length);

        const tableRows: string[][] = [];
        let groupIndex = 0;
        for (const [groupName, items] of groupedEntries) {
          groupIndex += 1;
          items.forEach((item, idx) => {
            const rowBase: string[] = [];
            rowBase.push(idx === 0 ? String(groupIndex) : "");
            rowBase.push(idx === 0 ? String(groupName) : "");
            rowBase.push(
              idx === 0 ? `${items.length.toLocaleString()} URL` : ""
            );
            rowBase.push(String(item.caselist_url ?? ""));

            const itemRecord = item as Record<string, unknown>;
            const importDateRaw =
              (itemRecord["import_date"] as string) ||
              (itemRecord["creatdate"] as string) ||
              "";
            const importDateDisplay = importDateRaw
              ? new Date(importDateRaw).toLocaleDateString("th-TH")
              : "-";

            const petition = item.petition ?? {};
            const petitionDateRaw = (petition["petition_date"] as string) || "";
            const petitionDateDisplay = petitionDateRaw
              ? new Date(petitionDateRaw).toLocaleDateString("th-TH")
              : "-";

            const order = item.order ?? {};
            const blackOrderNo = (order["order_no"] as string) || "";
            const blackOrderDateRaw = (order["order_date"] as string) || "";
            const blackOrderDate = blackOrderDateRaw
              ? new Date(blackOrderDateRaw).toLocaleDateString("th-TH")
              : "-";
            const redOrderNo = (order["orderred_no"] as string) || "";
            const redOrderDateRaw = (order["orderred_date"] as string) || "";
            const redOrderDate = redOrderDateRaw
              ? new Date(redOrderDateRaw).toLocaleDateString("th-TH")
              : "-";

            rowBase.push(String(importDateDisplay));
            rowBase.push(String(petitionDateDisplay));
            rowBase.push(
              String(blackOrderNo || "-"),
              String(blackOrderDate || "-"),
              String(redOrderNo || "-"),
              String(redOrderDate || "-")
            );

            tableRows.push(rowBase);
          });
        }

        const hasAny = rowsData.some(
          (r) => Boolean(r.order) || Boolean(r.petition)
        );

        onOpenReport({
          tableHeaders: headers,
          tableRows,
          filename: `${chartTitle
            .replace(/\s+/g, "_")
            .toLowerCase()}_report.docx`,
          valueSuffix: hasAny ? undefined : "URL",
          dateRange: { startDate, endDate },
          title: chartTitle,
          subtitle: "",
          chartDivRef: chartDivRef as React.RefObject<HTMLDivElement>,
        });
      } catch (err) {
        console.error("Error fetching report preview:", err);
        // fallback to summary report
        const rows = data.map((item) => [item.name, String(item.count)]);
        onOpenReport({
          tableHeaders: ["กลุ่ม", "จำนวน URL"],
          tableRows: rows,
          filename: `${chartTitle
            .replace(/\s+/g, "_")
            .toLowerCase()}_report.docx`,
          valueSuffix: "URL",
          dateRange: { startDate, endDate },
          title: chartTitle,
          subtitle: "",
          chartDivRef: chartDivRef as React.RefObject<HTMLDivElement>,
        });
      }
    };

    const chartDataPoints = data.map((item) => ({
      x: item.name,
      y: item.count,
    }));

    return (
      <div
        data-chart-id={id}
        ref={chartDivRef}
        className={`bg-white w-full max-w-full rounded-lg shadow-lg transition-all duration-300 ${
          isCollapsed ? "h-16" : "min-h-[400px] h-auto"
        }`}
      >
        <div className="p-2">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-800">
                  {title || "กลุ่มโดเมนเนมจาก URL"}
                </h3>
                {isRealtimeEnabled && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-400 text-white font-semibold">
                    non-Real-time
                  </span>
                )}
              </div>
              {/* Filter hidden when collapsed to match other charts */}
              {!isCollapsed && (
                <div className="mt-1">
                  <GambleChartFilter
                    sourceType={sourceType}
                    setSourceType={(v) => {
                      setSourceType(v);
                      if (typeof window !== "undefined") {
                        localStorage.setItem("gambleSourceType", v);
                      }
                    }}
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
                    chartType={"pie"}
                    chartRef={chartDivRef}
                  />
                </div>
              )}
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              <button
                onClick={toggle}
                className="bg-gray-100 hover:bg-gray-200 cursor-pointer p-1.5 h-8 w-8 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
                title={isCollapsed ? "ขยาย" : "ย่อ"}
                aria-label={isCollapsed ? "ขยายกราฟ" : "ย่อกราฟ"}
              >
                {isCollapsed ? (
                  <FaChevronDown size={16} />
                ) : (
                  <FaChevronUp size={16} />
                )}
              </button>
              {!isCollapsed && !loading && ready && (
                <button
                  onClick={handlePreview}
                  className="text-sm flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors shadow-sm cursor-pointer"
                  title="พรีวิวและดาวน์โหลดรายงาน"
                >
                  <FaEye className="mr-2" size={16} /> พรีวิวรายงาน
                </button>
              )}
            </div>
          </div>

          {!isCollapsed && (
            <div className="mt-4">
              {error ? (
                <div className="text-red-600 bg-red-100 border border-red-300 rounded px-4 py-2 text-center my-4">
                  <div className="flex items-center justify-center">
                    <i
                      className="fa fa-exclamation-circle mr-2"
                      aria-hidden="true"
                    />
                    <span>{error}</span>
                  </div>
                </div>
              ) : data.length === 0 ? (
                <div className="text-gray-600 bg-gray-100 border border-gray-300 rounded px-4 py-2 text-center my-4">
                  ไม่พบข้อมูล
                </div>
              ) : (
                <div>
                  <DashboardChartRender
                    data={chartDataPoints}
                    title={title || "กลุ่มโดเมนเนมจาก URL"}
                    showTitle={true}
                    showDataLabels={true}
                    showXAxis={true}
                    showYAxis={true}
                    colors={colors}
                    type={"pie"}
                    isDonut={true}
                    donutThickness={0.18}
                  />
                  <div className="text-2xl font-semibold text-blue-700 text-center mt-2">
                    รวมทั้งหมด{" "}
                    {data
                      .reduce((sum, it) => sum + it.count, 0)
                      .toLocaleString()}{" "}
                    URL
                  </div>
                  <div className="text-lg font-bold text-gray-800 text-center mt-1 mb-2">
                    {startDate &&
                      endDate &&
                      (startDate === endDate
                        ? `วันที่ ${new Date(startDate).toLocaleDateString(
                            "th-TH"
                          )}`
                        : `ช่วงวันที่ ${new Date(startDate).toLocaleDateString(
                            "th-TH"
                          )} - ${new Date(endDate).toLocaleDateString(
                            "th-TH"
                          )}`)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

GambleChart02.displayName = "GambleChart02";

export default GambleChart02;
