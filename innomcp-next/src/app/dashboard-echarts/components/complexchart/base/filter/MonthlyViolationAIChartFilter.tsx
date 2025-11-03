import { FaRegCalendarAlt } from "react-icons/fa";
import { RefObject, useEffect, useRef } from "react";
import { useReportMode } from "@/app/dashboard-echarts/hooks/useReportMode";
import { useViolationGroups } from "./ViolationGroupContext";
import { ViolationGroupCheckbox } from "./ViolationGroupCheckbox";

interface MonthlyViolationAIChartFilterProps {
  sourceType: string;
  setSourceType: (v: string) => void;
  startMonth: string;
  setStartMonth: (v: string) => void;
  endMonth: string;
  setEndMonth: (v: string) => void;
  toDisplayMonth: (v: string) => string;
  toIsoMonth: (v: string) => string;
  startMonthInputRef: RefObject<HTMLInputElement>;
  endMonthInputRef: RefObject<HTMLInputElement>;
  onThisMonth: () => void;
  onReset: () => void;
  chartRef?: RefObject<HTMLElement | null>;
}

export default function MonthlyViolationAIChartFilter({
  sourceType,
  setSourceType,
  startMonth,
  setStartMonth,
  endMonth,
  setEndMonth,
  toDisplayMonth,
  toIsoMonth,
  startMonthInputRef,
  endMonthInputRef,
  onThisMonth,
  onReset,
  chartRef,
}: MonthlyViolationAIChartFilterProps) {
  const isInReportMode = useReportMode(chartRef);
  const { violationGroups, loading, selectedGroups, setSelectedGroups } =
    useViolationGroups();
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedGroups.length > 0 &&
        selectedGroups.length < violationGroups.length;
    }
  }, [selectedGroups, violationGroups]);

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
                "aiMonthlyViolationSourceType",
                e.target.value
              );
            }
          }}
          className="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
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
          เดือนเริ่มต้น
        </label>
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="mm/yyyy"
            value={toDisplayMonth(startMonth)}
            onChange={(e) => setStartMonth(toIsoMonth(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none w-full pr-8"
            maxLength={7}
          />
          <button
            type="button"
            className="absolute right-2 text-gray-400 hover:text-blue-600"
            tabIndex={-1}
            onClick={() =>
              startMonthInputRef.current?.showPicker &&
              startMonthInputRef.current.showPicker()
            }
          >
            <FaRegCalendarAlt />
          </button>
          <input
            ref={startMonthInputRef}
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            tabIndex={-1}
          />
        </div>
      </div>
      <div className="flex flex-col min-w-[160px]">
        <label className="text-xs font-semibold text-gray-700 mb-1">
          เดือนสิ้นสุด
        </label>
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="mm/yyyy"
            value={toDisplayMonth(endMonth)}
            onChange={(e) => setEndMonth(toIsoMonth(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none w-full pr-8"
            maxLength={7}
          />
          <button
            type="button"
            className="absolute right-2 text-gray-400 hover:text-blue-600"
            tabIndex={-1}
            onClick={() =>
              endMonthInputRef.current?.showPicker &&
              endMonthInputRef.current.showPicker()
            }
          >
            <FaRegCalendarAlt />
          </button>
          <input
            ref={endMonthInputRef}
            type="month"
            value={endMonth}
            min={startMonth || undefined}
            onChange={(e) => setEndMonth(e.target.value)}
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            tabIndex={-1}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1 min-w-[100px]">
        <button
          onClick={onThisMonth}
          className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-semibold hover:bg-blue-200 transition"
          title="เลือกเดือนนี้"
        >
          เดือนนี้
        </button>
        <button
          onClick={onReset}
          className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition"
        >
          รีเซ็ต
        </button>
      </div>
      <ViolationGroupCheckbox
        violationGroups={violationGroups}
        loading={loading}
        selectedGroups={selectedGroups}
        setSelectedGroups={setSelectedGroups}
      />
    </div>
  );
}
