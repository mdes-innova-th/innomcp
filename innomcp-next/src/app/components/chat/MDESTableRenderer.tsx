"use client";

import React, { useState, useMemo, useCallback } from "react";

export interface MDESTableRendererProps {
  markdown: string; // raw markdown table string
  caption?: string;
  maxRows?: number; // show N rows + "ดูเพิ่มเติม N แถว"
  sortable?: boolean; // enable column sorting
  downloadable?: boolean; // add "ดาวน์โหลด CSV" button
  compact?: boolean; // optional: force compact mode
}

interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

function parseMarkdownTable(markdown: string): {
  headers: string[];
  alignments: ("left" | "center" | "right")[];
  rows: string[][];
} {
  const lines = markdown.split("\n").filter((l) => l.trim().startsWith("|"));
  if (lines.length < 2) return { headers: [], alignments: [], rows: [] };

  // Parse header row
  const headerLine = lines[0].trim();
  const headers = splitCells(headerLine);
  if (headers.length === 0) return { headers: [], alignments: [], rows: [] };

  // Parse separator row
  const separatorLine = lines[1].trim();
  const separatorCells = splitCells(separatorLine);
  if (separatorCells.length !== headers.length) {
    return { headers, alignments: headers.map(() => "left"), rows: [] };
  }

  // Determine alignments
  const alignments = separatorCells.map((cell) => {
    const trimmed = cell.trim();
    if (/^:---/.test(trimmed) && /---:$/.test(trimmed)) return "center";
    if (/^:---/.test(trimmed)) return "left";
    if (/---:$/.test(trimmed)) return "right";
    return "left"; // default
  });

  // Parse data rows (skip header and separator)
  const rows = lines.slice(2).map((line) => {
    const cells = splitCells(line.trim());
    // Pad or truncate to match header count
    while (cells.length < headers.length) cells.push("");
    return cells.slice(0, headers.length);
  });

  return { headers, alignments, rows };
}

function splitCells(line: string): string[] {
  let cells = line.split("|");
  // Trim each cell
  cells = cells.map((c) => c.trim());
  // Remove leading empty cell if line starts with |
  if (cells.length > 0 && cells[0] === "") cells.shift();
  // Remove trailing empty cell if line ends with |
  if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
  return cells;
}

function escapeCSV(str: string): string {
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    // Escape double quotes by doubling them
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function generateCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCSV).join(",");
  const dataLines = rows.map((row) => row.map(escapeCSV).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export default function MDESTableRenderer({
  markdown,
  caption,
  maxRows,
  sortable = false,
  downloadable = false,
  compact: compactProp,
}: MDESTableRendererProps & { compact?: boolean }) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [showAllRows, setShowAllRows] = useState(false);

  const parsed = useMemo(() => parseMarkdownTable(markdown), [markdown]);

  const { headers, alignments, rows: allRows } = parsed;

  // Determine compact mode: prop or auto-detect (<=5x5)
  const isCompact =
    compactProp ?? (headers.length <= 5 && allRows.length <= 5);

  // Apply maxRows logic
  const visibleRows = useMemo(() => {
    if (maxRows != null && !showAllRows && allRows.length > maxRows) {
      return allRows.slice(0, maxRows);
    }
    return allRows;
  }, [allRows, maxRows, showAllRows]);

  const hasMoreRows =
    maxRows != null && allRows.length > maxRows && !showAllRows;
  const hiddenCount = hasMoreRows ? allRows.length - maxRows : 0;

  // Sorting logic
  const sortedRows = useMemo(() => {
    if (!sortable || !sortConfig) return visibleRows;
    const colIndex = headers.indexOf(sortConfig.key);
    if (colIndex === -1) return visibleRows;

    return [...visibleRows].sort((a, b) => {
      const valA = a[colIndex] ?? "";
      const valB = b[colIndex] ?? "";

      // Try numeric comparison first
      const numA = parseFloat(valA);
      const numB = parseFloat(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortConfig.direction === "asc" ? numA - numB : numB - numA;
      }

      // String comparison (Thai-aware)
      const cmp = valA.localeCompare(valB, "th", { sensitivity: "base" });
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
  }, [visibleRows, sortConfig, sortable, headers]);

  const handleSort = useCallback(
    (header: string) => {
      if (!sortable) return;
      setSortConfig((prev) => {
        if (prev?.key === header) {
          if (prev.direction === "asc") return { key: header, direction: "desc" };
          return null; // remove sort
        }
        return { key: header, direction: "asc" };
      });
    },
    [sortable],
  );

  const handleDownloadCSV = useCallback(() => {
    if (headers.length === 0) return;
    const csvContent = generateCSV(headers, allRows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "table.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, [headers, allRows]);

  // If parsing fails, show error
  if (headers.length === 0) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        ไม่สามารถแสดงตารางได้ (รูปแบบไม่ถูกต้อง)
      </div>
    );
  }

  const rowCount = allRows.length;

  return (
    <div className="my-4">
      {/* Caption & Controls Row */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {caption && (
            <span className="text-base font-semibold text-gray-800">
              {caption}
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
            {rowCount} แถว
          </span>
        </div>
        {downloadable && (
          <button
            type="button"
            onClick={handleDownloadCSV}
            className="inline-flex items-center gap-1 rounded bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-none"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            ดาวน์โหลด CSV
          </button>
        )}
      </div>

      {/* Responsive scroll container */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {headers.map((header, idx) => (
                <th
                  key={`${header}-${idx}`}
                  scope="col"
                  className={`whitespace-nowrap text-left font-medium text-gray-600 ${
                    isCompact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"
                  } ${sortable ? "cursor-pointer select-none hover:bg-gray-100" : ""}`}
                  onClick={() => handleSort(header)}
                  title={sortable ? "คลิกเพื่อเรียงลำดับ" : undefined}
                >
                  <div className="flex items-center gap-1">
                    <span>{header}</span>
                    {sortable && sortConfig?.key === header && (
                      <span className="text-indigo-500">
                        {sortConfig.direction === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {sortedRows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className={`break-words text-gray-700 ${
                      isCompact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"
                    } ${
                      alignments[cellIdx] === "center"
                        ? "text-center"
                        : alignments[cellIdx] === "right"
                          ? "text-right"
                          : "text-left"
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td
                  colSpan={headers.length}
                  className={`text-center text-gray-400 italic ${
                    isCompact ? "px-2 py-4 text-xs" : "px-3 py-6 text-sm"
                  }`}
                >
                  ไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Show more rows button */}
      {hasMoreRows && (
        <div className="mt-2 text-center">
          <button
            type="button"
            onClick={() => setShowAllRows(true)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            ดูเพิ่มเติม {hiddenCount} แถว
          </button>
        </div>
      )}
    </div>
  );
}