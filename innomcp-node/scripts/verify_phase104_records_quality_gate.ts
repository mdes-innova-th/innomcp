/* eslint-disable no-console */
import fs from "fs";
import os from "os";
import path from "path";
import { retrieveRecordsPayload } from "../src/utils/chat/recordsRetrieval";

interface VerifyCase {
  name: string;
  query: string;
  check: (payload: any) => string[];
}

interface VerifyResult {
  name: string;
  pass: boolean;
  reasons: string[];
}

function ensureArray(value: any, field: string, reasons: string[]) {
  if (!Array.isArray(value)) reasons.push(`${field} must be array`);
}

function ensureBaseContract(payload: any): string[] {
  const reasons: string[] = [];
  if (!payload || typeof payload !== "object") return ["payload must be object"];
  if (typeof payload.query !== "string") reasons.push("query must be string");
  ensureArray(payload.hits, "hits", reasons);
  if (typeof payload.summary !== "string") reasons.push("summary must be string");
  if (!payload.stats || typeof payload.stats !== "object") reasons.push("stats must be object");
  else {
    if (typeof payload.stats.hitCount !== "number") reasons.push("stats.hitCount must be number");
    if (typeof payload.stats.totalIndexed !== "number") reasons.push("stats.totalIndexed must be number");
    if (payload.stats.mode !== "index" && payload.stats.mode !== "fixture") reasons.push("stats.mode must be index|fixture");
  }
  ensureArray(payload.refs, "refs", reasons);
  ensureArray(payload.sources, "sources", reasons);
  if (!payload.meta || typeof payload.meta !== "object") reasons.push("meta must be object");
  return reasons;
}

function runCase(testCase: VerifyCase): VerifyResult {
  const payload = retrieveRecordsPayload(testCase.query);
  const reasons = [...ensureBaseContract(payload), ...testCase.check(payload)];
  return { name: testCase.name, pass: reasons.length === 0, reasons };
}

function isDescendingScore(hits: any[]): boolean {
  for (let index = 1; index < hits.length; index += 1) {
    if (Number(hits[index].score) > Number(hits[index - 1].score)) return false;
  }
  return true;
}

function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phase104-"));
  const indexPath = path.join(tempDir, "records-index.json");

  const fixtureRows = [
    {
      id: "law-001",
      title: "นโยบายพลังงานแห่งชาติ",
      summary: "มาตรการพลังงานสะอาดและลดการปล่อยคาร์บอน",
      body: "รายละเอียดการกำกับดูแลภาคพลังงานและเป้าหมายปี 2030",
      source: "thai-gov-energy",
      tags: ["พลังงาน", "นโยบาย"],
    },
    {
      id: "law-002",
      title: "แนวทางพลังงานชุมชน",
      summary: "แนวทางพัฒนาพลังงานชุมชนอย่างยั่งยืน",
      body: "พลังงานทดแทนในชุมชนและการบริหารจัดการท้องถิ่น",
      source: "community-energy",
      tags: ["พลังงาน", "ชุมชน"],
    },
    {
      id: "org-003",
      title: "ประวัติองค์กรภาครัฐ",
      summary: "พัฒนาการของหน่วยงานตั้งแต่ปี 2520",
      body: "เหตุการณ์สำคัญและโครงสร้างองค์กร",
      source: "org-archive",
      tags: ["ประวัติ", "องค์กร"],
    },
  ];

  fs.writeFileSync(indexPath, JSON.stringify(fixtureRows, null, 2), "utf8");
  process.env.RECORDS_INDEX_PATH = indexPath;

  const cases: VerifyCase[] = [
    {
      name: "q1_descending_score",
      query: "ค้นข้อมูลนโยบายพลังงาน",
      check: (p) => {
        const reasons: string[] = [];
        if (!isDescendingScore(p.hits)) reasons.push("scores must be sorted desc");
        return reasons;
      },
    },
    {
      name: "q2_snippet_quality",
      query: "พลังงาน",
      check: (p) => {
        const reasons: string[] = [];
        for (const hit of p.hits) {
          if (typeof hit.snippet !== "string") reasons.push("snippet must be string");
          if (String(hit.snippet).length > 185) reasons.push("snippet should be compact");
          if (/\n|\r/.test(String(hit.snippet))) reasons.push("snippet must not contain newline");
        }
        return reasons;
      },
    },
    {
      name: "q3_refs_sources_equal",
      query: "พลังงานชุมชน",
      check: (p) => {
        const reasons: string[] = [];
        if (JSON.stringify(p.refs) !== JSON.stringify(p.sources)) reasons.push("refs and sources must match");
        return reasons;
      },
    },
    {
      name: "q4_meta_note_qg1",
      query: "ประวัติองค์กร",
      check: (p) => {
        const reasons: string[] = [];
        if (!String(p.meta?.note || "").includes("qg1")) reasons.push("meta.note must include qg1");
        return reasons;
      },
    },
    {
      name: "q5_stopword_resilience",
      query: "ช่วยค้นข้อมูลเรื่องพลังงานให้หน่อย",
      check: (p) => {
        const reasons: string[] = [];
        if (p.stats.hitCount < 1) reasons.push("stopword-heavy query should still match");
        return reasons;
      },
    },
    {
      name: "q6_missing_file_fallback",
      query: "ทดสอบไฟล์หาย",
      check: (_p) => {
        const reasons: string[] = [];
        const old = process.env.RECORDS_INDEX_PATH;
        process.env.RECORDS_INDEX_PATH = path.join(tempDir, "missing.json");
        const fallback = retrieveRecordsPayload("fallback");
        process.env.RECORDS_INDEX_PATH = old;
        if (fallback.stats.mode !== "fixture") reasons.push("missing file should fallback fixture");
        return reasons;
      },
    },
    {
      name: "q7_invalid_json_fallback",
      query: "ทดสอบไฟล์เสีย",
      check: (_p) => {
        const reasons: string[] = [];
        const old = process.env.RECORDS_INDEX_PATH;
        const broken = path.join(tempDir, "broken.json");
        fs.writeFileSync(broken, "{invalid-json", "utf8");
        process.env.RECORDS_INDEX_PATH = broken;
        const fallback = retrieveRecordsPayload("broken");
        process.env.RECORDS_INDEX_PATH = old;
        if (fallback.stats.mode !== "fixture") reasons.push("invalid json should fallback fixture");
        return reasons;
      },
    },
    {
      name: "q8_query_trim",
      query: "   ประวัติองค์กร   ",
      check: (p) => {
        const reasons: string[] = [];
        if (p.query !== "ประวัติองค์กร") reasons.push("query should be trimmed");
        return reasons;
      },
    },
  ];

  const results = cases.map((item) => runCase(item));
  for (const result of results) {
    console.log(`${result.pass ? "✅" : "❌"} ${result.name}${result.pass ? "" : ` -> ${result.reasons.join("; ")}`}`);
  }

  const passCount = results.filter((x) => x.pass).length;
  const failCount = results.length - passCount;
  console.log(`\nSummary: total=${results.length} pass=${passCount} fail=${failCount}`);

  fs.rmSync(tempDir, { recursive: true, force: true });

  if (failCount === 0) {
    console.log("RESULT: PASS");
    process.exit(0);
  }

  console.log("RESULT: FAIL");
  process.exit(1);
}

main();
