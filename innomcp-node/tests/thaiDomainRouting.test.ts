// FILE: innomcp-node/tests/thaiDomainRouting.test.ts
// Phase 2: Unit tests for Thai History / Law / Religion routing detectors

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
  it("detects: พระนเรศวร", () => expect(looksLikeThaiHistoryQuery("พระนเรศวรมหาราชเป็นใคร")).toBe(true));
  it("detects: อยุธยา", () => expect(looksLikeThaiHistoryQuery("อยุธยาเป็นเมืองหลวงสมัยใด")).toBe(true));
  it("detects: ประวัติศาสตร์ไทย", () => expect(looksLikeThaiHistoryQuery("ประวัติศาสตร์ไทยสมัยอยุธยา")).toBe(true));
  it("detects: ราชวงศ์จักรี", () => expect(looksLikeThaiHistoryQuery("ราชวงศ์จักรีเริ่มต้นเมื่อไหร่")).toBe(true));
  it("detects: รัชกาลที่ 5", () => expect(looksLikeThaiHistoryQuery("รัชกาลที่ 5 ทรงทำอะไรบ้าง")).toBe(true));
  it("negative: อากาศ", () => expect(looksLikeThaiHistoryQuery("อากาศวันนี้เป็นไง")).toBe(false));
  it("negative: geo", () => expect(looksLikeThaiHistoryQuery("กรุงเทพอยู่ภาคไหน")).toBe(false));
  it("negative: empty", () => expect(looksLikeThaiHistoryQuery("")).toBe(false));
});

describe("looksLikeThaiLawQuery", () => {
  it("detects: มาตรา 112", () => expect(looksLikeThaiLawQuery("มาตรา 112 คืออะไร")).toBe(true));
  it("detects: กฎหมายอาญา", () => expect(looksLikeThaiLawQuery("กฎหมายอาญามาตรา 288")).toBe(true));
  it("detects: พ.ร.บ.คอมฯ", () => expect(looksLikeThaiLawQuery("พ.ร.บ.คอมพิวเตอร์มาตราไหนบ้าง")).toBe(true));
  it("detects: จำคุก", () => expect(looksLikeThaiLawQuery("โทษจำคุกสูงสุดคือเท่าไหร่")).toBe(true));
  it("detects: ผิดกฎหมาย", () => expect(looksLikeThaiLawQuery("สิ่งนี้ผิดกฎหมายไหม")).toBe(true));
  it("negative: วัด", () => expect(looksLikeThaiLawQuery("วัดพระแก้วอยู่ที่ไหน")).toBe(false));
  it("negative: อากาศ", () => expect(looksLikeThaiLawQuery("อากาศพรุ่งนี้")).toBe(false));
  it("negative: empty", () => expect(looksLikeThaiLawQuery("")).toBe(false));
});

describe("looksLikeThaiReligionQuery", () => {
  it("detects: วัดพระแก้ว", () => expect(looksLikeThaiReligionQuery("วัดพระแก้วอยู่ที่ไหน")).toBe(true));
  it("detects: วิสาขบูชา", () => expect(looksLikeThaiReligionQuery("วิสาขบูชาคืออะไร")).toBe(true));
  it("detects: พระพุทธ", () => expect(looksLikeThaiReligionQuery("พระพุทธรูปองค์ใหญ่ที่สุด")).toBe(true));
  it("detects: บวช", () => expect(looksLikeThaiReligionQuery("การบวชในพุทธศาสนา")).toBe(true));
  it("negative: กฎหมาย", () => expect(looksLikeThaiReligionQuery("กฎหมายอาญา")).toBe(false));
  it("negative: อากาศภูเก็ต", () => expect(looksLikeThaiReligionQuery("อากาศภูเก็ต")).toBe(false));
  it("negative: empty", () => expect(looksLikeThaiReligionQuery("")).toBe(false));
});

describe("getThaiKnowledgeDomainTool", () => {
  it("routes law: มาตรา 288", () => {
    const r = getThaiKnowledgeDomainTool("มาตรา 288 โทษฆ่าคนคือเท่าไหร่");
    expect(r).not.toBeNull();
    expect(r!.toolName).toBe("thai_law_tool");
    expect(r!.domain).toBe("law");
  });
  it("routes religion: วัดอรุณ", () => {
    const r = getThaiKnowledgeDomainTool("วัดอรุณอยู่ที่ไหน");
    expect(r).not.toBeNull();
    expect(r!.toolName).toBe("thai_religion_tool");
    expect(r!.domain).toBe("religion");
  });
  it("routes history: อยุธยา", () => {
    const r = getThaiKnowledgeDomainTool("อยุธยาสมัยใด");
    expect(r).not.toBeNull();
    expect(r!.toolName).toBe("thai_history_tool");
    expect(r!.domain).toBe("history");
  });
  it("returns null for: อากาศวันนี้", () => {
    expect(getThaiKnowledgeDomainTool("อากาศวันนี้เป็นไง")).toBeNull();
  });
  it("returns null for: 2+2", () => {
    expect(getThaiKnowledgeDomainTool("2+2 เท่ากับเท่าไหร่")).toBeNull();
  });
});
