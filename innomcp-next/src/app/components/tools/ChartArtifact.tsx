"use client";
import React from "react";

interface ColumnStats {
  name: string;
  type: string;
  count: number;
  nullCount: number;
  min?: number;
  max?: number;
  mean?: number;
  topValues?: Array<{ value: string; count: number }>;
}

interface ChartArtifactProps {
  chartSvg?: string;
  summary: string;
  rowCount: number;
  colCount: number;
  columns: ColumnStats[];
}

function fmt(n?: number): string {
  if (n === undefined || n === null) return "-";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export default function ChartArtifact({
  chartSvg,
  summary,
  rowCount,
  colCount,
  columns,
}: ChartArtifactProps) {
  return (
    <div className="border border-border/40 rounded-xl overflow-hidden text-[12px]">
      {/* Stats bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/30">
        <span className="text-muted-foreground font-medium">Data Summary</span>
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          {rowCount} rows
        </span>
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          {colCount} columns
        </span>
      </div>

      {/* SVG chart */}
      {chartSvg ? (
        <div
          className="overflow-x-auto rounded-none bg-white dark:bg-[#1a1a1a] p-3"
          dangerouslySetInnerHTML={{ __html: chartSvg }}
        />
      ) : (
        <div className="flex items-center justify-center p-6 text-muted-foreground text-[12px]">
          No chart available
        </div>
      )}

      {/* Summary text */}
      {summary && (
        <div className="px-3 py-2 border-t border-border/30 bg-background/40">
          <p className="text-[12px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {summary}
          </p>
        </div>
      )}

      {/* Collapsible column details */}
      {columns.length > 0 && (
        <details className="border-t border-border/30">
          <summary className="cursor-pointer select-none px-3 py-2 text-[11.5px] font-medium text-muted-foreground hover:text-foreground transition-colors bg-muted/20 hover:bg-muted/40">
            Column Details ({columns.length})
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-muted/30 text-muted-foreground">
                  <th className="text-left px-3 py-1.5 font-medium border-b border-border/30">Name</th>
                  <th className="text-left px-3 py-1.5 font-medium border-b border-border/30">Type</th>
                  <th className="text-right px-3 py-1.5 font-medium border-b border-border/30">Count</th>
                  <th className="text-right px-3 py-1.5 font-medium border-b border-border/30">Nulls</th>
                  <th className="text-right px-3 py-1.5 font-medium border-b border-border/30">Min</th>
                  <th className="text-right px-3 py-1.5 font-medium border-b border-border/30">Max</th>
                  <th className="text-right px-3 py-1.5 font-medium border-b border-border/30">Mean</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col, idx) => (
                  <tr
                    key={col.name}
                    className={idx % 2 === 0 ? "bg-background/20" : "bg-muted/10"}
                  >
                    <td className="px-3 py-1.5 font-mono text-foreground/90 truncate max-w-[140px]">
                      {col.name}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{col.type}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{col.count}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {col.nullCount > 0 ? (
                        <span className="text-orange-500 dark:text-orange-400">{col.nullCount}</span>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(col.min)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(col.max)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(col.mean)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
