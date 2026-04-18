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
