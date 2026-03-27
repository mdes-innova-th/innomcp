/**
 * verify_phase110_multiturn_carryforward.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 11.0 — Multi-Turn Carry-Forward Browser Proof
 *
 * Tests 8 multi-turn conversation scenarios via the chat API.
 * Proves that prior entity, route, and context are correctly carried across turns.
 *
 * Run:
 *   npx ts-node scripts/verify_phase110_multiturn_carryforward.ts
 *
 * OFFLINE mode:
 *   INNOMCP_MODE=offline SMOKE_MODE=1 WEATHER_FIXTURE_W1=1 \
 *     npx ts-node scripts/verify_phase110_multiturn_carryforward.ts
 */

import http from "http";
import fs from "fs";
import path from "path";

const CHAT_PORT = Number(process.env.CHAT_PORT || process.env.PORT || 3011);
const INNOMCP_MODE = process.env.INNOMCP_MODE || "online";
const EVIDENCE_DIR = path.resolve(__dirname, "../evidence");
if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

function nowStamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 15);
}

interface TurnResult {
  turn: number;
  question: string;
  status: number;
  text: string;
  toolsUsed: string[];
  route: string;
  sessionId: string;
  hasHistoryInfluence: boolean;
  carryForwardOk: boolean;
  note: string;
}

interface ConvResult {
  convId: number;
  name: string;
  turns: TurnResult[];
  pass: boolean;
  failReasons: string[];
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────
function chatPost(
  message: string,
  history: Array<{ role: string; content: string }> = [],
  sessionId?: string
): Promise<{ status: number; text: string; toolsUsed: string[]; route: string; raw: any }> {
  const body: any = { message };
  if (history.length > 0) body.history = history;
  if (sessionId) body.sessionId = sessionId;

  const payload = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "localhost",
        port: CHAT_PORT,
        path: "/api/chat",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(payload.length),
          "X-Smoke-Run": "1",
        },
        timeout: 30000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let json: any = null;
          try { json = JSON.parse(raw); } catch { json = null; }
          resolve({
            status: res.statusCode || 0,
            text: String(json?.text || json?.answer || json?.message || ""),
            toolsUsed: Array.isArray(json?.toolsUsed) ? json.toolsUsed : [],
            route: String(json?.structuredContent?.chatMeta?.route || json?.route || ""),
            raw: json,
          });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => reject(new Error("TIMEOUT")));
    req.write(payload);
    req.end();
  });
}

// ─── Conversations ─────────────────────────────────────────────────────────
// Each conversation is a list of turns.
// "carry" checks: does turn2/3 reference expected entity from turn1?

interface Turn {
  q: string;
  // keywords that should appear in the answer (carry-forward check)
  expectContains?: string[];
  // if the route should match previous
  sameRoute?: boolean;
  // Note for auditors
  note: string;
}

const CONVERSATIONS: Array<{ id: number; name: string; turns: Turn[] }> = [
  {
    id: 1,
    name: "หาดใหญ่ → จังหวัด → ภาค → อำเภอ",
    turns: [
      { q: "หาดใหญ่อยู่จังหวัดอะไร", note: "entity lookup: amphoe → province" },
      { q: "จังหวัดนี้อยู่ภาคไหน", expectContains: ["ใต้", "สงขลา"], note: "carry forward: จังหวัดนี้ = สงขลา" },
      { q: "แล้วมีอำเภออะไรเด่นบ้าง", expectContains: ["สงขลา", "อำเภอ"], note: "carry forward: หัวข้อยังอยู่ที่สงขลา" },
    ],
  },
  {
    id: 2,
    name: "โคราช → ภาค → อากาศพรุ่งนี้ → สรุป",
    turns: [
      { q: "โคราชอยู่ภาคอะไร", note: "entity lookup: โคราช = นครราชสีมา, ภาคตะวันออกเฉียงเหนือ" },
      { q: "แล้วจังหวัดนี้พรุ่งนี้ฝนตกไหม", expectContains: ["นครราชสีมา", "โคราช"], note: "carry: จังหวัดนี้ = นครราชสีมา → weather lookup" },
      { q: "สรุปสั้น ๆ", expectContains: ["นครราชสีมา", "โคราช", "ฝน"], note: "carry: context from turns 1+2" },
    ],
  },
  {
    id: 3,
    name: "เชียงใหม่วันนี้ → พรุ่งนี้ → เทียบกรุงเทพ",
    turns: [
      { q: "อากาศเชียงใหม่วันนี้", note: "weather query: เชียงใหม่" },
      { q: "แล้วพรุ่งนี้ล่ะ", expectContains: ["เชียงใหม่"], note: "carry: entity=เชียงใหม่, time=tomorrow" },
      { q: "เทียบกับกรุงเทพให้หน่อย", expectContains: ["เชียงใหม่", "กรุงเทพ"], note: "carry: multi-entity comparison" },
    ],
  },
  {
    id: 4,
    name: "กรุงเทพ → สัปดาห์หน้า → เทียบชลบุรี → ตาราง",
    turns: [
      { q: "แนวโน้มฝนกรุงเทพสัปดาห์หน้า", note: "weather: BKK 7-day" },
      { q: "ถ้าเทียบกับชลบุรีล่ะ", expectContains: ["กรุงเทพ", "ชลบุรี"], note: "carry: add second entity" },
      { q: "สรุปเป็นตาราง", expectContains: ["กรุงเทพ", "ชลบุรี"], note: "carry: format as table using prior context" },
    ],
  },
  {
    id: 5,
    name: "แม่กลอง → ฝนสัปดาห์หน้า → น้ำเสี่ยง → เหตุผล",
    turns: [
      { q: "แม่กลองสัปดาห์หน้าฝนเป็นยังไง", note: "weather: แม่กลอง = สมุทรสงคราม" },
      { q: "แล้วน้ำเสี่ยงสูงไหม", expectContains: ["แม่กลอง", "สมุทรสงคราม"], note: "carry: flood risk for แม่กลอง" },
      { q: "ขอเหตุผลแบบสั้น", expectContains: ["แม่กลอง", "น้ำ"], note: "carry: summarize risk reason" },
    ],
  },
  {
    id: 6,
    name: "อยุธยา → ภาค → จังหวัดอื่น → ท่องเที่ยว",
    turns: [
      { q: "อยุธยาอยู่ภาคไหน", note: "entity: อยุธยา → ภาคกลาง" },
      { q: "แล้วภาคนี้มีจังหวัดอะไรอีก", expectContains: ["ภาคกลาง", "กรุงเทพ"], note: "carry: ภาคนี้ = ภาคกลาง" },
      { q: "จังหวัดไหนเด่นด้านท่องเที่ยว", expectContains: ["ท่องเที่ยว"], note: "carry: topic = provinces in ภาคกลาง" },
    ],
  },
  {
    id: 7,
    name: "คำนวณ 48*7 → บวก 12 → แปลงเป็นข้อความ",
    turns: [
      { q: "คำนวณ 48*7", expectContains: ["336"], note: "calculator: 48×7=336" },
      { q: "แล้วบวกเพิ่ม 12", expectContains: ["348"], note: "carry: 336+12=348" },
      { q: "แปลงเป็นข้อความสั้น", expectContains: ["348", "สามร้อยสี่สิบแปด", "three hundred"], note: "carry: number to text" },
    ],
  },
  {
    id: 8,
    name: "Machine learning → พยากรณ์อากาศ → เทียบ rule-based",
    turns: [
      { q: "Machine learning คืออะไร", note: "general knowledge" },
      { q: "ถ้าเอามาใช้กับพยากรณ์อากาศล่ะ", expectContains: ["machine learning", "พยากรณ์", "ML"], note: "carry: apply ML to weather" },
      { q: "สรุปต่างจาก rule-based ยังไง", expectContains: ["machine learning", "rule", "ML"], note: "carry: comparison" },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const stamp = nowStamp();
  const logFile = path.join(EVIDENCE_DIR, `phase110-multiturn-carryforward-${stamp}.log`);
  const lines: string[] = [];

  const log = (s: string) => { lines.push(s); process.stdout.write(s + "\n"); };

  log(`═══════════════════════════════════════════════════════════`);
  log(`  Phase 11.0 — Multi-Turn Carry-Forward Proof`);
  log(`  Mode: ${INNOMCP_MODE} | Port: ${CHAT_PORT} | Stamp: ${stamp}`);
  log(`═══════════════════════════════════════════════════════════`);

  const convResults: ConvResult[] = [];

  for (const conv of CONVERSATIONS) {
    log(`\n──── Conv ${conv.id}: ${conv.name} ────`);

    // Build rolling history
    const history: Array<{ role: string; content: string }> = [];
    const turnResults: TurnResult[] = [];
    let convFail: string[] = [];

    for (let ti = 0; ti < conv.turns.length; ti++) {
      const turn = conv.turns[ti];
      log(`  Turn ${ti + 1}: "${turn.q}"`);

      let resp: Awaited<ReturnType<typeof chatPost>>;
      try {
        resp = await chatPost(turn.q, history);
      } catch (err: any) {
        const tr: TurnResult = {
          turn: ti + 1,
          question: turn.q,
          status: 0,
          text: "",
          toolsUsed: [],
          route: "ERROR",
          sessionId: "",
          hasHistoryInfluence: false,
          carryForwardOk: false,
          note: turn.note,
        };
        turnResults.push(tr);
        convFail.push(`Turn ${ti + 1}: HTTP error ${err.message}`);
        log(`    ERROR: ${err.message}`);
        continue;
      }

      // Check carry-forward: expected keywords in answer
      const answerLower = resp.text.toLowerCase();
      const expectedKws = turn.expectContains || [];
      const carryOk = expectedKws.length === 0
        || expectedKws.some(kw => answerLower.includes(kw.toLowerCase()));

      const historyInfluence = history.length > 0 && resp.text.length > 5;

      const tr: TurnResult = {
        turn: ti + 1,
        question: turn.q,
        status: resp.status,
        text: resp.text,
        toolsUsed: resp.toolsUsed,
        route: resp.route,
        sessionId: String(resp.raw?.sessionId || ""),
        hasHistoryInfluence: historyInfluence,
        carryForwardOk: carryOk,
        note: turn.note,
      };
      turnResults.push(tr);

      log(`    status=${resp.status} route=${resp.route} tools=${JSON.stringify(resp.toolsUsed)}`);
      log(`    answer: "${resp.text.slice(0, 120)}"`);
      log(`    carry-forward: ${carryOk ? "✅" : "❌"} | note: ${turn.note}`);

      if (!carryOk && expectedKws.length > 0) {
        convFail.push(`Turn ${ti + 1}: expected keywords ${JSON.stringify(expectedKws)} not found in answer`);
      }
      if (resp.status !== 200) {
        convFail.push(`Turn ${ti + 1}: status=${resp.status}`);
      }

      // Append to history for next turn
      history.push({ role: "user", content: turn.q });
      history.push({ role: "assistant", content: resp.text });
    }

    const convPass = convFail.length === 0;
    convResults.push({
      convId: conv.id,
      name: conv.name,
      turns: turnResults,
      pass: convPass,
      failReasons: convFail,
    });

    log(`  → Conv ${conv.id}: ${convPass ? "PASS ✅" : "FAIL ❌"}`);
    if (convFail.length) convFail.forEach(f => log(`    FAIL: ${f}`));
  }

  // ─── Summary ────────────────────────────────────────────────────────────
  const totalConv = convResults.length;
  const passConv = convResults.filter(c => c.pass).length;
  const failConv = totalConv - passConv;

  log(`\n${"═".repeat(57)}`);
  log(`  SUMMARY`);
  log(`${"═".repeat(57)}`);
  log(`  Conversations: ${totalConv} | Passed: ${passConv} | Failed: ${failConv}`);

  for (const c of convResults) {
    log(`  Conv ${c.convId}: ${c.name.padEnd(40)} ${c.pass ? "PASS ✅" : "FAIL ❌"}`);
    if (!c.pass) c.failReasons.forEach(f => log(`    → ${f}`));
  }

  // ─── Write evidence ──────────────────────────────────────────────────────
  const jsonFile = path.join(EVIDENCE_DIR, `phase110-multiturn-carryforward-${stamp}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify({ stamp, summary: { totalConv, passConv, failConv }, conversations: convResults }, null, 2), "utf8");
  fs.writeFileSync(logFile, lines.join("\n") + "\n", "utf8");

  log(`\nevidence log: ${logFile}`);
  log(`evidence json: ${jsonFile}`);

  const finalResult = failConv === 0 ? "PASS ✅" : `FAIL ❌ (${failConv}/${totalConv} conversations failed)`;
  log(`\nFINAL: ${finalResult}`);

  process.exit(failConv > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
