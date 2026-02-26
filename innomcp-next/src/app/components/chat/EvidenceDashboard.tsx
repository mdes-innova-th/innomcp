"use client";

import React from "react";

type EvidencePoint = { date: string; count: number };

type Props = {
  structuredContent?: any;
};

function isEvidenceStructured(sc: any): boolean {
  if (!sc || typeof sc !== "object" || Array.isArray(sc)) return false;
  const route = String(sc?.__render?.route || "");
  if (route === "evidence") return true;
  // Fallback heuristic: evidence payloads always have kpis/table/series.
  return !!(sc.kpis || sc.table || sc.series);
}

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeStr(v: any): string {
  return typeof v === "string" ? v : "";
}

function buildSparkline(points: EvidencePoint[], width: number, height: number): string {
  if (!points.length) return "";

  const values = points.map((p) => safeNum(p.count));
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = Math.max(1, maxV - minV);

  const pad = 6;
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);

  return points
    .map((p, idx) => {
      const x = pad + (innerW * idx) / Math.max(1, points.length - 1);
      const y = pad + innerH - (innerH * (safeNum(p.count) - minV)) / range;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function EvidenceDashboard({ structuredContent }: Props) {
  const sc = structuredContent;
  if (!isEvidenceStructured(sc)) return null;

  const kpis = sc && typeof sc === "object" ? sc.kpis ?? {} : {};
  const total = safeNum(kpis?.total);
  const topIspNameRaw = kpis?.topIspName;
  const topIspName = topIspNameRaw === null ? "" : safeStr(topIspNameRaw);
  const topIspCount = kpis?.topIspCount === null ? null : Number.isFinite(Number(kpis?.topIspCount)) ? Number(kpis?.topIspCount) : null;

  const rowsRaw = sc && typeof sc === "object" ? sc?.table?.rows : null;
  const rows: Array<{ isp: string; count: number }> = Array.isArray(rowsRaw)
    ? rowsRaw
        .map((r: any) => ({ isp: safeStr(r?.isp), count: safeNum(r?.count ?? r?.c) }))
        .filter((r) => r.isp.length > 0)
    : [];

  const pointsRaw = sc && typeof sc === "object" ? sc?.series?.points : null;
  const points: EvidencePoint[] = Array.isArray(pointsRaw)
    ? pointsRaw
        .map((p: any) => ({ date: safeStr(p?.date).slice(0, 10), count: safeNum(p?.count ?? p?.c) }))
        .filter((p) => p.date.length > 0)
    : [];

  const sparkW = 360;
  const sparkH = 120;
  const poly = buildSparkline(points.slice(0, 7), sparkW, sparkH);

  return (
    <div
      data-testid="evidence-dashboard"
      className="mb-3 rounded-lg border border-green-500/30 bg-green-50/40 p-3 dark:border-green-400/30 dark:bg-green-900/10"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-green-800 dark:text-green-200">แดชบอร์ดหลักฐาน</div>
        <div className="text-xs text-green-800/70 dark:text-green-200/70">StructuredContent-only</div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div
          data-testid="evidence-kpi-total"
          className="rounded-md border border-green-500/20 bg-white/70 px-3 py-2 dark:border-green-400/20 dark:bg-gray-900/30"
        >
          <div className="text-xs text-gray-600 dark:text-gray-300">รวมทั้งหมด</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{total}</div>
        </div>
        <div
          data-testid="evidence-kpi-topisp"
          className="rounded-md border border-green-500/20 bg-white/70 px-3 py-2 dark:border-green-400/20 dark:bg-gray-900/30"
        >
          <div className="text-xs text-gray-600 dark:text-gray-300">ISP มากสุด</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{topIspName || "(ไม่มีข้อมูล)"}</div>
        </div>
        <div
          data-testid="evidence-kpi-topcount"
          className="rounded-md border border-green-500/20 bg-white/70 px-3 py-2 dark:border-green-400/20 dark:bg-gray-900/30"
        >
          <div className="text-xs text-gray-600 dark:text-gray-300">จำนวน (ISP มากสุด)</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{topIspCount ?? 0}</div>
        </div>
      </div>

      {points.length > 0 && poly && (
        <div className="mt-3" data-testid="evidence-line-chart">
          <div className="mb-1 text-xs text-gray-600 dark:text-gray-300">แนวโน้ม 7 วันล่าสุด</div>
          <div className="overflow-hidden rounded-md border border-green-500/20 bg-white/70 dark:border-green-400/20 dark:bg-gray-900/30">
            <svg viewBox={`0 0 ${sparkW} ${sparkH}`} className="h-[120px] w-full" role="img" aria-label="Evidence 7-day trend">
              <polyline fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600 dark:text-green-400" points={poly} />
            </svg>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-3" data-testid="evidence-table">
          <div className="mb-1 text-xs text-gray-600 dark:text-gray-300">แยกตาม ISP</div>
          <div className="overflow-hidden rounded-md border border-green-500/20 dark:border-green-400/20">
            <table className="w-full text-sm">
              <thead className="bg-white/70 text-left dark:bg-gray-900/30">
                <tr>
                  <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-200">ISP</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 dark:text-gray-200">จำนวน</th>
                </tr>
              </thead>
              <tbody className="bg-white/40 dark:bg-gray-900/10">
                {rows.map((r, idx) => (
                  <tr key={`${r.isp}-${idx}`} className="border-t border-green-500/10 dark:border-green-400/10">
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{r.isp}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
