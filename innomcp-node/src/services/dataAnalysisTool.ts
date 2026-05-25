import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface ColumnStats {
  name: string;
  type: "number" | "string" | "date";
  count: number;
  nullCount: number;
  unique?: number;
  min?: number; max?: number; mean?: number; median?: number; stdDev?: number;
  topValues?: Array<{ value: string; count: number }>;
}

export interface AnalysisResult {
  rowCount: number;
  colCount: number;
  columns: ColumnStats[];
  summary: string;
  chartSvg?: string;
  artifactPath?: string;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
  const rows = lines.slice(1).map(l => {
    const cells: string[] = []; let cur = ""; let inQ = false;
    for (const ch of l) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { cells.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });
  return { headers, rows };
}

function numStats(vals: number[]): Pick<ColumnStats, "min"|"max"|"mean"|"median"|"stdDev"> {
  if (vals.length === 0) return {};
  const sorted = [...vals].sort((a, b) => a - b);
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2
    : sorted[Math.floor(sorted.length/2)];
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
  return { min: sorted[0], max: sorted[sorted.length-1], mean: +mean.toFixed(3), median, stdDev: +Math.sqrt(variance).toFixed(3) };
}

function barChartSvg(labels: string[], values: number[], title: string): string {
  const W = 480, H = 220, PAD = 40, BAR_W = Math.min(30, Math.floor((W - PAD*2) / Math.max(labels.length, 1)) - 4);
  const maxVal = Math.max(...values, 1);
  const chartH = H - PAD * 2;
  const bars = labels.map((lbl, i) => {
    const x = PAD + i * ((W - PAD*2) / labels.length) + ((W - PAD*2) / labels.length - BAR_W) / 2;
    const barH = (values[i] / maxVal) * chartH;
    const y = PAD + chartH - barH;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${BAR_W}" height="${barH.toFixed(1)}" fill="#3b82f6" rx="2"/>
<text x="${(x+BAR_W/2).toFixed(1)}" y="${(y-4).toFixed(1)}" font-size="9" text-anchor="middle" fill="#64748b">${values[i].toFixed(1)}</text>
<text x="${(x+BAR_W/2).toFixed(1)}" y="${(PAD+chartH+14).toFixed(1)}" font-size="9" text-anchor="middle" fill="#94a3b8">${lbl.slice(0,8)}</text>`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#fff;border-radius:8px">
<text x="${W/2}" y="18" font-size="12" font-weight="600" text-anchor="middle" fill="#1e293b">${title}</text>
${bars}
<line x1="${PAD}" y1="${PAD}" x2="${PAD}" y2="${PAD+chartH}" stroke="#e2e8f0" stroke-width="1"/>
<line x1="${PAD}" y1="${PAD+chartH}" x2="${W-PAD}" y2="${PAD+chartH}" stroke="#e2e8f0" stroke-width="1"/>
</svg>`;
}

export async function analyzeData(
  input: string | { path: string; workspaceRoot: string },
  opts: { workspaceRoot: string; maxRows?: number } = { workspaceRoot: "" }
): Promise<AnalysisResult> {
  let text: string;
  if (typeof input === "string") {
    text = input;
  } else {
    const safePath = path.resolve(input.workspaceRoot, input.path.replace(/^\/+/, ""));
    if (!safePath.startsWith(input.workspaceRoot)) throw new Error("Path outside workspace");
    text = await fs.readFile(safePath, "utf-8");
  }

  const maxRows = opts.maxRows ?? 10_000;
  const { headers, rows } = parseCSV(text.trim());
  const limitedRows = rows.slice(0, maxRows);

  const columns: ColumnStats[] = headers.map((name, ci) => {
    const cellVals = limitedRows.map(r => (r[ci] ?? "").trim()).filter(v => v !== "");
    const nullCount = limitedRows.length - cellVals.length;
    const numVals = cellVals.map(Number).filter(n => !isNaN(n));
    const isNumeric = numVals.length > cellVals.length * 0.7;

    if (isNumeric) {
      return { name, type: "number" as const, count: numVals.length, nullCount, unique: new Set(numVals).size, ...numStats(numVals) };
    }
    const freq = new Map<string, number>();
    cellVals.forEach(v => freq.set(v, (freq.get(v) ?? 0) + 1));
    const topValues = [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([value,count])=>({value,count}));
    return { name, type: "string" as const, count: cellVals.length, nullCount, unique: freq.size, topValues };
  });

  // Find best numeric column for chart
  const numCols = columns.filter(c => c.type === "number");
  const catCols = columns.filter(c => c.type === "string" && (c.unique ?? 0) <= 20);
  let chartSvg: string | undefined;
  if (catCols.length > 0 && numCols.length > 0) {
    const cat = catCols[0]; const num = numCols[0];
    const catIdx = headers.indexOf(cat.name); const numIdx = headers.indexOf(num.name);
    const aggr = new Map<string, number[]>();
    limitedRows.forEach(r => {
      const k = (r[catIdx] ?? "").trim(); const v = Number(r[numIdx]);
      if (k && !isNaN(v)) { if (!aggr.has(k)) aggr.set(k, []); aggr.get(k)!.push(v); }
    });
    const topEntries = [...aggr.entries()].slice(0, 10);
    if (topEntries.length >= 2) {
      const labels = topEntries.map(([k]) => k);
      const vals = topEntries.map(([, vs]) => vs.reduce((a, b) => a + b, 0) / vs.length);
      chartSvg = barChartSvg(labels, vals, `${num.name} by ${cat.name}`);
    }
  }

  const numSummary = numCols.map(c => `${c.name}: min=${c.min}, max=${c.max}, mean=${c.mean?.toFixed(2)}`).join("; ");
  const catSummary = catCols.map(c => `${c.name}: ${c.unique} unique values`).join("; ");
  const summary = `${limitedRows.length} rows, ${headers.length} columns. Numeric: ${numSummary || "none"}. Categorical: ${catSummary || "none"}.`;

  let artifactPath: string | undefined;
  if (chartSvg && opts.workspaceRoot) {
    const dir = path.resolve(opts.workspaceRoot, "artifacts", "charts");
    await fs.mkdir(dir, { recursive: true });
    const fname = `chart-${Date.now()}.svg`;
    artifactPath = path.join(dir, fname);
    await fs.writeFile(artifactPath, chartSvg, "utf-8");
  }

  return { rowCount: limitedRows.length, colCount: headers.length, columns, summary, chartSvg, artifactPath };
}
