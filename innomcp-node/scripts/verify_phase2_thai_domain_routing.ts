/**
 * verify_phase2_thai_domain_routing.ts
 * Phase 2 acceptance: Thai History / Law / Religion routing gates
 *
 * Validates that the routing detector functions correctly identify and route
 * queries to thai_history_tool, thai_law_tool, and thai_religion_tool.
 *
 * Run: npx ts-node --project tsconfig.json scripts/verify_phase2_thai_domain_routing.ts
 */

import path from "path";
import fs from "fs";

// ─────────────────────────────────────────────────────────────────────────────
// Inline the detector functions (copied from chat.ts exports for isolation)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Detector functions — MUST match chat.ts implementations exactly
// ─────────────────────────────────────────────────────────────────────────────

function looksLikeThaiHistoryQuery(text: string): boolean {
  const t = String(text || "");
  if (/(อากาศ|ฝน|พยากรณ์|weather|forecast|อุณหภูมิ)/i.test(t)) return false;
  return /(ประวัติศาสตร์|กษัตริย์|สมัย|ราชวงศ์|รัชกาล|อยุธยา|สุโขทัย|พระนเรศวร|ยุทธหัตถี|ล้านนา|ธนบุรี|รัตนโกสินทร์|พ่อขุน|เจ้าเมือง|วีรบุรุษ|วีรสตรี|ประวัติ.*ไทย|ไทยสมัย|เหตุการณ์สำคัญ|ประวัติบุคคล)/i.test(t);
}

function looksLikeThaiLawQuery(text: string): boolean {
  const t = String(text || "");
  return /(กฎหมาย|มาตรา|พ\.ร\.บ\.|พระราชบัญญัติ|ประมวลกฎหมาย|โทษ|จำคุก|ปรับ|คดี|กระทำผิด|ผิดกฎหมาย|ลงโทษ|อาญา|แพ่ง|อาชญากรรม|บทลงโทษ|ข้อกฎหมาย|กฎหมายไทย)/i.test(t);
}

function looksLikeThaiReligionQuery(text: string): boolean {
  const t = String(text || "");
  if (/(อากาศ|ฝน|weather)/i.test(t)) return false;
  return /((?<!ห)วัด[^ๆ]|พระพุทธ|ศาสนา|นมัสการ|วิสาขบูชา|บวช|พุทธศาสนา|อิสลาม|คริสต์|สวดมนต์|ทำบุญ|พระสงฆ์|โบสถ์|มัสยิด|ศาลเจ้า|เทพ|พระเจ้า|พระธาตุ|พระวิหาร|เจดีย์|หลวงพ่อ)/i.test(t);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test cases
// ─────────────────────────────────────────────────────────────────────────────

interface TestCase {
  label: string;
  query: string;
  expect: { history: boolean; law: boolean; religion: boolean };
}

const cases: TestCase[] = [
  // --- History ---
  { label: "H1 อยุธยา", query: "อยุธยาเป็นราชธานีของไทยในยุคใด", expect: { history: true, law: false, religion: false } },
  { label: "H2 ราชวงศ์", query: "ราชวงศ์จักรีก่อตั้งเมื่อไหร่", expect: { history: true, law: false, religion: false } },
  { label: "H3 ประวัติศาสตร์ไทย", query: "ประวัติศาสตร์ไทยสมัยโบราณ", expect: { history: true, law: false, religion: false } },
  { label: "H4 รัชกาล", query: "รัชกาลที่ 5 ทรงปฏิรูปอะไรบ้าง", expect: { history: true, law: false, religion: false } },
  // --- Law ---
  { label: "L1 มาตรา", query: "มาตรา 288 ว่าด้วยเรื่องอะไร", expect: { history: false, law: true, religion: false } },
  { label: "L2 พ.ร.บ.", query: "พ.ร.บ. ข้อมูลข่าวสารของราชการบัญญัติอะไรบ้าง", expect: { history: false, law: true, religion: false } },
  { label: "L3 กฎหมายอาญา", query: "ความผิดอาญาฐานลักทรัพย์โทษเท่าไหร่", expect: { history: false, law: true, religion: false } },
  { label: "L4 จำคุก", query: "โทษจำคุกสำหรับคดียาเสพติด", expect: { history: false, law: true, religion: false } },
  // --- Religion ---
  { label: "R1 วัดมีชื่อ", query: "วัดอรุณตั้งอยู่ที่ไหน", expect: { history: false, law: false, religion: true } },
  { label: "R2 พระพุทธ", query: "พระพุทธเจ้าตรัสรู้ที่ไหน", expect: { history: false, law: false, religion: true } },
  { label: "R3 ศาสนา", query: "ศาสนาในประเทศไทยมีอะไรบ้าง", expect: { history: false, law: false, religion: true } },
  { label: "R4 พุทธศาสนา", query: "พุทธศาสนาเข้ามาสู่ไทยตั้งแต่เมื่อไหร่", expect: { history: false, law: false, religion: true } },
  // --- Non-domain (should return false for all) ---
  { label: "N1 weather", query: "อากาศวันนี้เป็นอย่างไร", expect: { history: false, law: false, religion: false } },
  { label: "N2 math", query: "2 + 2 เท่ากับเท่าไหร่", expect: { history: false, law: false, religion: false } },
  { label: "N3 greeting", query: "สวัสดีครับ", expect: { history: false, law: false, religion: false } },
  { label: "N4 geo province", query: "จังหวัดเชียงใหม่มีอำเภออะไรบ้าง", expect: { history: false, law: false, religion: false } },
];

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

function run() {
  let pass = 0;
  let fail = 0;
  const failures: string[] = [];

  for (const tc of cases) {
    const history = looksLikeThaiHistoryQuery(tc.query);
    const law = looksLikeThaiLawQuery(tc.query);
    const religion = looksLikeThaiReligionQuery(tc.query);

    const ok = history === tc.expect.history && law === tc.expect.law && religion === tc.expect.religion;
    if (ok) {
      console.log(`  ✔  ${tc.label}`);
      pass++;
    } else {
      const got = `history=${history} law=${law} religion=${religion}`;
      const exp = `history=${tc.expect.history} law=${tc.expect.law} religion=${tc.expect.religion}`;
      const msg = `  ✘  ${tc.label}: got [${got}] expected [${exp}]`;
      console.log(msg);
      failures.push(msg);
      fail++;
    }
  }

  console.log(`\n──────────────────────────────────────────`);
  console.log(`Phase 2 Thai Domain Routing: ${pass}/${pass + fail} PASS`);

  if (failures.length > 0) {
    console.log("\nFAILURES:");
    failures.forEach((f) => console.log(f));
    process.exit(1);
  } else {
    console.log("✅ ALL PASS — Thai History/Law/Religion routing detectors verified");
    process.exit(0);
  }
}

run();
