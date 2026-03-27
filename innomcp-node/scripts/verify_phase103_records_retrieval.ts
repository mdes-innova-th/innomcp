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
  if (!Array.isArray(value)) {
    reasons.push(`${field} must be array`);
  }
}

function ensureBaseContract(payload: any): string[] {
  const reasons: string[] = [];
  if (!payload || typeof payload !== "object") {
    reasons.push("payload must be object");
    return reasons;
  }
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
  return {
    name: testCase.name,
    pass: reasons.length === 0,
    reasons,
  };
}

function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phase103-"));
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
      id: "org-002",
      title: "ประวัติองค์กรภาครัฐ",
      summary: "พัฒนาการของหน่วยงานตั้งแต่ปี 2520",
      body: "เหตุการณ์สำคัญและโครงสร้างองค์กร",
      source: "org-archive",
      tags: ["ประวัติ", "องค์กร"],
    },
    {
      id: "transport-003",
      title: "แผนคมนาคมเมือง",
      summary: "แผนพัฒนาโครงข่ายขนส่งสาธารณะ",
      body: "เส้นทางใหม่และงบประมาณ",
      source: "city-plan",
      tags: ["คมนาคม", "แผน"],
    },
  ];

  fs.writeFileSync(indexPath, JSON.stringify(fixtureRows, null, 2), "utf8");
  process.env.RECORDS_INDEX_PATH = indexPath;

  const cases: VerifyCase[] = [
    {
      name: "c1_match_energy",
      query: "ค้นข้อมูลนโยบายพลังงาน",
      check: (p) => {
        const reasons: string[] = [];
        if (p.stats.mode !== "index") reasons.push("mode should be index");
        if (p.stats.totalIndexed !== 3) reasons.push("totalIndexed should be 3");
        if (p.stats.hitCount < 1) reasons.push("hitCount should be >= 1");
        if (!String(p.summary).includes("พบข้อมูลที่เกี่ยวข้อง")) reasons.push("summary should indicate match");
        return reasons;
      },
    },
    {
      name: "c2_match_history",
      query: "ประวัติองค์กร",
      check: (p) => {
        const reasons: string[] = [];
        if (p.hits.length < 1) reasons.push("should return hits for history query");
        if (p.hits.length > 0 && !String(p.hits[0].title).includes("ประวัติ")) reasons.push("top hit should relate to history");
        return reasons;
      },
    },
    {
      name: "c3_no_match",
      query: "ชีววิทยาทางทะเล",
      check: (p) => {
        const reasons: string[] = [];
        if (p.stats.hitCount !== 0) reasons.push("no-match should have hitCount=0");
        if (!String(p.summary).includes("ไม่พบ")) reasons.push("no-match summary should mention not found");
        return reasons;
      },
    },
    {
      name: "c4_refs_sources_sync",
      query: "นโยบาย พลังงาน",
      check: (p) => {
        const reasons: string[] = [];
        if (JSON.stringify(p.refs) !== JSON.stringify(p.sources)) reasons.push("refs and sources should be identical");
        return reasons;
      },
    },
    {
      name: "c5_hit_shape",
      query: "คมนาคม",
      check: (p) => {
        const reasons: string[] = [];
        if (p.hits.length > 0) {
          const h = p.hits[0];
          if (typeof h.id !== "string") reasons.push("hit.id must be string");
          if (typeof h.title !== "string") reasons.push("hit.title must be string");
          if (typeof h.snippet !== "string") reasons.push("hit.snippet must be string");
          if (typeof h.source !== "string") reasons.push("hit.source must be string");
          if (typeof h.score !== "number") reasons.push("hit.score must be number");
        }
        return reasons;
      },
    },
    {
      name: "c6_missing_index_file",
      query: "ทดสอบไฟล์หาย",
      check: (_p) => {
        const reasons: string[] = [];
        const old = process.env.RECORDS_INDEX_PATH;
        process.env.RECORDS_INDEX_PATH = path.join(tempDir, "missing.json");
        const fallback = retrieveRecordsPayload("fallback");
        process.env.RECORDS_INDEX_PATH = old;
        if (fallback.stats.mode !== "fixture") reasons.push("missing index should use fixture mode");
        if (fallback.meta?.dataSource !== "none") reasons.push("missing index should set dataSource=none");
        return reasons;
      },
    },
    {
      name: "c7_invalid_json",
      query: "ทดสอบไฟล์เสีย",
      check: (_p) => {
        const reasons: string[] = [];
        const brokenPath = path.join(tempDir, "broken.json");
        fs.writeFileSync(brokenPath, "{invalid-json", "utf8");
        const old = process.env.RECORDS_INDEX_PATH;
        process.env.RECORDS_INDEX_PATH = brokenPath;
        const fallback = retrieveRecordsPayload("invalid");
        process.env.RECORDS_INDEX_PATH = old;
        if (fallback.stats.mode !== "fixture") reasons.push("invalid json should use fixture mode");
        return reasons;
      },
    },
    {
      name: "c8_query_passthrough",
      query: "   ช่องว่างหัวท้าย   ",
      check: (p) => {
        const reasons: string[] = [];
        if (p.query !== "ช่องว่างหัวท้าย") reasons.push("query should be trimmed");
        return reasons;
      },
    },
  ];

  const results = cases.map((c) => runCase(c));
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
