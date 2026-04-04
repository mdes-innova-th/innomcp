/**
 * ONLINE PROOF SPEC — Section B (weather) + Section C (non-weather)
 * Run once, capture structured results, report PASS/FAIL per query.
 * Temporary probe — NOT a permanent regression suite.
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import {
  ask,
  ensureDir,
} from "./shared-helpers";

const CHAT_URL = process.env.CHAT_URL || "http://localhost:3000";
const RESULTS_DIR = path.join(__dirname, "..", "..", "results");

type ProbeResult = {
  section: "B" | "C";
  id: string;
  query: string;
  toolsUsed: string;
  answer: string;
  semanticPass: boolean;
  passReason: string;
  rt: number;
};

const results: ProbeResult[] = [];

// ───────────────────────── Section B: Weather ─────────────────────────
const WEATHER_QUERIES = [
  { id: "B1", q: "วันนี้ฝนจะตกที่ไหนบ้าง ในภาคกลาง", passRe: /กลาง|ฝน|อากาศ|พยากรณ์/i },
  { id: "B2", q: "วันนี้ฝนจะตกที่ไหนบ้าง ในภาคเหนือ", passRe: /เหนือ|ฝน|อากาศ|พยากรณ์/i },
  { id: "B3", q: "พรุ่งนี้ที่ไหนฝนตกบ้างในตอนบ่ายถึงค่ำ ตอบในรูปแบบตาราง", passRe: /ฝน|อากาศ|พยากรณ์|ตาราง|\|/i },
  { id: "B4", q: "วันศุกร์ นี้อุบล ฝน มีมะ", passRe: /อุบล|ฝน|อากาศ|พยากรณ์/i },
  { id: "B5", q: "อากาศเชียงรายวันศุกร์", passRe: /เชียงราย|อากาศ|ฝน|พยากรณ์/i },
  { id: "B6", q: "อากาศอัมพวา สัปดาห์หน้า", passRe: /อัมพวา|สมุทรสงคราม|อากาศ|ฝน|พยากรณ์/i },
  { id: "B7", q: "จังหวัด อุบล ยะลา แม่กลอง เพชรบุรี มีสภาพอากาศเป็นอย่างไร สัปดาห์หน้า", passRe: /อุบล|ยะลา|เพชรบุรี|อากาศ|ฝน|พยากรณ์/i },
  { id: "B8", q: "bkk weather tmrw", passRe: /กรุงเทพ|บางกอก|Bangkok|อากาศ|weather|rain/i },
  { id: "B9", q: "ฝนตกมั้ยพรุ่งนี้ลำพูน", passRe: /ลำพูน|ฝน|อากาศ|พยากรณ์/i },
  { id: "B10", q: "อากาส กทม พุ่งนี้", passRe: /กรุงเทพ|กทม|อากาศ|ฝน|พยากรณ์/i },
];

test.describe("Section B — Real Online Weather Proof", () => {
  for (const { id, q, passRe } of WEATHER_QUERIES) {
    test(`[${id}] ${q}`, async ({ page }) => {
      test.setTimeout(120_000);
      const { response, rt } = await ask(page, CHAT_URL, q);

      const toolsMeta = await page.locator('[data-testid="tools-used-meta"]').last().textContent().catch(() => "");
      const toolsUsed = toolsMeta || "—";

      const pass = passRe.test(response) && response.length > 20;

      results.push({ section: "B", id, query: q, toolsUsed, answer: response.slice(0, 300), semanticPass: pass, passReason: pass ? "content match" : "no match / too short", rt });

      console.log(`[${id}] tools=${toolsUsed} rt=${rt}ms pass=${pass}`);
      console.log(`  answer: ${response.slice(0, 200)}`);

      expect(pass, `B/${id} — answer does not match expected pattern. Answer: ${response.slice(0, 200)}`).toBe(true);
    });
  }
});

// ───────────────────────── Section C: Non-weather ─────────────────────────
const NON_WEATHER_QUERIES = [
  { id: "C1", q: "ค้นหาหนังสือเกี่ยวกับ Python programming ใน Internet Archive", passRe: /archive|python|หนังสือ|เล่ม|found|item/i },
  { id: "C2", q: "รูปภาพดาราศาสตร์วันนี้จาก NASA", passRe: /nasa|ภาพ|astronomy|apod|space|ดาว/i },
  { id: "C3", q: "GDP per capita ของประเทศไทยปี 2023", passRe: /gdp|ไทย|2023|thailand|per capita|\d/i },
  { id: "C4", q: "จำนวนประชากรไทยล่าสุดจากข้อมูลภาครัฐ", passRe: /ประชากร|million|ล้าน|\d|population|ไทย/i },
  { id: "C5", q: "ตอนนี้กี่โมง", passRe: /\d{1,2}:\d{2}|นาที|โมง|ชั่วโมง/i },
  { id: "C6", q: "คำนวน 48*7 แล้วบวก 12", passRe: /348|คำตอบ|ผลลัพธ์|\d/i },
  { id: "C7", q: "หาดใหญ่อยู่จังหวัดอะไร", passRe: /สงขลา|หาดใหญ่/i },
  { id: "C8", q: "url ผิดกฎหมาย ของ dtac วันนี้", passRe: /dtac|url|ผิดกฎหมาย|รายการ|\d/i },
];

test.describe("Section C — Non-weather Routing Proof", () => {
  for (const { id, q, passRe } of NON_WEATHER_QUERIES) {
    test(`[${id}] ${q}`, async ({ page }) => {
      test.setTimeout(90_000);
      const { response, rt } = await ask(page, CHAT_URL, q);

      const toolsMeta = await page.locator('[data-testid="tools-used-meta"]').last().textContent().catch(() => "");
      const toolsUsed = toolsMeta || "—";

      const pass = passRe.test(response) && response.length > 5;

      results.push({ section: "C", id, query: q, toolsUsed, answer: response.slice(0, 300), semanticPass: pass, passReason: pass ? "content match" : "no match / too short", rt });

      console.log(`[${id}] tools=${toolsUsed} rt=${rt}ms pass=${pass}`);
      console.log(`  answer: ${response.slice(0, 200)}`);

      expect(pass, `C/${id} — answer does not match. Answer: ${response.slice(0, 200)}`).toBe(true);
    });
  }
});

test.afterAll(async () => {
  ensureDir(RESULTS_DIR);
  const stamp = Date.now();
  const jsonPath = path.join(RESULTS_DIR, `online-proof-${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf-8");
  const bPass = results.filter((r) => r.section === "B" && r.semanticPass).length;
  const cPass = results.filter((r) => r.section === "C" && r.semanticPass).length;
  const bTotal = results.filter((r) => r.section === "B").length;
  const cTotal = results.filter((r) => r.section === "C").length;
  console.log(`\n── ONLINE PROOF SUMMARY ──`);
  console.log(`Section B (weather): ${bPass}/${bTotal}`);
  console.log(`Section C (non-weather): ${cPass}/${cTotal}`);
  console.log(`Results: ${jsonPath}`);
});
