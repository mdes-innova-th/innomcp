"use client";

import { useRef, useState, useEffect } from "react";
import { FaTimes, FaFilePdf, FaFileWord } from "react-icons/fa";
import {
  generateChartReport,
  generateChartReportPDF,
} from "@/app/dashboard-echarts/components/complexchart/base/lib/reportGenerator";
import LoadingSpinner from "@/app/components/common/ui/loading-spinner";
import Image from "next/image";

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartRef: React.RefObject<HTMLDivElement>;
  title: string;
  subtitle?: string;
  tableHeaders: string[];
  tableRows: string[][];
  filename: string;
  valueSuffix?: string;
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
  // per-column alignment hints (optional)
  columnAlignments?: ("left" | "center" | "right")[];
}

export default function ReportPreviewModal({
  isOpen,
  onClose,
  chartRef,
  title,
  subtitle,
  tableHeaders,
  tableRows,
  filename,
  valueSuffix,
  dateRange,
  columnAlignments,
}: ReportPreviewModalProps) {
  const [isGeneratingWord, setIsGeneratingWord] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  // Track when modal was opened to ignore the immediate click that triggered opening
  const openedAtRef = useRef<number | null>(null);

  useEffect(() => {
    // Generate preview image when modal opens
    if (isOpen && chartRef.current) {
      // Debug log chartRef
      console.log("[ReportPreviewModal] chartRef.current:", chartRef.current);
      // Set a data attribute to indicate this is for a report
      chartRef.current.setAttribute("data-for-report", "true");

      // Add chart type attribute if available from the container
      const chartContainer =
        chartRef.current.querySelector("[data-chart-type]");
      if (chartContainer) {
        const chartType = chartContainer.getAttribute("data-chart-type");
        chartRef.current.setAttribute("data-chart-type", chartType || "bar");
      }

      // Wait a bit for the chart to update before capturing
      setTimeout(() => {
        import("html-to-image")
          .then((htmlToImage) => {
            // Use toPng for better quality in reports
            return htmlToImage.toPng(chartRef.current!, {
              backgroundColor: "#ffffff",
              // Increase pixelRatio so the preview image has larger, clearer text
              pixelRatio: 3,
              width: chartRef.current!.scrollWidth,
              height: chartRef.current!.scrollHeight,
            });
          })
          .then((dataUrl) => {
            setPreviewImage(dataUrl);
            // Reset the data attributes
            if (chartRef.current) {
              chartRef.current.removeAttribute("data-for-report");
              chartRef.current.removeAttribute("data-chart-type");
            }
          })
          .catch((error) => {
            console.error("Error generating preview image:", error);
            // Reset the data attributes
            if (chartRef.current) {
              chartRef.current.removeAttribute("data-for-report");
              chartRef.current.removeAttribute("data-chart-type");
            }
          });
      }, 500); // เพิ่ม delay เป็น 500ms เพื่อให้ chart render เสร็จจริง
    } else {
      setPreviewImage(null);
    }
  }, [isOpen, chartRef]);

  // Close modal when clicking outside
  useEffect(() => {
    // Use pointerdown for broader input support. Ignore clicks that occur
    // within a short window after opening the modal to avoid treating the
    // opening click as an outside click.
    const handlePointerDown = (event: PointerEvent) => {
      // If modal not mounted or click inside modal, ignore
      if (
        !modalRef.current ||
        modalRef.current.contains(event.target as Node)
      ) {
        return;
      }

      // If modal was just opened (< 300ms), ignore this event as it may be
      // the original click that triggered opening.
      const openedAt = openedAtRef.current;
      if (openedAt && Date.now() - openedAt < 300) {
        return;
      }

      onClose();
    };

    if (isOpen) {
      // Mark the time modal opened
      openedAtRef.current = Date.now();
      document.addEventListener("pointerdown", handlePointerDown);
    }

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      openedAtRef.current = null;
    };
  }, [isOpen, onClose]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscKey);
    } else {
      document.removeEventListener("keydown", handleEscKey);
    }

    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isOpen, onClose]);

  // For chart types that need to fetch the actual data from the chart
  useEffect(() => {
    if (isOpen && tableRows.length === 0 && chartRef.current) {
      // This effect is a placeholder for future enhancements
      // In a real implementation, we would extract data from the chart
      // For now, we'll just log a warning
      console.warn(
        "No table data provided for report. Consider passing data directly to the modal."
      );
    }
  }, [isOpen, tableRows.length, chartRef]);

  if (!isOpen) return null;

  const handleDownload = async (format: "docx" | "pdf" = "docx") => {
    if (
      (format === "pdf" && isGeneratingPDF) ||
      (format === "docx" && isGeneratingWord)
    ) {
      return;
    }
    if (format === "pdf") {
      setIsGeneratingPDF(true);
    } else {
      setIsGeneratingWord(true);
    }
    try {
      const reportOptions = {
        title,
        subtitle,
        tableHeaders,
        tableRows,
        chartRef,
        filename: `${filename}.${format}`,
        valueSuffix,
        dateRange,
        columnAlignments,
      };

      if (format === "pdf") {
        await generateChartReportPDF(reportOptions);
      } else {
        await generateChartReport(reportOptions);
      }
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      if (format === "pdf") {
        setIsGeneratingPDF(false);
      } else {
        setIsGeneratingWord(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-white p-10 w-full max-w-[85vw] my-4 max-h-[90vh] overflow-y-auto border border-gray-300 shadow-none rounded-[10px] [font-family:'TH Sarabun New',Arial,sans-serif] text-gray-800"
      >
        {/* Preview Content (A4 style) */}
        <div className="flex flex-col items-center px-10 py-8 min-h-[1123px] min-w-[1024px] bg-white">
          <h3 className="text-[22px] font-bold text-center mb-2 report-thai-title [font-family:'TH Sarabun New',Arial,sans-serif]">
            {title}
          </h3>
          {subtitle && (
            <p className="text-center text-gray-800 text-[18px] mb-2 report-thai-subtitle [font-family:'TH Sarabun New',Arial,sans-serif]">
              {subtitle}
            </p>
          )}
          {dateRange?.startDate && dateRange?.endDate && (
            <p className="text-center text-gray-800 text-[18px] mb-4 bg-blue-50 py-1 rounded report-thai-subtitle [font-family:'TH Sarabun New',Arial,sans-serif]">
              {dateRange.startDate === dateRange.endDate
                ? `วันที่ ${new Date(dateRange.startDate).toLocaleDateString(
                    "th-TH"
                  )}`
                : `วันที่ ${new Date(dateRange.startDate).toLocaleDateString(
                    "th-TH"
                  )} ถึง ${new Date(dateRange.endDate).toLocaleDateString(
                    "th-TH"
                  )}`}
            </p>
          )}

          {/* Table Preview */}
          <div className="w-full mb-6 overflow-x-auto flex justify-center">
            <table className="border border-gray-400 mb-3 text-[18px] report-thai table-auto w-auto max-w-full text-black [font-family:'TH Sarabun New',Arial,sans-serif] min-w-0 w-auto leading-[1.6]">
              <thead>
                <tr className="bg-gray-100">
                  {tableHeaders.map((header, index) => {
                    const align = columnAlignments?.[index] ?? "left";
                    const thClass =
                      align === "center"
                        ? "text-center"
                        : align === "right"
                        ? "text-right"
                        : "text-left";
                    return (
                      <th
                        key={index}
                        className={`border border-gray-400 px-3 py-2 ${thClass} font-bold text-[18px] whitespace-nowrap`}
                      >
                        {header}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    {row.map((cell, cellIndex) => {
                      let displayValue = cell;
                      const isNumber = !isNaN(Number(cell)) && cell !== "";
                      if (isNumber) {
                        displayValue = Number(cell).toLocaleString("en-US");
                        if (valueSuffix && cellIndex > 0)
                          displayValue += ` ${valueSuffix}`;
                      } else if (cellIndex > 0 && valueSuffix) {
                        displayValue = `${cell} ${valueSuffix}`;
                      }

                      const align = columnAlignments?.[cellIndex]
                        ? columnAlignments[cellIndex]
                        : isNumber && cellIndex > 0
                        ? "right"
                        : "left";
                      const tdClass =
                        align === "center"
                          ? "text-center"
                          : align === "right"
                          ? "text-right"
                          : "text-left";

                      return (
                        <td
                          key={cellIndex}
                          className={`border border-gray-400 px-1 py-1 text-[24px] align-middle ${tdClass}`}
                        >
                          {displayValue}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Preview Image */}
          {previewImage && (
            <div className="w-full mb-6 flex justify-center">
              <Image
                src={previewImage}
                alt="Chart Preview"
                className="max-w-full h-auto"
                width={1024}
                height={768}
                priority
              />
            </div>
          )}

          {/* Download Buttons & Close (outside preview area) */}
          <div className="flex justify-center mt-2 mb-4 gap-3">
            <button
              onClick={() => {
                if (!isGeneratingWord) handleDownload("docx");
              }}
              disabled={isGeneratingWord}
              className={`flex items-center justify-center gap-1.5 px-1 py-1 rounded-lg text-lg transition-colors ${
                isGeneratingWord
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              }`}
            >
              {isGeneratingWord ? (
                <>
                  <LoadingSpinner color="white" size="sm" />
                  <span className="report-thai">กำลังสร้างรายงาน...</span>
                </>
              ) : (
                <>
                  <FaFileWord size={20} />
                  <span className="report-thai">Word</span>
                </>
              )}
            </button>
            <button
              onClick={() => {
                if (!isGeneratingPDF) handleDownload("pdf");
              }}
              disabled={isGeneratingPDF}
              className={`flex items-center justify-center gap-1.5 px-1 py-1 rounded-lg text-lg transition-colors ${
                isGeneratingPDF
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              }`}
            >
              {isGeneratingPDF ? (
                <>
                  <LoadingSpinner color="white" size="sm" />
                  <span className="report-thai">กำลังสร้างรายงาน...</span>
                </>
              ) : (
                <>
                  <FaFilePdf size={20} />
                  <span className="report-thai">PDF</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-4 text-gray-400 hover:text-gray-600 text-2xl font-bold transition-colors duration-200 cursor-pointer"
              aria-label="Close"
            >
              <FaTimes size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
