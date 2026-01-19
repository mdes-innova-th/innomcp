import { z } from "zod";
import Tesseract from "tesseract.js";

/**
 * OCR Tool - อ่านข้อความจากภาพ
 * Uses Tesseract.js (ฟรี, offline capable)
 * รองรับหลายภาษา: eng, tha, jpn, chi_sim, etc.
 */

export const ocrToolSchema = z.object({
  imageData: z.string().describe("ข้อมูลภาพในรูปแบบ base64 หรือ URL ของรูปภาพ"),
  language: z.string().optional().default("eng").describe("ภาษาที่ต้องการจดจำ: eng (อังกฤษ), tha (ไทย), jpn (ญี่ปุ่น), chi_sim (จีน), etc. Default: eng"),
  confidence: z.number().optional().default(50).describe("ค่าความมั่นใจขั้นต่ำ (0-100). Default: 50"),
});

export type OCRInput = z.infer<typeof ocrToolSchema>;

export const ocrTool = {
  name: "ocrTool",
  description: `
หน้าที่: อ่านข้อความจากภาพด้วย OCR (Optical Character Recognition)
ใช้เมื่อ:
- ต้องการแปลงรูปภาพเป็นข้อความ
- อ่านข้อมูลจาก ID card, บัตรต่างๆ
- Scan เอกสาร, ใบเสร็จ
- แปลง screenshot เป็นข้อความ
- อ่านป้าย, ตัวอักษรในรูป

คุณสมบัติ:
- ฟรี 100% (ไม่ต้อง API key)
- Offline capable
- รองรับหลายภาษา: ไทย, อังกฤษ, ญี่ปุ่น, จีน, เกาหลี, ฯลฯ
- ระบุ confidence level ได้

รองรับภาษา:
- eng: อังกฤษ
- tha: ไทย
- jpn: ญี่ปุ่น
- chi_sim: จีนตัวย่อ
- chi_tra: จีนตัวเต็ม
- kor: เกาหลี
- ara: อาหรับ
- rus: รัสเซีย
- และอื่นๆ 100+ ภาษา

ตัวอย่าง:
- "อ่านข้อความในรูปนี้" (ภาษาอังกฤษ)
- "scan ข้อความภาษาไทยในภาพ"
- "OCR รูปนี้เป็นภาษาญี่ปุ่น"
- "อ่าน ID card"
- "แปลงใบเสร็จเป็นข้อความ"

หมายเหตุ:
- รูปที่คมชัด จดจำได้ดีกว่า
- ควรมีแสงเพียงพอ
- ข้อความควรตั้งตรง ไม่เอียงมาก
`,
  inputSchema: ocrToolSchema,

  execute: async (args: unknown) => {
    // Validate input
    const parsed = ocrToolSchema.safeParse(args);
    if (!parsed.success) {
      const errorText = JSON.stringify({
        success: false,
        error: "Invalid input",
        details: parsed.error.issues
      }, null, 2);
      return {
        content: [{ type: "text" as const, text: errorText }]
      };
    }

    const input = parsed.data;
    
    try {
      const { imageData, language = "eng", confidence = 50 } = input;

      // Validate image data
      if (!imageData || imageData.trim().length === 0) {
        throw new Error("กรุณาระบุข้อมูลภาพ (base64 หรือ URL)");
      }

      console.log(`[OCR Tool] Processing image with language: ${language}`);

      // Run Tesseract OCR
      const result: any = await Tesseract.recognize(
        imageData,
        language,
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`[OCR Progress] ${(m.progress * 100).toFixed(0)}%`);
            }
          }
        }
      );

      // Filter words by confidence
      const words = (result.data.words || []).filter((word: any) => word.confidence >= confidence);
      const lines = (result.data.lines || []).filter((line: any) => line.confidence >= confidence);

      // Extract text
      const fullText = result.data.text.trim();
      const avgConfidence = result.data.confidence;

      // Prepare result
      const ocrResult = {
        text: fullText,
        language,
        confidence: parseFloat(avgConfidence.toFixed(2)),
        wordsCount: words.length,
        linesCount: lines.length,
        words: words.map((word: any) => ({
          text: word.text,
          confidence: parseFloat(word.confidence.toFixed(2)),
          bbox: word.bbox
        })),
        lines: lines.map((line: any) => ({
          text: line.text,
          confidence: parseFloat(line.confidence.toFixed(2)),
          bbox: line.bbox
        })),
        success: true,
        timestamp: new Date().toISOString()
      };

      console.log(`[OCR Tool] Success: Extracted ${words.length} words with ${avgConfidence.toFixed(1)}% confidence`);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(ocrResult, null, 2)
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการอ่านภาพ";
      console.error(`[OCR Tool] Error: ${errorMessage}`);
      
      const errorResult = {
        text: "",
        language: input.language || "eng",
        confidence: 0,
        wordsCount: 0,
        linesCount: 0,
        words: [],
        lines: [],
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(errorResult, null, 2)
          }
        ]
      };
    }
  }
};

export default ocrTool;
