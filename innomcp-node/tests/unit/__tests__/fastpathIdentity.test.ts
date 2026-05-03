/**
 * FastPath Identity & Capability Phrasing Tests
 * Verifies consistent behavior across all required identity/capability phrasings.
 */

import { detectFastPath, buildFastPathResponse, FastPathHit } from "../../../src/utils/fastPathGreeting";
import { isIdentityQuestion, isCapabilityQuestion, analyzeIntent } from "../../../src/fastpath/intentGate";
import { renderGeneralSmokeAnswer } from "../../../src/services/generalGate";

// ============================================================
// A) FastPath Dictionary Detection — identity phrases
// ============================================================

describe("FastPath identity detection", () => {
  const identityPhrases = [
    "คุณชื่ออะไร",
    "คุณคือใคร",
    "เป็นใคร",
    "what is your name",
    "who are you",
    "ชื่ออะไร",
    "นายคือใคร",
  ];

  test.each(identityPhrases)("detectFastPath('%s') returns 'identity'", (phrase) => {
    const hit = detectFastPath(phrase);
    expect(hit).toBe("identity");
  });

  test("identity response includes 'Innova-bot'", () => {
    const resp = buildFastPathResponse("identity");
    expect(resp.content[0].text).toContain("Innova-bot");
  });
});

// ============================================================
// B) FastPath Dictionary Detection — capability phrases
// ============================================================

describe("FastPath capability detection", () => {
  const capabilityPhrases = [
    "ทำอะไรได้บ้าง",
    "ช่วยอะไรได้บ้าง",
    "what can you do",
  ];

  test.each(capabilityPhrases)("detectFastPath('%s') returns 'capability'", (phrase) => {
    const hit = detectFastPath(phrase);
    expect(hit).toBe("capability");
  });

  test("capability response lists tools", () => {
    const resp = buildFastPathResponse("capability");
    expect(resp.content[0].text).toContain("weather");
    expect(resp.content[0].text).toContain("calculator");
  });
});

// ============================================================
// C) Intent Gate — identity/capability not bypassed
// ============================================================

describe("Intent Gate identity/capability routing", () => {
  const identityPhrases = [
    "คุณชื่ออะไร",
    "คุณคือใคร",
    "เป็นใคร",
    "what is your name",
    "who are you",
  ];

  test.each(identityPhrases)("isIdentityQuestion('%s') returns true", (phrase) => {
    expect(isIdentityQuestion(phrase)).toBe(true);
  });

  test.each(identityPhrases)("analyzeIntent('%s').shouldBypass is false", (phrase) => {
    const result = analyzeIntent(phrase);
    expect(result.shouldBypass).toBe(false);
  });

  const capabilityPhrases = [
    "ทำอะไรได้บ้าง",
    "ช่วยอะไรได้บ้าง",
    "what can you do",
  ];

  test.each(capabilityPhrases)("isCapabilityQuestion('%s') returns true", (phrase) => {
    expect(isCapabilityQuestion(phrase)).toBe(true);
  });

  test.each(capabilityPhrases)("analyzeIntent('%s').shouldBypass is false", (phrase) => {
    const result = analyzeIntent(phrase);
    expect(result.shouldBypass).toBe(false);
  });
});

// ============================================================
// D) GeneralGate smoke answers — identity/capability
// ============================================================

describe("GeneralGate deterministic identity/capability answers", () => {
  const identityCases: [string, string][] = [
    ["คุณชื่ออะไร", "Innova-bot"],
    ["คุณคือใคร", "Innova-bot"],
    ["เป็นใคร", "Innova-bot"],
    ["what is your name", "Innova-bot"],
    ["who are you", "Innova-bot"],
  ];

  test.each(identityCases)("renderGeneralSmokeAnswer('%s') contains '%s'", (input, expected) => {
    const answer = renderGeneralSmokeAnswer(input);
    expect(answer).toContain(expected);
  });

  const capabilityCases: [string, string][] = [
    ["ทำอะไรได้บ้าง", "weather"],
    ["ช่วยอะไรได้บ้าง", "weather"],
    ["what can you do", "weather"],
  ];

  test.each(capabilityCases)("renderGeneralSmokeAnswer('%s') contains '%s'", (input, expected) => {
    const answer = renderGeneralSmokeAnswer(input);
    expect(answer).toContain(expected);
  });

  const opsCases: [string, string][] = [
    ["ตอบคำเดียวว่า พร้อมใช้งาน", "พร้อมใช้งาน"],
    ["backend ยังอยู่ไหม", "พร้อมใช้งาน"],
    ["ระบบพร้อมใช้งานหรือไม่", "พร้อมใช้งาน"],
  ];

  test.each(opsCases)("renderGeneralSmokeAnswer('%s') contains '%s'", (input, expected) => {
    const answer = renderGeneralSmokeAnswer(input);
    expect(answer).toContain(expected);
  });
});

describe("FastPath operational status detection", () => {
  const pingCases = [
    "ping",
    "backend ยังอยู่ไหม",
    "ระบบพร้อมใช้งานหรือไม่",
  ];

  test.each(pingCases)("detectFastPath('%s') returns 'ping'", (phrase) => {
    expect(detectFastPath(phrase)).toBe("ping");
  });
});

describe("GeneralGate tech knowledge answers stay Thai-led", () => {
  const techCases: Array<[string, string[]]> = [
    ["machine learning คืออะไร อธิบายเป็นภาษาไทย", ["การเรียนรู้", "ข้อมูล", "โมเดล"]],
    ["ช่วยอธิบาย machine learning แบบภาษาคนให้หน่อย", ["การเรียนรู้", "ตัวอย่าง", "เข้าใจง่าย"]],
    ["TCP/IP คืออะไร ขอคำอธิบายสั้นๆ เป็นภาษาไทย", ["โปรโตคอล", "เครือข่าย", "อินเทอร์เน็ต"]],
    ["Python และ JavaScript ต่างกันอย่างไร", ["ภาษาโปรแกรม", "ไวยากรณ์", "เว็บ"]],
  ];

  test.each(techCases)("renderGeneralSmokeAnswer('%s') is Thai-led and grounded", (input, expectedPhrases) => {
    const answer = renderGeneralSmokeAnswer(input);
    expect(/^[A-Za-z]/.test(answer.trim())).toBe(false);
    for (const phrase of expectedPhrases) {
      expect(answer).toContain(phrase);
    }
  });
});

// ============================================================
// E) Identity not hijacked by emoji/greeting fallback
// ============================================================

describe("Identity not hijacked by greeting/emoji", () => {
  test("'สวัสดี คุณคือใคร' should NOT return greeting", () => {
    const hit = detectFastPath("สวัสดี คุณคือใคร");
    // Mixed intent: greeting + identity question → should bypass to AI (null) or identity, NOT greeting
    expect(hit).not.toBe("greeting");
    expect(hit).not.toBe("emoji");
  });

  test("'hello what is your name' should NOT return greeting", () => {
    const hit = detectFastPath("hello what is your name");
    expect(hit).not.toBe("greeting");
    expect(hit).not.toBe("emoji");
  });
});
