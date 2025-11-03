import { FaRegCalendarAlt } from "react-icons/fa";
import { RefObject, useEffect } from "react";
import { useReportMode } from "@/app/dashboard-echarts/hooks/useReportMode";

interface ViolationGroupChartFilterProps {
  sourceType: string;
  setSourceType: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  toDisplayDate: (v: string) => string;
  toIsoDate: (v: string) => string;
  startDateInputRef: RefObject<HTMLInputElement>;
  endDateInputRef: RefObject<HTMLInputElement>;
  defaultStartDate: string;
  defaultEndDate: string;
  chartType: string;
  chartRef?: RefObject<HTMLDivElement | null>;
  onFilterChange?: (filters: {
    selectedGroups: string[];
    startDate: string;
    endDate: string;
    sourceType: string;
    chartType: string;
  }) => void;
  onToday?: () => void;
}

export default function ViolationGroupChartFilter({
  sourceType,
  setSourceType,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  toDisplayDate,
  toIsoDate,
  startDateInputRef,
  endDateInputRef,
  defaultStartDate,
  defaultEndDate,
  chartType,
  chartRef,
  onFilterChange,
  onToday,
}: ViolationGroupChartFilterProps) {
  const isInReportMode = useReportMode(chartRef);

  // แจ้ง parent component เมื่อ filter เปลี่ยน (เช่น startDate, endDate, sourceType)
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (typeof onFilterChange === "function") {
        // selectedGroups removed from this filter; send empty array to parent
        onFilterChange({
          selectedGroups: [],
          startDate,
          endDate,
          sourceType,
          chartType,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, sourceType, chartType]);

  // Hide the filter when in report mode
  if (isInReportMode) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-4 items-end mb-3 p-2 bg-white text-gray-900 rounded shadow-sm border border-gray-200">
      <div className="flex flex-col min-w-[180px]">
        <label className="text-xs font-semibold text-gray-700 mb-1">
          ข้อมูลจาก
        </label>
        <select
          value={sourceType}
          onChange={(e) => {
            setSourceType(e.target.value);
            if (typeof window !== "undefined") {
              localStorage.setItem(
                `violationTypeSourceType_${chartType}`,
                e.target.value
              );
            }
          }}
          className="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white text-gray-900"
        >
          <option value="" disabled hidden>
            เลือกแหล่งข้อมูล
          </option>
          <option value="import">การนำเข้าทั้งหมด</option>
          <option value="petition">มีคำร้อง</option>
          <option value="court">มีคำสั่งศาล</option>
        </select>
      </div>
      <div className="flex flex-col min-w-[160px]">
        <label className="text-xs font-semibold text-gray-700 mb-1">
          วันที่เริ่มต้น
        </label>
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="dd/mm/yyyy"
            value={toDisplayDate(startDate)}
            onChange={(e) => setStartDate(toIsoDate(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none w-full pr-8 bg-white text-gray-900"
            maxLength={10}
          />
          <button
            type="button"
            className="absolute right-2 text-gray-400 hover:text-blue-600"
            tabIndex={-1}
            onClick={() =>
              startDateInputRef.current?.showPicker &&
              startDateInputRef.current.showPicker()
            }
          >
            <FaRegCalendarAlt />
          </button>
          <input
            ref={startDateInputRef}
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            tabIndex={-1}
          />
        </div>
      </div>
      <div className="flex flex-col min-w-[160px]">
        <label className="text-xs font-semibold text-gray-700 mb-1">
          วันที่สิ้นสุด
        </label>
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="dd/mm/yyyy"
            value={toDisplayDate(endDate)}
            onChange={(e) => setEndDate(toIsoDate(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none w-full pr-8 bg-white text-gray-900"
            maxLength={10}
          />
          <button
            type="button"
            className="absolute right-2 text-gray-400 hover:text-blue-600"
            tabIndex={-1}
            onClick={() =>
              endDateInputRef.current?.showPicker &&
              endDateInputRef.current.showPicker()
            }
          >
            <FaRegCalendarAlt />
          </button>
          <input
            ref={endDateInputRef}
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            tabIndex={-1}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1 min-w-[100px]">
        <button
          onClick={onToday}
          className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-semibold hover:bg-blue-200 transition"
          title="เลือกวันนี้"
        >
          วันนี้
        </button>
        <button
          onClick={() => {
            setStartDate(defaultStartDate);
            setEndDate(defaultEndDate);
            setSourceType("");
            if (typeof window !== "undefined") {
              localStorage.removeItem(`violationTypeSourceType_${chartType}`);
            }
            console.log(
              "Reset button clicked: StartDate, EndDate, and localStorage reset."
            );
          }}
          className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition"
        >
          รีเซ็ต
        </button>
      </div>
      {/* 'ประเภทความผิด' filter removed as requested */}
    </div>
  );
}
