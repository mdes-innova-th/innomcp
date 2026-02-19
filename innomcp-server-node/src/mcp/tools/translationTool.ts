import { z } from "zod";
import axios from "axios";

/**
 * Translation Tool
 * Translates text between languages using LibreTranslate API
 * Free API: libretranslate.com (self-hosted or public instance)
 */

const API_URL = "https://libretranslate.com/translate";

// Supported languages
const LANGUAGES = {
  "en": "English",
  "th": "Thai",
  "zh": "Chinese",
  "ja": "Japanese",
  "ko": "Korean",
  "fr": "French",
  "de": "German",
  "es": "Spanish",
  "it": "Italian",
  "pt": "Portuguese",
  "ru": "Russian",
  "ar": "Arabic",
  "hi": "Hindi",
  "vi": "Vietnamese",
  "id": "Indonesian",
  "ms": "Malay"
};

export const translationToolSchema = z.object({
  text: z.string().describe("ข้อความที่ต้องการแปล"),
  sourceLang: z.string().describe(`ภาษาต้นทาง (เช่น th, en, ja). auto = ตรวจจับอัตโนมัติ. รองรับ: ${Object.keys(LANGUAGES).join(", ")}`),
  targetLang: z.string().describe(`ภาษาปลายทาง (เช่น en, th, ja). รองรับ: ${Object.keys(LANGUAGES).join(", ")}`),
});

export type TranslationInput = z.infer<typeof translationToolSchema>;

export const translationTool = {
  name: "translationTool",
  description: `
หน้าที่: แปลข้อความระหว่างภาษาต่างๆ
ใช้เมื่อ:
- แปลภาษาไทยเป็นอังกฤษหรือภาษาอื่น
- แปลภาษาต่างประเทศเป็นไทย
- สื่อสารข้ามภาษา
- อ่านเอกสารภาษาต่างประเทศ

รองรับภาษา: ${Object.keys(LANGUAGES).length}+ ภาษา
- Thai (th), English (en), Japanese (ja), Chinese (zh)
- Korean (ko), French (fr), German (de), Spanish (es)
- และอื่นๆ

คุณสมบัติ:
- ตรวจจับภาษาอัตโนมัติ (auto)
- รองรับข้อความยาว
- แปลรวดเร็ว

ตัวอย่าง:
- "แปล 'สวัสดี' เป็นภาษาอังกฤษ"
- "แปล 'Hello' เป็นภาษาญี่ปุ่น"
- "แปล 'こんにちは' เป็นภาษาไทย"
- "translate 'Good morning' to Thai"
`,
  inputSchema: translationToolSchema,

  execute: async (args: unknown) => {
    // Validate input
    const parsed = translationToolSchema.safeParse(args);
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
      const { text, sourceLang, targetLang } = input;

      // Validate input
      if (!text || text.trim().length === 0) {
        throw new Error("กรุณาระบุข้อความที่ต้องการแปล");
      }

      if (text.length > 5000) {
        throw new Error("ข้อความยาวเกินไป (สูงสุด 5000 ตัวอักษร)");
      }

      // Normalize language codes
      const source = sourceLang.toLowerCase();
      const target = targetLang.toLowerCase();

      // Validate language codes
      if (source !== "auto" && !LANGUAGES[source as keyof typeof LANGUAGES]) {
        throw new Error(`ไม่รองรับภาษาต้นทาง: ${sourceLang}`);
      }

      if (!LANGUAGES[target as keyof typeof LANGUAGES]) {
        throw new Error(`ไม่รองรับภาษาปลายทาง: ${targetLang}`);
      }

      // Call LibreTranslate API
      const response = await axios.post(
        API_URL,
        {
          q: text,
          source: source,
          target: target,
          format: "text"
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'INNOMCP/1.0'
          }
        }
      );

      if (!response.data || !response.data.translatedText) {
        throw new Error("ไม่สามารถแปลข้อความได้");
      }

      const result = {
        originalText: text,
        translatedText: response.data.translatedText,
        sourceLang: source,
        targetLang: target,
        detectedLang: response.data.detectedLanguage?.language || undefined,
        success: true
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2)
          }
        ]
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการแปล";
      
      console.error(`[Translation Tool] Error: ${errorMessage}`);
      
      // Fallback: Simple word translations for demo
      const simpleTranslations: Record<string, Record<string, string>> = {
        "th": {
          "สวัสดี": "Hello",
          "ขอบคุณ": "Thank you",
          "ลาก่อน": "Goodbye"
        },
        "en": {
          "hello": "สวัสดี",
          "thank you": "ขอบคุณ",
          "goodbye": "ลาก่อน"
        }
      };

      const simple = simpleTranslations[input.sourceLang]?.[input.text.toLowerCase()];
      
      const errorResult = {
        originalText: input.text,
        translatedText: simple || "",
        sourceLang: input.sourceLang,
        targetLang: input.targetLang,
        success: false,
        error: `${errorMessage} (ใช้ fallback dictionary)`
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

export default translationTool;
