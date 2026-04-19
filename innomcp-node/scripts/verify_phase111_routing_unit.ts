/**
 * Phase 111: Targeted routing unit tests (no LLM/HTTP)
 * Tests the 3 exact failing scenarios from previous session.
 * Run: npx ts-node scripts/verify_phase111_routing_unit.ts
 */
import { planAnswer } from "../src/utils/mcp/answerPlanner";

// ─── Inline the patched helpers for unit test ───────────────────────────────

function looksLikeEvidenceKeywordQuery(text: string): boolean {
  const t = String(text || "");
  // Phase 27: Definitional queries → knowledge
  if (/\bNIP\b.*คืออะไร|คืออะไร.*\bNIP\b|\bNIP\b.*หมายความ|\bNIP\b.*แปลว่า|evidence.*คืออะไร/i.test(t)) return false;
  const hasThaiMachine = /เครื่อง/i.test(t);
  const tFixed = t.replace(/ผิดกฏหมาย/g, "ผิดกฎหมาย");
  const hasEvidenceTerms = /(evidence|หลักฐาน|record|records|nip|url|mdes|วิดีโอ|บันทึก|สแกน|scanner|แนวโน้ม.*หลักฐาน|ผิดกฎหมาย|illegal)/i.test(tFixed);
  const hasIsp = /\bisp\b/i.test(t) || /ผู้ให้บริการ|ค่าย/i.test(t);
  const hasTelecomName = /\b(dtac|ดีแทค|ais|เอไอเอส|true|ทรู|trueonline|truemove|ทรูมูฟ|nt\b|cat\b|tot\b|3bb|ทีโอที)/i.test(t);
  const hasOnlineTerms = /(ออนไลน์|ออฟไลน์|online|offline|active)/i.test(t);
  const hasEnglishMachineToken = /\bmachine(s)?\b/i.test(t) && !/\bmachine\s+learning\b/i.test(t);
  if (hasThaiMachine) return true;
  if (hasEvidenceTerms) return true;
  if (hasIsp) return true;
  if (hasTelecomName && /(url|nip|ผิดกฎหมาย|illegal|รายการ|สแกน)/i.test(tFixed)) return true;
  if (hasEnglishMachineToken && hasOnlineTerms) return true;
  if (hasEnglishMachineToken && /(ไหน|ตัวไหน|กี่|สถานะ|status)/i.test(t)) return true;
  return false;
}

// ─── Inline buildHistoryAwareFollowUpQuery relevant logic ───────────────────

function extractLastDistinctCarryEntities(text: string, type: "province" | "region", max: number): string[] {
  const PROVINCE_NAMES: string[] = [
    "กรุงเทพ","เชียงใหม่","เชียงราย","เชียงราย","นครราชสีมา","ขอนแก่น","อุดรธานี","สุราษฎร์ธานี",
    "ภูเก็ต","พัทยา","ระยอง","ชลบุรี","สมุทรปราการ","นนทบุรี","ปทุมธานี","นครปฐม",
    "กาญจนบุรี","ราชบุรี","เพชรบุรี","ประจวบคีรีขันธ์","สงขลา","นครศรีธรรมราช",
    "ลำปาง","ลำพูน","แพร่","น่าน","พะเยา","แม่ฮ่องสอน","ตาก",
    "พิษณุโลก","สุโขทัย","กำแพงเพชร","พิจิตร","อุตรดิตถ์"
  ];
  const REGION_NAMES = ["ภาคเหนือ","ภาคใต้","ภาคอีสาน","ภาคกลาง","ภาคตะวันออก","ภาคตะวันตก","ภาคตะวันออกเฉียงเหนือ"];
  const pool = type === "province" ? PROVINCE_NAMES : REGION_NAMES;
  const found: string[] = [];
  for (const name of pool) {
    if (text.includes(name) && !found.includes(name)) {
      found.push(name);
      if (found.length >= max) break;
    }
  }
  return found;
}

interface ChatMessage { sender: string; text: string; }

function buildHistoryAwareFollowUpQuery(currentText: string, sessionHistory: ChatMessage[]): string {
  const cur = String(currentText || "").trim();
  if (sessionHistory.length < 2) return cur;

  const isAmbiguousFollowUp = /^(แล้ว|ถ้า|ถ้าเทียบ|เทียบ|สรุป|ขอเหตุผล|ขอสรุป|ขอ|แล้วล่ะ|แปลงเป็นข้อความ|จังหวัดไหนเด่น|สรุปต่างจาก|งั้น|เปลี่ยน|กลับมา)/i.test(cur)
    || /จังหวัดนี้|ที่นี่|ที่นั่น|ภาคนี้|ล่ะ$|อ่านว่า|เขียนเป็นคำ|ค่ายนี้|ของค่ายนี้|เมื่อกี้|อันเดิม|ตัวเดิม/i.test(cur);
  if (!isAmbiguousFollowUp) return cur;

  const historyText = sessionHistory.slice(-6).map((m) => String(m.text || "")).join(" ");
  const recentProvinces = extractLastDistinctCarryEntities(historyText, "province", 3);
  const lastProvince = recentProvinces[0];
  const recentRegions = extractLastDistinctCarryEntities(historyText, "region", 2);
  const lastRegion = recentRegions[0];

  const recentWeatherContext = /(ฝน|อากาศ|พยากรณ์|อุณหภูมิ|ความชื้น|ลม|weather|forecast|temperature|humidity)/i.test(historyText);
  const recentEvidenceMachineContext = /(เครื่องออนไลน์|เครื่องออฟไลน์|machine.*online)/i.test(historyText);
  const recentEvidenceUrlContext = /(url\s*ผิดกฎหมาย|url\s*ผิดกฏหมาย|nip.*ผิด|ตรวจพบ\s*url|url\/nip|illegal\s*url|url.*เจอ|เจอ.*url|กลับมาเรื่อง\s*evidence|เปลี่ยนเรื่อง\s*evidence|evidence\s*ของ|evidence.*ISP|\d+\s*รายการ.*ISP|ISP.*\d+\s*รายการ|\bNIP\b|รายการ\s*NIP|NIP\s*วันนี้|NIP\s*ล่าสุด|NIP\s*ของ)/i.test(historyText);

  // Extract last ISP from history (mirrors real function)
  const lastHistoryIsp = (() => {
    const ispPattern = /\b(ais|dtac|ดีแทค|true|ทรู|trueonline|truemove|nt\b|cat\b|tot\b|3bb|เอไอเอส|ทีโอที)\b/gi;
    const tokens = historyText.match(ispPattern);
    return tokens && tokens.length > 0 ? tokens[tokens.length - 1].toUpperCase() : null;
  })();

  // Evidence URL/ISP context carry-forward
  if (recentEvidenceUrlContext && lastHistoryIsp) {
    const explicitIsp = (() => {
      const m = cur.match(/\b(ais|dtac|ดีแทค|true|ทรู|nt|cat|tot|3bb)\b/i);
      return m ? m[1].toUpperCase() : null;
    })();
    if (explicitIsp) {
      return `url ผิดกฎหมายของ ${explicitIsp} วันนี้`;
    }
    if (/ค่ายนี้|ของค่ายนี้/i.test(cur)) {
      return `url ผิดกฎหมายของ ${lastHistoryIsp} วันนี้`;
    }
    if (/^สรุป/i.test(cur) && !recentWeatherContext) {
      return `สรุป url ผิดกฎหมายของ ${lastHistoryIsp} วันนี้`;
    }
  }

  if (!lastProvince && !lastRegion) return cur;

  const isAskingAboutRegion = /ภาคนี้|ภาคเดียวกัน/.test(cur);
  const isAskingAboutProvince = /จังหวัดนี้|จังหวัดเดียวกัน/.test(cur);
  let carryEntity = lastProvince || lastRegion;
  if (isAskingAboutRegion && lastRegion) carryEntity = lastRegion;
  if (isAskingAboutProvince && lastProvince) carryEntity = lastProvince;

  // Phase 27: Geo carry-forward
  if (!recentWeatherContext && !recentEvidenceUrlContext && !recentEvidenceMachineContext) {
    const recentGeoContext = /(จังหวัดใน|จังหวัดในภาค|ภาคเหนือ|ภาคใต้|ภาคอีสาน|ภาคกลาง|ภาคตะวันออก|ภาคตะวันตก|มีจังหวัดอะไรบ้าง|จังหวัดอะไรบ้าง)/i.test(historyText);
    if (recentGeoContext) {
      const provinceInCur = recentProvinces.find(p => cur.includes(p));
      if (provinceInCur) return `จังหวัด${provinceInCur} อยู่ภาคอะไร`;
      if (carryEntity && !cur.includes("อากาศ") && !cur.includes("ฝน")) {
        return `จังหวัด${carryEntity} อยู่ภาคอะไร`;
      }
    }
  }

  return cur.includes(carryEntity) ? cur : `${carryEntity} ${cur}`;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;

function check(label: string, got: boolean | string, expected: boolean | string) {
  const ok = got === expected;
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} ${label}`);
  if (!ok) console.log(`   Expected: ${JSON.stringify(expected)}\n   Got:      ${JSON.stringify(got)}`);
  ok ? pass++ : fail++;
}

console.log("\n=== Fix 3: NIP Definitional Query ===");
check("looksLikeEvidenceKeywordQuery('NIP คืออะไร') → false", looksLikeEvidenceKeywordQuery("NIP คืออะไร"), false);
check("looksLikeEvidenceKeywordQuery('NIP หมายความว่าอะไร') → false", looksLikeEvidenceKeywordQuery("NIP หมายความว่าอะไร"), false);
check("looksLikeEvidenceKeywordQuery('รายการ NIP วันนี้ของ AIS') → true (still evidence)", looksLikeEvidenceKeywordQuery("รายการ NIP วันนี้ของ AIS"), true);
check("looksLikeEvidenceKeywordQuery('เครื่องออนไลน์ทั้งหมด') → true", looksLikeEvidenceKeywordQuery("เครื่องออนไลน์ทั้งหมด"), true);

console.log("\n=== Fix 3: planAnswer (answerPlanner) ===");
const planNipDef = planAnswer("NIP คืออะไร");
check("planAnswer('NIP คืออะไร').intent !== 'evidence'", planNipDef.intent !== "evidence", true);
console.log(`   Actual intent: ${planNipDef.intent}`);

const planNipQuery = planAnswer("รายการ NIP วันนี้ของ AIS");
check("planAnswer('รายการ NIP วันนี้ของ AIS').intent === 'evidence'", planNipQuery.intent, "evidence");

console.log("\n=== Fix 1: Evidence carry-forward recentEvidenceUrlContext ===");
const geoHistory: ChatMessage[] = [
  { sender: "user", text: "รายการ NIP วันนี้ของ AIS" },
  { sender: "ai", text: "พบ NIP ของ AIS วันนี้ 1,234 รายการ" },
];
const enriched = buildHistoryAwareFollowUpQuery("แล้วของ TRUE ล่ะ", geoHistory);
// Should NOT return the original text unchanged — should enrich with evidence carry-forward
check("Evidence carry-forward: recentEvidenceUrlContext detects 'NIP' in history", enriched !== "แล้วของ TRUE ล่ะ", true);
console.log(`   Enriched query: "${enriched}"`);

console.log("\n=== Fix 2: Geo carry-forward ===");
const geoContextHistory: ChatMessage[] = [
  { sender: "user",  text: "จังหวัดในภาคเหนือมีอะไรบ้าง" },
  { sender: "ai",  text: "ภาคเหนือประกอบด้วยจังหวัด: เชียงใหม่ เชียงราย ลำปาง ลำพูน แพร่ น่าน พะเยา แม่ฮ่องสอน" },
];
const geoEnriched = buildHistoryAwareFollowUpQuery("แล้วเชียงรายล่ะ", geoContextHistory);
check("Geo carry-forward: 'แล้วเชียงรายล่ะ' rewritten to geo query", geoEnriched, "จังหวัดเชียงราย อยู่ภาคอะไร");
console.log(`   Enriched query: "${geoEnriched}"`);

// Verify weather carry-forward still works (regression check)
const weatherHistory: ChatMessage[] = [
  { sender: "user", text: "อากาศเชียงใหม่วันนี้เป็นอย่างไร" },
  { sender: "ai", text: "เชียงใหม่วันนี้ อากาศอุณหภูมิ 28 องศา" },
];
const weatherEnriched = buildHistoryAwareFollowUpQuery("แล้วพรุ่งนี้ล่ะ", weatherHistory);
check("Weather carry-forward still works (regression): 'แล้วพรุ่งนี้ล่ะ' → includes 'เชียงใหม่'", weatherEnriched.includes("เชียงใหม่"), true);
console.log(`   Enriched query: "${weatherEnriched}"`);

// Geo NOT triggered when weather context present
const geoWeatherMixHistory: ChatMessage[] = [
  { sender: "user", text: "อากาศในภาคเหนือเป็นอย่างไร" },
  { sender: "ai", text: "ภาคเหนือ จังหวัดเชียงใหม่วันนี้อุณหภูมิ 30 องศา" },
];
const geoWeatherMixed = buildHistoryAwareFollowUpQuery("แล้วเชียงรายล่ะ", geoWeatherMixHistory);
check("Geo carry-forward NOT triggered when weather context in history", !geoWeatherMixed.startsWith("จังหวัดเชียงราย อยู่ภาคอะไร"), true);
console.log(`   Enriched query: "${geoWeatherMixed}"`);

console.log("\n─────────────────────────────────────────");
console.log(`RESULT: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
