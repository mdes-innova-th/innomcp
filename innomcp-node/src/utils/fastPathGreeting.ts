// innomcp-node/src/utils/fastPathGreeting.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";

export type FastPathHit =
  | "greeting"
  | "identity"
  | "thanks"
  | "ok"
  | "emoji"
  | "ping";

export type FastPathResponse = {
  hit: FastPathHit;
  latencyTargetMs: number; // used by caller to prioritize short-circuit
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, any>;
};

type GreetingDict = {
  greeting: string[];
  identity: string[];
  thanks: string[];
  ok: string[];
  ping: string[];
  emoji: string[];
};

const DEFAULT_DICT: GreetingDict = {
  greeting: [
    // Thai
    "สวัสดี",
    "หวัดดี",
    "ดีครับ",
    "ดีค่ะ",
    "เฮลโหล",
    "ฮัลโหล",
    "ทักครับ",
    "ทักค่ะ",
    "ดีจ้า",
    "ไง",
    "ไงครับ",
    "ไงค่ะ",
    "โย่",
    "ว่าไง",
    "ยินดีที่ได้รู้จัก",
    // English
    "hello",
    "hi",
    "hey",
    "hiya",
    "good morning",
    "good afternoon",
    "good evening",
    "nice to meet you",
    // Chinese
    "你好",
    "您好",
    "嗨",
    "哈喽",
    // Japanese
    "こんにちは",
    "やあ",
    "もしもし",
    // Korean
    "안녕하세요",
    "안녕",
    // Spanish
    "hola",
    "buenos dias",
    "buenas",
    // French
    "bonjour",
    "salut",
    // German
    "hallo",
    "guten tag",
    // Italian
    "ciao",
    // Portuguese
    "olá",
    "oi",
    // Russian
    "привет",
    "здравствуйте",
    // Arabic
    "مرحبا",
    "السلام عليكم",
  ],
  identity: [
    "นายคือใคร",
    "คุณคือใคร",
    "แกคือใคร",
    "คุณชื่ออะไร",
    "ชื่ออะไร",
    "who are you",
    "what are you",
    "what is your name",
    "are you chatgpt",
    "are you an ai",
    "你是谁",
    "あなたは誰",
    "너는 누구야",
  ],
  thanks: [
    "ขอบคุณ",
    "ขอบใจ",
    "แต๊ง",
    "thank you",
    "thanks",
    "thx",
    "ty",
    "ありがとう",
    "谢谢",
    "감사합니다",
    "merci",
    "gracias",
  ],
  ok: ["โอเค", "โอเคครับ", "โอเคค่ะ", "ตกลง", "ได้", "ok", "okay", "k", "sure"],
  ping: [
    "ping",
    "test",
    "เทส",
    "ทดสอบ",
    "เช็คระบบ",
    "เช็คหน่อย",
    "ยังอยู่ไหม",
    "อยู่มั้ย",
    "ยังอยู่มั้ย",
    "alive",
  ],
  emoji: [
    "🙂",
    "😀",
    "😄",
    "😁",
    "😂",
    "🤣",
    "😊",
    "😉",
    "😍",
    "😘",
    "🤝",
    "👍",
    "👌",
    "🙏",
    "❤️",
    "💙",
    "💚",
    "💛",
    "💜",
    "🔥",
    "✨",
    "🎉",
    // Thai "555" style (NOT 999! - that's factorial/math)
    "555",
    "5555",
    "55555",
  ],
};

const MAX_TEXT_LEN = 300;

const ENV_DICT_PATH = process.env.FASTPATH_DICT_PATH || "";
const ENV_RELOAD_MS = Number(process.env.FASTPATH_DICT_RELOAD_MS || 30_000);

let dict: GreetingDict = { ...DEFAULT_DICT };
let dictHash = hashDict(dict);

function hashDict(d: GreetingDict) {
  return crypto.createHash("sha1").update(JSON.stringify(d)).digest("hex");
}

function safeNormalize(input: string) {
  const s = (input || "")
    .toString()
    .slice(0, MAX_TEXT_LEN)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  // remove typical punctuation but keep unicode letters/numbers
  return s.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, "").trim();
}

function containsAny(text: string, list: string[]) {
  if (!text) return false;
  for (const raw of list) {
    const key = safeNormalize(raw);
    if (!key) continue;
    
    // Exact match or starts with (for short greetings)
    if (text === key) return true;
    if (text.startsWith(key + " ")) return true;
    
    // Word boundary check to prevent false positives
    // e.g., "โอเค" should NOT match in "ไม่ได้อ้อ"
    const wordBoundaryRegex = new RegExp(`(^|\\s)${escapeRegex(key)}(\\s|$)`, 'i');
    if (wordBoundaryRegex.test(text)) return true;
  }
  return false;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isMostlyEmojiOrShortNoise(original: string) {
  const s = (original || "").trim();
  if (!s) return false;
  if (s.length <= 4 && /^[!?.,]+$/.test(s)) return true;

  // Detect if string contains no letters and is short
  const hasLetter =
    /[A-Za-z\u0E00-\u0E7F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(s);
  if (!hasLetter && s.length <= 12) return true;

  return false;
}

function loadDictFromFileIfAny() {
  if (!ENV_DICT_PATH) return;

  const p = path.isAbsolute(ENV_DICT_PATH)
    ? ENV_DICT_PATH
    : path.join(process.cwd(), ENV_DICT_PATH);

  try {
    if (!fs.existsSync(p)) return;

    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw);

    const merged: GreetingDict = {
      greeting: Array.isArray(parsed.greeting) ? parsed.greeting : dict.greeting,
      identity: Array.isArray(parsed.identity) ? parsed.identity : dict.identity,
      thanks: Array.isArray(parsed.thanks) ? parsed.thanks : dict.thanks,
      ok: Array.isArray(parsed.ok) ? parsed.ok : dict.ok,
      ping: Array.isArray(parsed.ping) ? parsed.ping : dict.ping,
      emoji: Array.isArray(parsed.emoji) ? parsed.emoji : dict.emoji,
    };

    const newHash = hashDict(merged);
    if (newHash !== dictHash) {
      dict = merged;
      dictHash = newHash;
    }
  } catch {
    // ignore (caller can log)
  }
}

// hot reload
if (ENV_DICT_PATH) {
  setInterval(() => {
    loadDictFromFileIfAny();
  }, ENV_RELOAD_MS).unref?.();
  loadDictFromFileIfAny();
}

export function detectFastPath(text: string): FastPathHit | null {
  const original = (text || "").toString().slice(0, MAX_TEXT_LEN);
  const normalized = safeNormalize(original);

  if (!normalized && isMostlyEmojiOrShortNoise(original)) return "emoji";

  // 🚨 NEW: Detect mixed intent (greeting + question)
  const hasMixedIntent = detectMixedIntent(original, normalized);
  if (hasMixedIntent) {
    return null; // Bypass to AI for complex queries
  }

  // 🚨 NEW: Length threshold - long text should go to AI
  if (normalized.length > 25 && original.includes("?")) {
    return null; // Questions with substantial content → AI
  }

  // Priority order (IMPORTANT: identity/questions BEFORE greeting)
  if (containsAny(normalized, dict.identity)) return "identity";
  if (containsAny(normalized, dict.thanks)) return "thanks";
  if (containsAny(normalized, dict.ping)) return "ping";
  if (containsAny(normalized, dict.ok)) return "ok";
  if (containsAny(normalized, dict.greeting)) return "greeting";

  // quick emoji / laugh codes (but NOT factorial patterns like 999!)
  if (containsAny(safeNormalize(original), dict.emoji)) return "emoji";
  if (/^5{3,}$/.test(original.trim())) return "emoji"; // "555", "5555" only

  return null;
}

/**
 * Detect mixed intent: greeting + question/complaint
 * Examples:
 * - "สวัสดี นายคือใคร" → greeting + identity question
 * - "สวัสดี แค่นี้ตอบไม่ได้อ้อ" → greeting + complaint
 * - "หวัดดี อากาศเป็นยังไง" → greeting + weather question
 */
function detectMixedIntent(original: string, normalized: string): boolean {
  const hasGreeting = containsAny(normalized, dict.greeting);
  if (!hasGreeting) return false;

  // Question indicators
  const questionWords = [
    "นาย", "คุณ", "แก", "เธอ", // pronouns suggesting questions
    "คือ", "ชื่อ", "อะไร", "ไหม", "มั้ย", "หรือ", "ยังไง", "อย่างไร",
    "who", "what", "where", "when", "why", "how",
    "เป็น", "ทำ", "ช่วย", "บอก", "แนะนำ"
  ];

  const hasQuestionWord = questionWords.some(word => 
    normalized.includes(safeNormalize(word))
  );

  const hasQuestionMark = original.includes("?");

  // Complaint/negative indicators
  const complaintWords = [
    "แค่นี้", "เท่านี้", "ไม่ได้", "ไม่มี", "ไม่", "ไม่ใช่",
    "can't", "cannot", "not", "no"
  ];

  const hasComplaint = complaintWords.some(word => 
    normalized.includes(safeNormalize(word))
  );

  // If greeting + (question OR complaint) → mixed intent
  return hasQuestionWord || hasQuestionMark || hasComplaint;
}

function nowThaiTimeString() {
  try {
    const d = new Date();
    return d.toLocaleString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function buildFastPathResponse(hit: FastPathHit): FastPathResponse {
  const t = nowThaiTimeString();
  switch (hit) {
    case "greeting":
      return {
        hit,
        latencyTargetMs: 900,
        content: [
          {
            type: "text",
            text: `สวัสดีครับ 😊 มีอะไรให้ช่วยไหม`,
          },
        ],
        structuredContent: { fastPath: true, type: "greeting" },
      };
    case "identity":
      return {
        hit,
        latencyTargetMs: 900,
        content: [
          {
            type: "text",
            text: `ผมคือผู้ช่วย AI ในระบบ INNOMCP ครับ ช่วยได้ทั้งงาน IT/โค้ด/ข้อมูล/เครื่องมือ MCP — บอกโจทย์มาได้เลย 😊`,
          },
        ],
        structuredContent: { fastPath: true, type: "identity" },
      };
    case "thanks":
      return {
        hit,
        latencyTargetMs: 900,
        content: [{ type: "text", text: "ยินดีครับ 🙏 ถ้าต้องการให้ช่วยต่อ บอกได้เลย" }],
        structuredContent: { fastPath: true, type: "thanks" },
      };
    case "ok":
      return {
        hit,
        latencyTargetMs: 900,
        content: [{ type: "text", text: "โอเคครับ ✅ ไปต่อได้เลย" }],
        structuredContent: { fastPath: true, type: "ok" },
      };
    case "ping":
      return {
        hit,
        latencyTargetMs: 900,
        content: [{ type: "text", text: "อยู่ครับ ✅ ระบบพร้อมใช้งาน" }],
        structuredContent: { fastPath: true, type: "ping" },
      };
    case "emoji":
      return {
        hit,
        latencyTargetMs: 900,
        content: [{ type: "text", text: "😄 รับทราบครับ! อยากให้ช่วยเรื่องไหนต่อ?" }],
        structuredContent: { fastPath: true, type: "emoji" },
      };
    default:
      return {
        hit: "greeting",
        latencyTargetMs: 900,
        content: [{ type: "text", text: "สวัสดีครับ 😊" }],
        structuredContent: { fastPath: true, type: "greeting" },
      };
  }
}

export function maybeFastPath(text: string): FastPathResponse | null {
  const hit = detectFastPath(text);
  if (!hit) return null;
  return buildFastPathResponse(hit);
}

// Optional: expose dict hash for diagnostics
export function getFastPathDictInfo() {
  return {
    sourceFile: ENV_DICT_PATH || null,
    reloadMs: ENV_RELOAD_MS,
    hash: dictHash,
    counts: {
      greeting: dict.greeting.length,
      identity: dict.identity.length,
      thanks: dict.thanks.length,
      ok: dict.ok.length,
      ping: dict.ping.length,
      emoji: dict.emoji.length,
    },
  };
}
