// FILE: innomcp-node/tests/thaiDomainRouting.test.ts
// Phase 2: Unit tests for Thai History / Law / Religion routing detectors
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

// Inline copies of the detector functions from chat.ts (additive, no import needed)
function looksLikeThaiHistoryQuery(text: string): boolean {
  const t = String(text || "");
  if (/(อากาศ|ฝน|พยากรณ์|weather|forecast|อุณหภูมิ|ความชื้น)/i.test(t)) return false;
  return /(ประวัติศาสตร์|กษัตริย์|สมัย|ราชวงศ์|รัชกาล|อยุธยา|สุโขทัย|พระนเรศวร|ยุทธหัตถี|ล้านนา|ธนบุรี|รัตนโกสินทร์|พ่อขุน|เจ้าเมือง|วีรบุรุษ|วีรสตรี|ประวัติ.*ไทย|ไทยสมัย|เหตุการณ์สำคัญ|ประวัติบุคคล)/i.test(t);
}

function looksLikeThaiLawQuery(text: string): boolean {
  const t = String(text || "");
  return /(กฎหมาย|มาตรา|พ\.ร\.บ\.|พระราชบัญญัติ|ประมวลกฎหมาย|โทษ|จำคุก|ปรับ|คดี|กระทำผิด|ผิดกฎหมาย|ลงโทษ|อาญา|แพ่ง|อาชญากรรม|บทลงโทษ|ข้อกฎหมาย|กฎหมายไทย)/i.test(t);
}

function looksLikeThaiReligionQuery(text: string): boolean {
  const t = String(text || "");
  if (/(อากาศ|ฝน|weather)/i.test(t)) return false;
  return /(วัด[^ๆ]|พระพุทธ|ศาสนา|นมัสการ|วิสาขบูชา|บวช|พุทธศาสนา|อิสลาม|คริสต์|สวดมนต์|ทำบุญ|พระสงฆ์|โบสถ์|มัสยิด|ศาลเจ้า|เทพ|พระเจ้า|พระธาตุ|พระวิหาร|เจดีย์|หลวงพ่อ)/i.test(t);
}

function getThaiKnowledgeDomainTool(text: string): { toolName: string; domain: string; label: string } | null {
  if (looksLikeThaiHistoryQuery(text)) return { toolName: "thai_history_tool", domain: "history", label: "ประวัติศาสตร์ไทย" };
  if (looksLikeThaiLawQuery(text)) return { toolName: "thai_law_tool", domain: "law", label: "กฎหมายไทย" };
  if (looksLikeThaiReligionQuery(text)) return { toolName: "thai_religion_tool", domain: "religion", label: "ศาสนาและวัด" };
  return null;
}

// ================================
// Tests
// ================================

describe("looksLikeThaiHistoryQuery", () => {
  it("detects: พระนเรศวร", () => assert.equal(looksLikeThaiHistoryQuery("พระนเรศวรมหาราชเป็นใคร"), true));
  it("detects: อยุธยา", () => assert.equal(looksLikeThaiHistoryQuery("อยุธยาเป็นเมืองหลวงสมัยใด"), true));
  it("detects: ประวัติศาสตร์ไทย", () => assert.equal(looksLikeThaiHistoryQuery("ประวัติศาสตร์ไทยสมัยอยุธยา"), true));
  it("detects: ราชวงศ์จักรี", () => assert.equal(looksLikeThaiHistoryQuery("ราชวงศ์จักรีเริ่มต้นเมื่อไหร่"), true));
  it("detects: รัชกาลที่ 5", () => assert.equal(looksLikeThaiHistoryQuery("รัชกาลที่ 5 ทรงทำอะไรบ้าง"), true));
  it("negative: อากาศ", () => assert.equal(looksLikeThaiHistoryQuery("อากาศวันนี้เป็นไง"), false));
  it("negative: geo", () => assert.equal(looksLikeThaiHistoryQuery("กรุงเทพอยู่ภาคไหน"), false));
  it("negative: empty", () => assert.equal(looksLikeThaiHistoryQuery(""), false));
});

describe("looksLikeThaiLawQuery", () => {
  it("detects: มาตรา 112", () => assert.equal(looksLikeThaiLawQuery("มาตรา 112 คืออะไร"), true));
  it("detects: กฎหมายอาญา", () => assert.equal(looksLikeThaiLawQuery("กฎหมายอาญามาตรา 288"), true));
  it("detects: พ.ร.บ.คอมฯ", () => assert.equal(looksLikeThaiLawQuery("พ.ร.บ.คอมพิวเตอร์มาตราไหนบ้าง"), true));
  it("detects: จำคุก", () => assert.equal(looksLikeThaiLawQuery("โทษจำคุกสูงสุดคือเท่าไหร่"), true));
  it("detects: ผิดกฎหมาย", () => assert.equal(looksLikeThaiLawQuery("สิ่งนี้ผิดกฎหมายไหม"), true));
  it("negative: วัด", () => assert.equal(looksLikeThaiLawQuery("วัดพระแก้วอยู่ที่ไหน"), false));
  it("negative: อากาศ", () => assert.equal(looksLikeThaiLawQuery("อากาศพรุ่งนี้"), false));
  it("negative: empty", () => assert.equal(looksLikeThaiLawQuery(""), false));
});

describe("looksLikeThaiReligionQuery", () => {
  it("detects: วัดพระแก้ว", () => assert.equal(looksLikeThaiReligionQuery("วัดพระแก้วอยู่ที่ไหน"), true));
  it("detects: วิสาขบูชา", () => assert.equal(looksLikeThaiReligionQuery("วิสาขบูชาคืออะไร"), true));
  it("detects: พระพุทธ", () => assert.equal(looksLikeThaiReligionQuery("พระพุทธรูปองค์ใหญ่ที่สุด"), true));
  it("detects: บวช", () => assert.equal(looksLikeThaiReligionQuery("การบวชในพุทธศาสนา"), true));
  it("negative: กฎหมาย", () => assert.equal(looksLikeThaiReligionQuery("กฎหมายอาญา"), false));
  it("negative: อากาศภูเก็ต", () => assert.equal(looksLikeThaiReligionQuery("อากาศภูเก็ต"), false));
  it("negative: empty", () => assert.equal(looksLikeThaiReligionQuery(""), false));
});

describe("getThaiKnowledgeDomainTool", () => {
  it("routes law: มาตรา 288", () => {
    const r = getThaiKnowledgeDomainTool("มาตรา 288 โทษฆ่าคนคือเท่าไหร่");
    assert.ok(r);
    assert.equal(r!.toolName, "thai_law_tool");
    assert.equal(r!.domain, "law");
  });
  it("routes religion: วัดอรุณ", () => {
    const r = getThaiKnowledgeDomainTool("วัดอรุณอยู่ที่ไหน");
    assert.ok(r);
    assert.equal(r!.toolName, "thai_religion_tool");
    assert.equal(r!.domain, "religion");
  });
  it("routes history: อยุธยา", () => {
    const r = getThaiKnowledgeDomainTool("อยุธยาสมัยใด");
    assert.ok(r);
    assert.equal(r!.toolName, "thai_history_tool");
    assert.equal(r!.domain, "history");
  });
  it("returns null for: อากาศวันนี้", () => {
    assert.equal(getThaiKnowledgeDomainTool("อากาศวันนี้เป็นไง"), null);
  });
  it("returns null for: 2+2", () => {
    assert.equal(getThaiKnowledgeDomainTool("2+2 เท่ากับเท่าไหร่"), null);
  });
});
