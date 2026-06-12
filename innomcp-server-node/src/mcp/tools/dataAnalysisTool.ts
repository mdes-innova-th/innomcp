/**
 * dataAnalysisTool.ts — Phase 10.21
 *
 * Parses CSV or JSON data supplied inline and returns a structured
 * summary, per-column statistics, KPI highlights, and a table view.
 * Registered in server.ts for the MCP tools/call endpoint.
 */
import { parse as parseCsv } from "csv-parse/sync";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DataAnalysisInput {
  data: string;
  format: "csv" | "json";
  question?: string;
}

export interface ColumnStat {
  column: string;
  type: "number" | "string" | "boolean" | "mixed";
  min?: number;
  max?: number;
  mean?: number;
  unique: number;
}

export interface Kpi {
  label: string;
  value: string | number;
  unit?: string;
}

export interface AnalysisResult {
  summary: {
    rows: number;
    columns: number;
    sample: Record<string, unknown>[];
  };
  stats: ColumnStat[];
  kpis: Kpi[];
  table: {
    headers: string[];
    rows: string[][];
  };
  question_note?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TOOL_NAME = "dataAnalysisTool";
const MAX_ROWS = 500;

// ── Helpers ──────────────────────────────────────────────────────────────────

function inferType(values: unknown[]): ColumnStat["type"] {
  let hasNum = false;
  let hasStr = false;
  let hasBool = false;
  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    const t = typeof v;
    if (t === "number" || (t === "string" && (v as string).trim() !== "" && !isNaN(Number(v as string)))) {
      hasNum = true;
    } else if (t === "boolean") {
      hasBool = true;
    } else {
      hasStr = true;
    }
  }
  const kinds = [hasNum, hasStr, hasBool].filter(Boolean).length;
  if (kinds > 1) return "mixed";
  if (hasNum) return "number";
  if (hasBool) return "boolean";
  return "string";
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return null;
}

function computeStats(rows: Record<string, unknown>[], headers: string[]): ColumnStat[] {
  return headers.map((col) => {
    const values = rows.map((r) => r[col]);
    const type = inferType(values);
    const stat: ColumnStat = {
      column: col,
      type,
      unique: new Set(values.map((v) => String(v ?? ""))).size,
    };
    if (type === "number") {
      const nums = values.map(toNumber).filter((n): n is number => n !== null);
      if (nums.length > 0) {
        stat.min = Math.min(...nums);
        stat.max = Math.max(...nums);
        stat.mean = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
      }
    }
    return stat;
  });
}

function buildKpis(rows: Record<string, unknown>[], stats: ColumnStat[]): Kpi[] {
  const kpis: Kpi[] = [];
  kpis.push({ label: "Total rows", value: rows.length });
  for (const s of stats) {
    if (s.type === "number" && s.mean !== undefined) {
      kpis.push({ label: `Mean ${s.column}`, value: s.mean });
      if (s.max !== undefined) kpis.push({ label: `Max ${s.column}`, value: s.max });
    }
    if (s.unique === 2 && (s.type === "string" || s.type === "boolean")) {
      kpis.push({ label: `${s.column} unique values`, value: s.unique });
    }
  }
  return kpis.slice(0, 10);
}

function rowsToTable(
  rows: Record<string, unknown>[],
  headers: string[]
): { headers: string[]; rows: string[][] } {
  const tableRows = rows.slice(0, 20).map((r) =>
    headers.map((h) => String(r[h] ?? ""))
  );
  return { headers, rows: tableRows };
}

function parseRows(input: DataAnalysisInput): Record<string, unknown>[] {
  if (input.format === "json") {
    const parsed = JSON.parse(input.data);
    if (!Array.isArray(parsed)) {
      throw new Error("JSON data must be an array of objects");
    }
    return parsed as Record<string, unknown>[];
  }

  // CSV with csv-parse/sync
  const records = parseCsv(input.data, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  }) as Record<string, unknown>[];
  return records;
}

// ── Core execution function ───────────────────────────────────────────────────

async function execute(args: DataAnalysisInput): Promise<string> {
  const format: "csv" | "json" = (args.format as "csv" | "json") ?? "csv";
  const rawData = String(args.data ?? "").trim();
  const question = args.question ? String(args.question).trim() : undefined;

  if (!rawData) {
    return JSON.stringify({ ok: false, error: "No data provided" });
  }

  let allRows: Record<string, unknown>[];
  try {
    allRows = parseRows({ data: rawData, format, question });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return JSON.stringify({ ok: false, error: `Failed to parse ${format}: ${msg}` });
  }

  if (allRows.length === 0) {
    return JSON.stringify({ ok: false, error: "Data parsed to zero rows" });
  }

  // Enforce max row limit
  const rows = allRows.length > MAX_ROWS ? allRows.slice(0, MAX_ROWS) : allRows;

  const headers = Object.keys(rows[0] ?? {});
  const stats = computeStats(rows, headers);
  const kpis = buildKpis(rows, stats);
  const table = rowsToTable(rows, headers);
  const sample = rows.slice(0, 3);

  const result: AnalysisResult = {
    summary: {
      rows: rows.length,
      columns: headers.length,
      sample,
    },
    stats,
    kpis,
    table,
    ...(question ? { question_note: `Question context: ${question}` } : {}),
  };

  return JSON.stringify({ ok: true, data: result });
}

// ── Tool object (default export) ──────────────────────────────────────────────

export const dataAnalysisTool = {
  name: TOOL_NAME,
  description:
    "Analyse CSV or JSON data: parse rows, compute column statistics (min/max/mean/unique), " +
    "extract KPI highlights, and return a table view. Max 500 rows processed.",
  inputSchema: z.object({
    data: z.string().describe("Raw CSV text or JSON array string to analyse"),
    format: z.enum(["csv", "json"]).describe("Data format: csv or json"),
    question: z.string().optional().describe("Optional natural-language question about the data"),
  }),
  execute: async (args: any) => {
    const resultText = await execute(args as DataAnalysisInput);
    return {
      content: [{ type: "text" as const, text: resultText }],
    };
  },
};

export default dataAnalysisTool;

// ── registerDataAnalysisTool ─────────────────────────────────────────────────

export function registerDataAnalysisTool(server: McpServer): void {
  (server.registerTool as any)(
    dataAnalysisTool.name,
    {
      title: "Data Analysis Tool - วิเคราะห์ข้อมูล CSV/JSON",
      description: dataAnalysisTool.description,
      inputSchema: dataAnalysisTool.inputSchema,
    },
    dataAnalysisTool.execute,
  );
}
