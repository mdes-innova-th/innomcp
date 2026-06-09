"use client";

import React, { useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KPI = {
  label: string;
  value: string | number;
  unit?: string;
};

type TableData = {
  headers: string[];
  rows: string[][];
};

type ColumnStats = {
  column: string;
  type: "numeric" | "string";
  min?: number;
  max?: number;
  mean?: number;
  unique?: number;
};

type DataPayload = {
  summary?: string;
  stats?: ColumnStats[] | Record<string, any>;
  kpis?: KPI[] | Record<string, any>;
  table?: TableData;
};

type Props = {
  data: DataPayload;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_DISPLAY_ROWS = 50;

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeStr(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** Normalise kpis to an array of { label, value, unit? } */
function normaliseKpis(raw: KPI[] | Record<string, any> | undefined): KPI[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  // Record<string, string|number>
  return Object.entries(raw).map(([label, value]) => ({ label, value: safeStr(value) }));
}

/** Normalise stats — may come in as an array or a per-column object map */
function normaliseStats(raw: ColumnStats[] | Record<string, any> | undefined): ColumnStats[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.entries(raw).map(([column, v]) => {
    if (typeof v === "object" && v !== null) {
      return {
        column,
        type: (v.type ?? (v.min !== undefined ? "numeric" : "string")) as "numeric" | "string",
        min: v.min !== undefined ? safeNum(v.min) : undefined,
        max: v.max !== undefined ? safeNum(v.max) : undefined,
        mean: v.mean !== undefined ? safeNum(v.mean) : undefined,
        unique: v.unique !== undefined ? safeNum(v.unique) : undefined,
      };
    }
    return { column, type: "string" as const, unique: 1 };
  });
}

/** Derive per-column stats from table rows when no pre-computed stats exist */
function deriveStats(table: TableData): ColumnStats[] {
  return table.headers.map((header, colIdx) => {
    const vals = table.rows.map((r) => r[colIdx]);
    const nums = vals.map(Number).filter((n) => Number.isFinite(n));
    if (nums.length > 0 && nums.length === vals.filter((v) => v !== "" && v !== null && v !== undefined).length) {
      const sum = nums.reduce((a, b) => a + b, 0);
      return {
        column: header,
        type: "numeric",
        min: Math.min(...nums),
        max: Math.max(...nums),
        mean: Math.round((sum / nums.length) * 100) / 100,
      };
    }
    const unique = new Set(vals.map(safeStr)).size;
    return { column: header, type: "string", unique };
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({ rowCount, colCount }: { rowCount: number; colCount: number }) {
  return (
    <div
      data-testid="chart-renderer-summary"
      className="mb-3 flex flex-wrap gap-3"
    >
      <div className="rounded-md border border-blue-500/20 bg-white/70 px-3 py-2 dark:border-blue-400/20 dark:bg-gray-900/30">
        <div className="text-xs text-gray-600 dark:text-gray-300">แถว (Rows)</div>
        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{rowCount.toLocaleString()}</div>
      </div>
      <div className="rounded-md border border-blue-500/20 bg-white/70 px-3 py-2 dark:border-blue-400/20 dark:bg-gray-900/30">
        <div className="text-xs text-gray-600 dark:text-gray-300">คอลัมน์ (Columns)</div>
        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{colCount.toLocaleString()}</div>
      </div>
    </div>
  );
}

function KpiCards({ kpis }: { kpis: KPI[] }) {
  if (kpis.length === 0) return null;
  return (
    <div
      data-testid="chart-renderer-kpis"
      className={`mb-3 grid grid-cols-2 gap-2 sm:grid-cols-${Math.min(kpis.length, 4)}`}
    >
      {kpis.map((kpi, idx) => (
        <div
          key={`${kpi.label}-${idx}`}
          className="rounded-md border border-blue-500/20 bg-white/70 px-3 py-2 dark:border-blue-400/20 dark:bg-gray-900/30"
        >
          <div className="truncate text-xs text-gray-600 dark:text-gray-300">{kpi.label}</div>
          <div className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
            {safeStr(kpi.value)}
            {kpi.unit && (
              <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">{kpi.unit}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsBadges({ stats }: { stats: ColumnStats[] }) {
  if (stats.length === 0) return null;
  return (
    <div data-testid="chart-renderer-stats" className="mb-3">
      <div className="mb-1 text-xs text-gray-600 dark:text-gray-300">สถิติแต่ละคอลัมน์</div>
      <div className="flex flex-wrap gap-1.5">
        {stats.map((s, idx) => (
          <div
            key={`${s.column}-${idx}`}
            className="flex flex-wrap items-center gap-1 rounded-md border border-gray-300/50 bg-white/60 px-2 py-1 dark:border-gray-600/40 dark:bg-gray-800/40"
          >
            <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-100">{s.column}</span>
            {s.type === "numeric" ? (
              <>
                {s.min !== undefined && (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                    min {s.min}
                  </span>
                )}
                {s.max !== undefined && (
                  <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">
                    max {s.max}
                  </span>
                )}
                {s.mean !== undefined && (
                  <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                    avg {s.mean}
                  </span>
                )}
              </>
            ) : (
              s.unique !== undefined && (
                <span className="rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] text-teal-800 dark:bg-teal-900/40 dark:text-teal-200">
                  {s.unique} unique
                </span>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type SortDir = "asc" | "desc";

function SortableTable({ table }: { table: TableData }) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const displayRows = useMemo(() => {
    const rows = table.rows.slice(0, MAX_DISPLAY_ROWS);
    if (sortCol === null) return rows;
    return [...rows].sort((a, b) => {
      const va = a[sortCol] ?? "";
      const vb = b[sortCol] ?? "";
      const na = Number(va);
      const nb = Number(vb);
      if (Number.isFinite(na) && Number.isFinite(nb)) {
        return sortDir === "asc" ? na - nb : nb - na;
      }
      const cmp = safeStr(va).localeCompare(safeStr(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [table.rows, sortCol, sortDir]);

  const toggleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colIdx);
      setSortDir("asc");
    }
  };

  const totalRows = table.rows.length;
  const shown = Math.min(totalRows, MAX_DISPLAY_ROWS);
  const isTruncated = totalRows > MAX_DISPLAY_ROWS;

  return (
    <div data-testid="chart-renderer-table" className="mb-3">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
        <span>ตาราง</span>
        {isTruncated && (
          <span className="rounded-full border border-amber-400/40 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800 dark:border-amber-400/30 dark:bg-amber-900/20 dark:text-amber-200">
            แสดง {shown.toLocaleString()} จาก {totalRows.toLocaleString()} แถว
          </span>
        )}
      </div>
      <div className="overflow-x-auto rounded-md border border-blue-500/20 bg-white/70 dark:border-blue-400/20 dark:bg-gray-900/30">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-blue-500/15 dark:border-blue-400/15">
              {table.headers.map((h, colIdx) => (
                <th
                  key={`${h}-${colIdx}`}
                  onClick={() => toggleSort(colIdx)}
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left font-semibold text-gray-700 hover:text-blue-700 dark:text-gray-200 dark:hover:text-blue-300"
                >
                  {h}
                  {sortCol === colIdx && (
                    <span className="ml-1 text-blue-600 dark:text-blue-400">
                      {sortDir === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={
                  rowIdx % 2 === 0
                    ? "bg-white/50 dark:bg-transparent"
                    : "bg-blue-50/40 dark:bg-blue-900/5"
                }
              >
                {table.headers.map((_, colIdx) => (
                  <td
                    key={colIdx}
                    className="max-w-[16rem] truncate px-3 py-1.5 text-gray-800 dark:text-gray-200"
                    title={safeStr(row[colIdx])}
                  >
                    {safeStr(row[colIdx])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChartRenderer({ data }: Props) {
  if (!data || typeof data !== "object") return null;

  const { summary, stats: rawStats, kpis: rawKpis, table } = data;

  const kpis = normaliseKpis(rawKpis);
  const hasTable = !!(table && Array.isArray(table.headers) && Array.isArray(table.rows));

  // Resolve stats: prefer pre-computed, derive from table when absent
  const statsNorm = normaliseStats(rawStats);
  const stats: ColumnStats[] =
    statsNorm.length > 0
      ? statsNorm
      : hasTable
        ? deriveStats(table!)
        : [];

  const rowCount = hasTable ? table!.rows.length : 0;
  const colCount = hasTable ? table!.headers.length : stats.length;

  // Nothing to render
  if (!summary && kpis.length === 0 && !hasTable && stats.length === 0) return null;

  return (
    <div
      data-testid="chart-renderer"
      className="mb-3 rounded-lg border border-blue-500/30 bg-blue-50/40 p-3 dark:border-blue-400/30 dark:bg-blue-900/10"
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-blue-800 dark:text-blue-200">วิเคราะห์ข้อมูล</div>
        <span className="rounded-full border border-blue-500/30 bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-800 dark:border-blue-400/30 dark:bg-gray-900/30 dark:text-blue-200">
          DATA
        </span>
      </div>

      {/* Summary text */}
      {summary && (
        <p className="mb-3 text-sm text-gray-700 dark:text-gray-200">{summary}</p>
      )}

      {/* Summary card: rows + columns */}
      {(hasTable || colCount > 0) && (
        <SummaryCard rowCount={rowCount} colCount={colCount} />
      )}

      {/* KPI cards */}
      {kpis.length > 0 && <KpiCards kpis={kpis} />}

      {/* Per-column stats */}
      {stats.length > 0 && <StatsBadges stats={stats} />}

      {/* Sortable table */}
      {hasTable && <SortableTable table={table!} />}
    </div>
  );
}
