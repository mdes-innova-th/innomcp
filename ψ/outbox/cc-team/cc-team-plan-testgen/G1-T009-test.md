<!-- cc-team deliverable
 group: G1 (Generate jest unit tests for untested innomcp-node modules (batch 1))
 member: T009 role=test model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":4376,"completion_tokens":7307,"total_tokens":11683,"prompt_tokens_details":{"cached_tokens":4352,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3461,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 74s
 generated: 2026-06-13T10:54:13.059Z -->
```typescript
import {
  LOW_CONFIDENCE_FALLBACK_TEXT,
  renderGeneralFallbackMessage,
  renderThaiNumberText,
  countDaysUntilEndOfYear,
  renderGeneralSmokeAnswer,
} from '../src/services/generalGate';

describe('generalGate', () => {
  describe('LOW_CONFIDENCE_FALLBACK_TEXT', () => {
    test('should export the expected fallback string', () => {
      expect(LOW_CONFIDENCE_FALLBACK_TEXT).toBe(
        "ขอข้อมูลเพิ่มอีกนิดเพื่อให้ตอบได้แม่นยำขึ้น เช่น ระบุจังหวัดหรือหัวข้อที่ต้องการ"
      );
    });
  });

  describe('renderGeneralFallbackMessage', () => {
    test('should return the general fallback message string', () => {
      const result = renderGeneralFallbackMessage();
      expect(result).toContain("กำลังเรียบเรียงคำตอบให้นะครับ");
      expect(result).toContain("ระบุคำถามให้เฉพาะเจาะจงขึ้น");
    });
  });

  describe('renderThaiNumberText', () => {
    test('should render 0', () => {
      expect(renderThaiNumberText(0)).toBe("ศูนย์");
    });

    test('should render single digit numbers', () => {
      expect(renderThaiNumberText(1)).toBe("หนึ่ง");
      expect(renderThaiNumberText(5)).toBe("ห้า");
      expect(renderThaiNumberText(9)).toBe("เก้า");
    });

    test('should render tens correctly', () => {
      expect(renderThaiNumberText(10)).toBe("สิบ");
      expect(renderThaiNumberText(11)).toBe("สิบเอ็ด");
      expect(renderThaiNumberText(20)).toBe("ยี่สิบ");
      expect(renderThaiNumberText(21)).toBe("ยี่สิบเอ็ด");
      expect(renderThaiNumberText(30)).toBe("สามสิบ");
    });

    test('should render hundreds correctly', () => {
      expect(renderThaiNumberText(100)).toBe("หนึ่งร้อย");
      expect(renderThaiNumberText(111)).toBe("หนึ่งร้อยสิบเอ็ด");
      expect(renderThaiNumberText(200)).toBe("สองร้อย");
      expect(renderThaiNumberText(999)).toBe("เก้าร้อยเก้าสิบเก้า");
    });

    test('should render negative numbers', () => {
      expect(renderThaiNumberText(-5)).toBe("ลบห้า");
    });

    test('should render millions correctly', () => {
      expect(renderThaiNumberText(1000000)).toBe("หนึ่งล้าน");
      expect(renderThaiNumberText(2000000)).toBe("สองล้าน");
      expect(renderThaiNumberText(1000001)).toBe("หนึ่งล้านหนึ่ง");
    });

    test('should handle non-finite values', () => {
      expect(renderThaiNumberText(NaN)).toBe("NaN");
      expect(renderThaiNumberText(Infinity)).toBe("Infinity");
    });
  });

  describe('countDaysUntilEndOfYear', () => {
    test('should return 0 for Dec 31', () => {
      expect(countDaysUntilEndOfYear(new Date('2023-12-31'))).toBe(0);
    });

    test('should return 364 for Jan 1 on non-leap year', () => {
      expect(countDaysUntilEndOfYear(new Date('2023-01-01'))).toBe(364);
    });

    test('should return correct days for a mid-year date', () => {
      expect(countDaysUntilEndOfYear(new Date('2023-06-30'))).toBe(184);
    });
  });

  describe('renderGeneralSmokeAnswer', () => {
    test('should respond to short answer prompt about readiness', () => {
      expect(renderGeneralSmokeAnswer("ตอบสั้นคำเดียวว่า พร้อมใช้งาน")).toBe("พร้อมใช้งาน");
    });

    test('should respond to ping', () => {
      expect(renderGeneralSmokeAnswer("ping")).toBe("อยู่ครับ ระบบพร้อมใช้งาน");
    });

    test('should respond to system readiness in Thai', () => {
      expect(renderGeneralSmokeAnswer("ระบบพร้อมใช้งานไหม")).toBe("อยู่ครับ ระบบพร้อมใช้งาน");
    });

    test('should respond to who are you', () => {
      expect(renderGeneralSmokeAnswer("who are you")).toBe(
        "สวัสดีครับ ผมชื่อ Innova-bot เป็น AI ผู้ช่วยสำหรับระบบ InnoMCP ยินดีให้บริการครับ"
      );
    });

    test('should respond to what can you do', () => {
      expect(renderGeneralSmokeAnswer("what can you do")).toContain("ระบบนี้ช่วยได้หลายเรื่องครับ");
    });

    test('should return LOW_CONFIDENCE_FALLBACK_TEXT for non-Thai text', () => {
      expect(renderGeneralSmokeAnswer("hello world")).toBe(LOW_CONFIDENCE_FALLBACK_TEXT);
    });

    test('should respond to ภาคกลาง', () => {
      expect(renderGeneralSmokeAnswer("ภาคกลางมีจังหวัดอะไรบ้าง")).toContain("กรุงเทพมหานคร");
    });

    test('should respond to ภาคเหนือ', () => {
      expect(renderGeneralSmokeAnswer("ภาคเหนือมีกี่จังหวัด")).toContain("เชียงใหม่");
    });

    test('should respond to ภาคอีสาน', () => {
      expect(renderGeneralSmokeAnswer("ภาคอีสานประกอบด้วยจังหวัดอะไรบ้าง")).toContain("นครราชสีมา");
    });

    test('should respond to ภาคใต้', () => {
      expect(renderGeneralSmokeAnswer("ภาคใต้มีจังหวัดอะไรบ้าง")).toContain("ภูเก็ต");
    });

    test('should respond to ภาคตะวันออก', () => {
      expect(renderGeneralSmokeAnswer("ภาคตะวันออกมีจังหวัดอะไร")).toContain("ชลบุรี");
    });

    test('should respond to หาดใหญ่', () => {
      expect(renderGeneralSmokeAnswer("หาดใหญ่อยู่จังหวัดอะไร")).toContain("สงขลา");
    });

    test('should respond to NASA', () => {
      expect(renderGeneralSmokeAnswer("nasa ภาพวันนี้")).toContain("NASA Astronomy Picture of the Day");
    });

    test('should respond to WorldBank', () => {
      expect(renderGeneralSmokeAnswer("worldbank gdp")).toContain("World Bank");
    });

    test('should respond to RAG', () => {
      expect(renderGeneralSmokeAnswer("RAG คืออะไร")).toContain("RAG คือแนวทาง");
    });

    test('should respond to AI', () => {
      expect(renderGeneralSmokeAnswer("AI คืออะไร")).toContain("เทคโนโลยี");
    });

    test('should respond to KPI', () => {
      expect(renderGeneralSmokeAnswer("KPI คืออะไร")).toContain("Key Performance Indicator");
    });

    test('should respond to Docker', () => {
      expect(renderGeneralSmokeAnswer("docker คืออะไร")).toContain("container");
    });

    test('should respond to Machine Learning', () => {
      expect(renderGeneralSmokeAnswer("machine learning คืออะไร")).toContain("แมชชีนเลิร์นนิง");
    });
  });
});
```
