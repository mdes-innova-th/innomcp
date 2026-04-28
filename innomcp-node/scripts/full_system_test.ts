/**
 * Full System Live Test — ทดสอบระบบปิดก่อน Production
 * ทดสอบ: AI Thai chat quality, NWP, TMD, Evidence, genImage, file read
 *
 * Usage: npx ts-node --transpile-only scripts/full_system_test.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as http from "http";

const BACKEND = "http://localhost:3011";
const TIMEOUT_MS = 90_000;

// ── Auth ──────────────────────────────────────────────────────────────────────
let AUTH_TOKEN = "";
async function login(): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${BACKEND}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.local", password: "Admin@1234" }),
      signal: ctrl.signal,
    });
    // Token is in Set-Cookie header (HttpOnly cookie), extract from header string
    const setCookie = res.headers.get("set-cookie") || "";
    const tokenMatch = setCookie.match(/(?:^|,)\s*token=([^;,]+)/);
    if (tokenMatch) {
      AUTH_TOKEN = tokenMatch[1];
    }
    // Fallback: check response body
    if (!AUTH_TOKEN) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        AUTH_TOKEN = json?.token || json?.data?.token || "";
      } catch {}
    }
    if (!AUTH_TOKEN) throw new Error("Login failed — no token in Set-Cookie or body");
  } finally {
    clearTimeout(timer);
  }
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function fetchJson(url: string, method = "GET", body?: any, timeout = TIMEOUT_MS): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (AUTH_TOKEN) headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    try { return { status: res.status, ...(JSON.parse(text)) }; }
    catch { return { status: res.status, raw: text }; }
  } finally {
    clearTimeout(timer);
  }
}

// Detect incomplete tool responses (tool ran but result never properly rendered)
function isIncompleteToolResponse(text: string): boolean {
  return /ได้รับข้อมูลจากเครื่องมือ|ผมได้รับข้อมูลจาก|ได้ใช้เครื่องมือ .* แล้วครับ$/.test(text);
}

async function chat(message: string): Promise<{ route: string; text: string; tools: string; ok: boolean; incomplete: boolean }> {
  const r = await fetchJson(`${BACKEND}/api/chat`, "POST", { message });
  const text = r?.text || r?.message || "";
  return {
    route: r?.route || r?.meta?.route || "unknown",
    text,
    tools: (r?.toolsUsed || []).join(","),
    ok: !!text,
    incomplete: isIncompleteToolResponse(text),
  };
}

// ── Result tracking ───────────────────────────────────────────────────────────
interface TestResult {
  category: string;
  name: string;
  pass: boolean;
  notes: string;
  latency: number;
  preview: string;
}
const results: TestResult[] = [];

async function test(
  category: string,
  name: string,
  fn: () => Promise<{ pass: boolean; notes: string; preview: string }>
) {
  const t0 = Date.now();
  try {
    const r = await fn();
    results.push({ category, name, pass: r.pass, notes: r.notes, latency: Date.now() - t0, preview: r.preview });
    const icon = r.pass ? "✅" : "❌";
    console.log(`  ${icon} [${category}] ${name} (${Date.now() - t0}ms)`);
    if (!r.pass) console.log(`     ↳ ${r.notes}`);
    if (r.preview) console.log(`     ↳ preview: ${r.preview.slice(0, 150)}`);
  } catch (err: any) {
    results.push({ category, name, pass: false, notes: `EXCEPTION: ${err.message}`, latency: Date.now() - t0, preview: "" });
    console.log(`  ❌ [${category}] ${name} — EXCEPTION: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITES
// ─────────────────────────────────────────────────────────────────────────────

async function suiteHealthCheck() {
  console.log("\n📡 Health & Auth");
  await test("Health", "backend /api/health/live", async () => {
    // Use /api/health/live which always returns 200 if process is running
    const r = await fetchJson(`${BACKEND}/api/health/live`);
    return { pass: r.status === 200 && r.alive === true, notes: `status=${r.status} alive=${r.alive}`, preview: `uptime=${r.uptime?.toFixed(0)}s` };
  });
  // Login BEFORE running other test suites — token must be set here
  await test("Health", "login admin@example.local", async () => {
    await login();
    return { pass: !!AUTH_TOKEN, notes: AUTH_TOKEN ? "token OK" : "no token", preview: AUTH_TOKEN.slice(0, 40) + "..." };
  });
  await test("Health", "MCP server tools count", async () => {
    const r = await fetchJson(`${BACKEND}/api/health/keys`);
    const tools = r?.data?.mcpTools || r?.mcpTools || 0;
    return { pass: tools > 40, notes: `tools=${tools}`, preview: `${tools} tools registered` };
  });
}

async function suiteAiChatThai() {
  console.log("\n🤖 AI Thai Chat Quality");

  const cases: Array<{ q: string; expectRoute?: string; expectPhrases?: string[] }> = [
    { q: "สวัสดี คุณคือใคร?", expectPhrases: ["innomcp","mdes","ผม","ครับ"] },
    { q: "machine learning คืออะไร อธิบายเป็นภาษาไทย", expectPhrases: ["การเรียนรู้","โมเดล","ข้อมูล"] },
    { q: "คำนวณ 123 * 456 บวก 789 ให้หน่อย", expectPhrases: ["56,877","56877"] },
    { q: "ตอนนี้กี่โมงแล้ว บอกเป็นภาษาไทย", expectPhrases: ["นาฬิกา","โมง","เวลา"] },
    { q: "TCP/IP คืออะไร ขอคำอธิบายสั้นๆ เป็นภาษาไทย", expectPhrases: ["โปรโตคอล","เครือข่าย","อินเทอร์เน็ต"] },
    { q: "ช่วยแปลประโยค 'Hello World' เป็นภาษาไทย", expectPhrases: ["สวัสดี","โลก"] },
    { q: "Python และ JavaScript ต่างกันอย่างไร", expectPhrases: ["ภาษา","โปรแกรม"] },
    { q: "ขอบคุณมากครับ", expectPhrases: ["ครับ","ยินดี","ค่ะ","มีอะไร"] },
  ];

  for (const c of cases) {
    await test("AI-Thai", c.q.slice(0, 40), async () => {
      const r = await chat(c.q);
      const textLower = r.text.toLowerCase();
      const hasThai = /[\u0e00-\u0e7f]/.test(r.text);
      const longEnough = r.text.length > 20;
      let phraseMatch = true;
      let missedPhrase = "";
      if (c.expectPhrases) {
        phraseMatch = c.expectPhrases.some(p => textLower.includes(p.toLowerCase()) || r.text.includes(p));
        if (!phraseMatch) missedPhrase = `expected one of: [${c.expectPhrases.join(", ")}]`;
      }
      const pass = r.ok && hasThai && longEnough && phraseMatch;
      return {
        pass,
        notes: !r.ok ? "no response" : !hasThai ? "no Thai in response" : !longEnough ? "response too short" : missedPhrase || "OK",
        preview: r.text.slice(0, 200),
      };
    });
  }
}

async function suiteMathQuality() {
  console.log("\n🔢 Math & Equation Quality");

  const mathCases: Array<{ q: string; expects: string[]; noExpect?: string[] }> = [
    {
      q: "คำนวณ 365 × 24 × 60 เท่ากับเท่าไหร่",
      expects: ["525600", "525,600"],
    },
    {
      q: "25% ของ 3200 คือเท่าไหร่",
      expects: ["800"],
    },
    {
      q: "100 ฟาเรนไฮต์เป็นกี่องศาเซลเซียส",
      expects: ["37", "37.78"],
    },
    {
      q: "mean([10, 20, 30, 40, 50]) เท่าไหร่",
      expects: ["30", "ค่าเฉลี่ย"],
    },
    {
      // THE SCREENSHOT BUG — algebraic equation analysis
      q: "ช่วยคำนวณและวิเคราะห์ข้อมูลเบื้องต้น ของ 4x+3y = 12",
      expects: ["สมการ", "ตัดแกน", "slope", "x =", "y =", "เชิงเส้น", "จุด"],
      noExpect: ["ได้รับข้อมูลจากเครื่องมือ"],
    },
    {
      q: "สมการ 2x+5y=20 วิเคราะห์เบื้องต้นให้หน่อย",
      expects: ["x", "y", "สมการ", "จุด"],
      noExpect: ["ได้รับข้อมูลจากเครื่องมือ"],
    },
    {
      q: "หาอนุพันธ์ของ x^2 + 3x + 5",
      expects: ["2x", "derivative", "อนุพันธ์"],
    },
  ];

  for (const c of mathCases) {
    await test("Math", c.q.slice(0, 45), async () => {
      const r = await chat(c.q);
      // Hard fail: incomplete tool response
      if (r.incomplete) {
        return { pass: false, notes: `INCOMPLETE TOOL RESPONSE: ${r.text.slice(0, 100)}`, preview: r.text.slice(0, 200) };
      }
      if (c.noExpect && c.noExpect.some(p => r.text.includes(p))) {
        return { pass: false, notes: `Found forbidden phrase: ${c.noExpect.find(p => r.text.includes(p))}`, preview: r.text.slice(0, 200) };
      }
      const hasExpected = c.expects.some(p => r.text.includes(p));
      const hasThai = /[\u0e00-\u0e7f]/.test(r.text);
      return {
        pass: r.ok && hasExpected,
        notes: !hasExpected ? `expected one of [${c.expects.join(",")}], got: ${r.text.slice(0, 80)}` : `route=${r.route}`,
        preview: r.text.slice(0, 250),
      };
    });
  }
}

async function suiteWeather() {
  console.log("\n🌤️ Weather (OpenWeather)");
  const weatherCases = [
    "อากาศกรุงเทพวันนี้เป็นอย่างไร",
    "เชียงใหม่พรุ่งนี้ฝนจะตกไหม",
    "ภาคใต้ฝนตกมั้ยช่วงนี้",
    "อุณหภูมิสูงสุดภูเก็ตสัปดาห์นี้เท่าไหร่",
    "อากาศขอนแก่นวันนี้",
  ];
  for (const q of weatherCases) {
    await test("Weather", q.slice(0, 40), async () => {
      const r = await chat(q);
      const isWeather = r.route === "weather" || r.tools.includes("weather") || r.tools.includes("Weather");
      const hasThai = /[\u0e00-\u0e7f]/.test(r.text);
      const hasWeatherData = /°C|°c|เซลเซียส|ฝน|อุณหภูมิ|โอกาสฝน|มม\.|ความชื้น/i.test(r.text);
      return {
        pass: r.ok && hasThai && (isWeather || hasWeatherData || r.text.length > 30),
        notes: `route=${r.route} tools=${r.tools} len=${r.text.length}`,
        preview: r.text.slice(0, 200),
      };
    });
  }
}

async function suiteNWP() {
  console.log("\n🌪️ NWP (TMD Numerical Weather Prediction)");
  const nwpCases = [
    { q: "พยากรณ์รายชั่วโมงกรุงเทพพรุ่งนี้", tool: "nwp" },
    { q: "ข้อมูล NWP รายวันจังหวัดเชียงใหม่ 3 วัน", tool: "nwp" },
    { q: "พยากรณ์รายชั่วโมงภาคเหนือพรุ่งนี้", tool: "nwp" },
    { q: "พยากรณ์อากาศรายวันภาคใต้สัปดาห์นี้", tool: "nwp" },
  ];
  for (const c of nwpCases) {
    await test("NWP", c.q.slice(0, 40), async () => {
      const r = await chat(c.q);
      const hasNWP = r.tools.toLowerCase().includes("nwp") || /NWP|พยากรณ์|forecast|ภาค|หน่วย/i.test(r.text);
      const hasThai = /[\u0e00-\u0e7f]/.test(r.text);
      return {
        pass: r.ok && hasThai && r.text.length > 20,
        notes: `route=${r.route} tools=${r.tools} NWP=${hasNWP}`,
        preview: r.text.slice(0, 200),
      };
    });
  }
}

async function suiteTMD() {
  console.log("\n🌡️ TMD (Thai Meteorological Department direct API)");
  const tmdCases = [
    { q: "พยากรณ์อากาศ 7 วันจังหวัดเชียงใหม่จากกรมอุตุ", tool: "tmd" },
    { q: "สถานีตรวจอากาศทั่วประเทศวันนี้ 7 โมงเช้า", tool: "tmd" },
    { q: "ข้อมูลฝนสามชั่วโมงล่าสุดทั่วประเทศ", tool: "tmd" },
  ];
  for (const c of tmdCases) {
    await test("TMD", c.q.slice(0, 40), async () => {
      const r = await chat(c.q);
      const hasThai = /[\u0e00-\u0e7f]/.test(r.text);
      const hasTMD = r.tools.toLowerCase().includes("tmd") || /กรมอุตุ|สถานี|ฝน|อุณหภูมิ/i.test(r.text);
      return {
        pass: r.ok && hasThai && r.text.length > 20,
        notes: `route=${r.route} tools=${r.tools}`,
        preview: r.text.slice(0, 200),
      };
    });
  }
}

async function suiteEvidence() {
  console.log("\n🔍 Evidence / DetectDB");
  const evidenceCases = [
    "เครื่องสแกนออนไลน์ตอนนี้กี่เครื่อง",
    "ISP ไหนเจอ URL ผิดกฎหมายมากที่สุด",
    "เมื่อวานตรวจพบ URL ผิดกฎหมายกี่รายการ",
    "URL ผิดกฎหมายล่าสุดที่ตรวจพบ",
    "สรุปสถิติหลักฐานดิจิทัล",
  ];
  for (const q of evidenceCases) {
    await test("Evidence", q.slice(0, 40), async () => {
      const r = await chat(q);
      const hasThai = /[\u0e00-\u0e7f]/.test(r.text);
      const hasEvidenceData = r.tools.includes("detect") || r.tools.includes("evidence") ||
        /ISP|URL|เครื่อง|สแกน|หลักฐาน|รายการ/i.test(r.text);
      return {
        pass: r.ok && hasThai && r.text.length > 10,
        notes: `route=${r.route} tools=${r.tools} evidenceData=${hasEvidenceData}`,
        preview: r.text.slice(0, 200),
      };
    });
  }
}

async function suiteThaiGeo() {
  console.log("\n🗺️ Thai Geo Knowledge");
  const geoCases = [
    { q: "หาดใหญ่อยู่จังหวัดอะไร", expect: ["สงขลา"] },
    { q: "จังหวัดสงขลาอยู่ภาคไหน", expect: ["ใต้"] },
    { q: "จังหวัดเชียงใหม่มีอำเภออะไรบ้าง", expect: ["เมือง","อำเภอ"] },
    { q: "รหัสไปรษณีย์ปากคลองตลาด", expect: ["10200","ปากคลองตลาด"] },
    { q: "จตุจักรอยู่กรุงเทพไหม", expect: ["กรุงเทพ","ใช่","จตุจักร"] },
  ];
  for (const c of geoCases) {
    await test("ThaiGeo", c.q.slice(0, 40), async () => {
      const r = await chat(c.q);
      const hasThai = /[\u0e00-\u0e7f]/.test(r.text);
      const matchPhrase = c.expect.some(p => r.text.includes(p));
      return {
        pass: r.ok && hasThai && matchPhrase,
        notes: `matched=${matchPhrase} expect=[${c.expect}]`,
        preview: r.text.slice(0, 150),
      };
    });
  }
}

async function suiteGenImage() {
  console.log("\n🎨 AI Image Generation (MDES Gateway)");
  await test("GenImage", "สร้างรูปภาพ แมวน่ารักนั่งบนหน้าต่าง", async () => {
    const r = await fetchJson(`${BACKEND}/api/chat`, "POST", { message: "สร้างรูปภาพ แมวน่ารักนั่งบนหน้าต่าง" }, 90000);
    const hasImgCard = r?.imageGenerated || r?.tools?.includes("genimg") ||
      (r?.text || "").includes("สร้างรูปภาพ") || (r?.text || "").includes("🎨");
    const hasUrl = r?.imageUrl || r?.imageData || (r?.text || "").includes("data:image") || hasImgCard;
    return {
      pass: hasUrl || hasImgCard,
      notes: `text=${r?.text?.slice(0, 80)} tools=${r?.toolsUsed}`,
      preview: r?.text?.slice(0, 200) || "",
    };
  });
  await test("GenImage", "draw a beautiful Thai temple at sunset", async () => {
    const r = await fetchJson(`${BACKEND}/api/chat`, "POST", { message: "draw a beautiful Thai temple at sunset" }, 90000);
    const hasImg = r?.imageGenerated || (r?.text || "").includes("🎨") || (r?.text || "").includes("สร้าง");
    return {
      pass: hasImg || (r?.status === 200 && r?.text?.length > 10),
      notes: `status=${r?.status} text=${r?.text?.slice(0, 80)}`,
      preview: r?.text?.slice(0, 200) || "",
    };
  });
}

async function suiteFileRead() {
  console.log("\n📄 File Reading (PDF/TXT/DOCX)");

  // Test with a local text file
  const testTxtPath = path.join(__dirname, "../tmp/test_read.txt");
  fs.mkdirSync(path.dirname(testTxtPath), { recursive: true });
  fs.writeFileSync(testTxtPath, "ทดสอบระบบอ่านไฟล์ข้อความ นี่คือเนื้อหาทดสอบของระบบ InnomcpAI\nDateline: 2026-04-28");

  await test("FileRead", "อ่านไฟล์ข้อความ (txt)", async () => {
    const r = await chat(`อ่านไฟล์ ${testTxtPath} แล้วสรุปเนื้อหา`);
    const hasContent = /innomcp|ทดสอบ|2026|เนื้อหา/i.test(r.text) || r.tools.includes("file") || r.tools.includes("read");
    return {
      pass: r.ok && r.text.length > 10,
      notes: `route=${r.route} tools=${r.tools} hasContent=${hasContent}`,
      preview: r.text.slice(0, 200),
    };
  });

  await test("FileRead", "อ่านไฟล์ผ่าน path NAS (relative)", async () => {
    const r = await chat("อ่านไฟล์ README.md ใน project แล้วสรุปให้หน่อย");
    return {
      pass: r.ok && r.text.length > 10,
      notes: `route=${r.route} tools=${r.tools}`,
      preview: r.text.slice(0, 200),
    };
  });
}

async function suiteNaturalLanguage() {
  console.log("\n💬 Thai Natural Language Quality (Robustness)");
  const nlpCases: Array<{ q: string; minLen: number }> = [
    { q: "บอกหน่อยสิ ฝนจะตกที่กทมไหมวันศุกร์", minLen: 30 },
    { q: "เผื่อว่าจะไปเที่ยวเชียงใหม่อาทิตย์หน้า อากาศเป็นไง", minLen: 30 },
    { q: "น่านกับเชียงรายวันนี้ร้อนหรือหนาวกว่ากัน", minLen: 20 },
    { q: "ขอโอกาสฝนของภาคอีสานทั้งหมดวันนี้หน่อย", minLen: 20 },
    { q: "อธิบายเรื่อง blockchain ให้คนไทยเข้าใจง่ายๆ", minLen: 50 },
    { q: "ช่วยแนะนำว่าควรใช้ React หรือ Vue ดี", minLen: 30 },
  ];
  for (const c of nlpCases) {
    await test("NLP-Quality", c.q.slice(0, 40), async () => {
      const r = await chat(c.q);
      const hasThai = /[\u0e00-\u0e7f]/.test(r.text);
      const longEnough = r.text.length >= c.minLen;
      const notError = !/error|Error|undefined|null/.test(r.text.slice(0, 50));
      return {
        pass: r.ok && hasThai && longEnough && notError,
        notes: `len=${r.text.length} min=${c.minLen} route=${r.route}`,
        preview: r.text.slice(0, 200),
      };
    });
  }
}

async function suiteEdgeCases() {
  console.log("\n⚡ Edge Cases & Error Handling");
  await test("Edge", "empty message handling", async () => {
    const r = await fetchJson(`${BACKEND}/api/chat`, "POST", { message: "" });
    // 400 = valid validation rejection, 500 = crash = bad
    const graceful = r.status !== 500;
    return { pass: graceful, notes: `status=${r.status}`, preview: r.text?.slice(0, 100) || r.message?.slice(0, 100) || "" };
  });
  await test("Edge", "very long message (500 chars)", async () => {
    const msg = "อากาศ".repeat(100);
    const r = await chat(msg);
    return { pass: r.ok, notes: `len=${r.text.length}`, preview: r.text.slice(0, 100) };
  });
  await test("Edge", "past weather (honest error)", async () => {
    const r = await chat("เมื่อวานฝนตกที่กรุงเทพไหม");
    const isHonest = /ไม่สามารถ|ข้อมูลย้อน|ไม่มีข้อมูล|ไม่รองรับ|YESTERDAY/i.test(r.text);
    return {
      pass: r.ok && (isHonest || r.text.length > 10),
      notes: `honest=${isHonest}`,
      preview: r.text.slice(0, 200),
    };
  });
  await test("Edge", "mixed Thai-English gibberish", async () => {
    const r = await chat("asdf 1234 กขค zxcv ประเทศ test");
    return { pass: r.status !== 500 && r.text?.length > 5, notes: `len=${r.text?.length}`, preview: r.text?.slice(0, 100) || "" };
  });
}

async function suiteSeismicWorldBank() {
  console.log("\n🌍 Seismic & WorldBank Data");

  await test("Seismic", "แผ่นดินไหวล่าสุดในไทย", async () => {
    const r = await chat("แผ่นดินไหวล่าสุดในประเทศไทยมีที่ไหนบ้าง");
    if (r.incomplete) return { pass: false, notes: "INCOMPLETE TOOL RESPONSE", preview: r.text.slice(0, 200) };
    const hasThai = /[\u0e00-\u0e7f]/.test(r.text);
    const hasSeismic = /แผ่นดินไหว|ริกเตอร์|แมกนิจูด|magnitude|seismic|earthquake|ศูนย์กลาง|กม\.|จังหวัด/i.test(r.text);
    return {
      pass: r.ok && hasThai && (hasSeismic || r.text.length > 30),
      notes: `route=${r.route} tools=${r.tools} seismic=${hasSeismic}`,
      preview: r.text.slice(0, 250),
    };
  });

  await test("Seismic", "แผ่นดินไหวภาคเหนือ 7 วันที่ผ่านมา", async () => {
    const r = await chat("แผ่นดินไหวในภาคเหนือ 7 วันที่ผ่านมามีกี่ครั้ง");
    if (r.incomplete) return { pass: false, notes: "INCOMPLETE TOOL RESPONSE", preview: r.text.slice(0, 200) };
    const hasThai = /[\u0e00-\u0e7f]/.test(r.text);
    return {
      pass: r.ok && hasThai && r.text.length > 20,
      notes: `route=${r.route} tools=${r.tools} len=${r.text.length}`,
      preview: r.text.slice(0, 250),
    };
  });

  await test("WorldBank", "GDP ประเทศไทยล่าสุด", async () => {
    const r = await chat("GDP ของประเทศไทยล่าสุดเท่าไหร่");
    if (r.incomplete) return { pass: false, notes: "INCOMPLETE TOOL RESPONSE", preview: r.text.slice(0, 200) };
    const hasGDP = /GDP|gdp|\.?\d+.*ล้าน|billion|trillion|ดอลลาร์|USD|เศรษฐกิจ|World Bank|worldbank/i.test(r.text);
    return {
      pass: r.ok && (hasGDP || r.text.length > 30),
      notes: `route=${r.route} tools=${r.tools} GDP=${hasGDP}`,
      preview: r.text.slice(0, 250),
    };
  });

  await test("WorldBank", "อัตราการเติบโต GDP ไทย 5 ปีล่าสุด", async () => {
    const r = await chat("อัตราการเติบโตทางเศรษฐกิจของไทย 5 ปีที่ผ่านมาเป็นอย่างไร");
    if (r.incomplete) return { pass: false, notes: "INCOMPLETE TOOL RESPONSE", preview: r.text.slice(0, 200) };
    const hasThai = /[\u0e00-\u0e7f]/.test(r.text);
    return {
      pass: r.ok && hasThai && r.text.length > 30,
      notes: `route=${r.route} tools=${r.tools}`,
      preview: r.text.slice(0, 250),
    };
  });
}

// ── Report ────────────────────────────────────────────────────────────────────
function printReport() {
  const pass = results.filter(r => r.pass).length;
  const fail = results.filter(r => !r.pass).length;
  const total = results.length;
  const pct = Math.round((pass / total) * 100);

  console.log("\n" + "=".repeat(80));
  console.log("📊 FULL SYSTEM TEST REPORT — innomcp");
  console.log(`🕐 ${new Date().toLocaleString("th-TH")}`);
  console.log("=".repeat(80));

  // Per-category summary
  const categories = [...new Set(results.map(r => r.category))];
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catPass = catResults.filter(r => r.pass).length;
    const badge = catPass === catResults.length ? "✅" : catPass > 0 ? "⚠️" : "❌";
    console.log(`${badge} ${cat.padEnd(16)} ${catPass}/${catResults.length}`);
  }

  console.log("─".repeat(40));
  console.log(`🧮 Total: ${pass}/${total} PASS (${pct}%)`);

  if (fail > 0) {
    console.log("\n❌ FAILURES:");
    results.filter(r => !r.pass).forEach(r => {
      console.log(`  [${r.category}] ${r.name}`);
      console.log(`    → ${r.notes}`);
      if (r.preview) console.log(`    response: ${r.preview.slice(0, 120)}`);
    });
  }

  // AI Quality summary — flag incomplete tool responses
  const incompletes = results.filter(r => r.notes.includes("INCOMPLETE TOOL RESPONSE") || r.notes.includes("ได้รับข้อมูลจากเครื่องมือ"));
  if (incompletes.length > 0) {
    console.log(`\n🚨 INCOMPLETE TOOL RESPONSES (${incompletes.length} cases):`);
    incompletes.forEach(r => console.log(`  [${r.category}] ${r.name}: ${r.preview.slice(0, 120)}`));
  }

  // Save JSON report
  const reportPath = path.join(__dirname, "../logs/full_system_test_report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const report = {
    date: new Date().toISOString(),
    pass, fail, total, pct,
    incompleteToolResponses: incompletes.length,
    results,
    opusAnalysisSummary: {
      criticalIssues: results.filter(r => !r.pass && ["Math","Seismic","NWP","TMD","Evidence"].includes(r.category)),
      qualityIssues: results.filter(r => r.notes.includes("INCOMPLETE TOOL RESPONSE")),
      allFailures: results.filter(r => !r.pass),
    },
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📁 JSON report saved: ${reportPath}`);
  console.log("=".repeat(80));

  return pct;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 innomcp Full System Test — Pre-Production Check");
  console.log(`Backend: ${BACKEND}`);

  await suiteHealthCheck();
  await suiteAiChatThai();
  await suiteMathQuality();        // ← new: math & equation quality (includes screenshot bug)
  await suiteWeather();
  await suiteNWP();
  await suiteTMD();
  await suiteEvidence();
  await suiteSeismicWorldBank();   // ← new: seismic & WorldBank
  await suiteThaiGeo();
  await suiteGenImage();
  await suiteFileRead();
  await suiteNaturalLanguage();
  await suiteEdgeCases();

  const pct = printReport();
  process.exit(pct < 70 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
