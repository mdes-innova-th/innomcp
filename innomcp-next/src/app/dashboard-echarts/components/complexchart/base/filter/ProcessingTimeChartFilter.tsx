import { FaRegCalendarAlt } from "react-icons/fa";
import { RefObject, useEffect, useRef } from "react";
import { useReportMode } from "@/app/dashboard-echarts/hooks/useReportMode";
import { useViolationGroups } from "./ViolationGroupContext";
import { ViolationGroupCheckbox } from "./ViolationGroupCheckbox";

interface ProcessingTimeChartFilterProps {
  groupByValue: string;
  setGroupByValue: (v: string) => void;
  displayMetric: string;
  setDisplayMetric: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  toDisplayDate: (v: string) => string;
  toIsoDate: (v: string) => string;
  startDateInputRef: RefObject<HTMLInputElement>;
  endDateInputRef: RefObject<HTMLInputElement>;
  onToday: () => void;
  onReset: () => void;
  chartRef?: RefObject<HTMLElement | null>;
}

export default function ProcessingTimeChartFilter({
  groupByValue,
  setGroupByValue,
  displayMetric,
  setDisplayMetric,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  toDisplayDate,
  toIsoDate,
  startDateInputRef,
  endDateInputRef,
  onToday,
  onReset,
  chartRef,
}: ProcessingTimeChartFilterProps) {
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
          จัดกลุ่มตาม
        </label>
        <select
          value={groupByValue}
          onChange={(e) => {
            setGroupByValue(e.target.value);
            if (typeof window !== "undefined") {
              localStorage.setItem("processingTimeGroupBy", e.target.value);
            }
          }}
          className="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
        >
          <option value="" disabled hidden>
            เลือกแหล่งข้อมูล
          </option>
          <option value="url">ยังไม่มีคำร้อง</option>
          <option value="petition">มีคำร้อง</option>
          <option value="court">มีคำร้อง-คำสั่งศาล</option>
        </select>
      </div>
      <div className="flex flex-col min-w-[180px]">
        <label className="text-xs font-semibold text-gray-700 mb-1">
          ช่วงดำเนินการ
        </label>
        <select
          value={displayMetric}
          onChange={(e) => {
            setDisplayMetric(e.target.value);
            if (typeof window !== "undefined") {
              localStorage.setItem("processingTimeMetric", e.target.value);
            }
          }}
          className="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white"
        >
          <option value="" disabled hidden>
            เลือกช่วงดำเนินการ
          </option>
          <option value="url_to_inspect1">บันทึก URL-ฝ่ายต้นทางตรวจสอบ</option>
          <option value="inspect1_to_inspect2">
            ฝ่ายต้นทางตรวจสอบ-ฝ่ายกฎหมายตรวจสอบ
          </option>
          {(groupByValue === "petition" || groupByValue === "court") && (
            <option value="inspect2_to_petition">
              ฝ่ายกฎหมายตรวจสอบ-วันที่มีคำร้อง
            </option>
          )}
          {groupByValue === "court" && (
            <option value="petition_to_court">
              วันที่มีคำร้อง-วันที่มีคำสั่งศาล
            </option>
          )}
          {groupByValue === "court" && (
            <option value="url_to_court">
              ทั้งหมด บันทึก URL-วันที่มีคำสั่งศาล
            </option>
          )}
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
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none w-full pr-8"
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
            className="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none w-full pr-8"
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
