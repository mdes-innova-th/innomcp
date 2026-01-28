/**
 * Language Validator for AI Responses
 * ตรวจสอบว่าคำตอบของ AI เป็นภาษาไทย 100% หรือไม่
 */

import { logBoth } from "./mcpLogger";

export interface LanguageValidationResult {
  isThaiOnly: boolean;
  detectedLanguages: string[];
  nonThaiChars: string[];
  confidence: number;
}

export interface ValidationContext {
  originalQuestion?: string;
  allowTranslation?: boolean;
  allowEnglishNames?: boolean;
}

/**
 * ตรวจสอบบริบทของคำถามเพื่อกำหนด validation rules ที่เหมาะสม
 */
function analyzeQuestionContext(question?: string): ValidationContext {
  if (!question) return {};
  
  const lowerQ = question.toLowerCase();
  
  // Translation requests - อนุญาตภาษาต้นทางและปลายทาง
  const translationKeywords = [
    'แปล', 'translate', 'คำแปล', 'แปลว่า', 'ภาษาจีน', 'ภาษาอังกฤษ',
    'chinese', 'english', 'แปลเป็น', 'เป็นภาษา', 'ความหมาย'
  ];
  const isTranslation = translationKeywords.some(kw => lowerQ.includes(kw));
  
  // Content with names - อนุญาตชื่อเฉพาะภาษาอังกฤษ
  const nameContextKeywords = [
    'หนังสือ', 'book', 'ชื่อเรื่อง', 'ภาพยนตร์', 'movie', 'film',
    'เพลง', 'song', 'อัลบั้ม', 'album', 'ศิลปิน', 'artist',
    'นักแสดง', 'actor', 'ผู้กำกับ', 'director', 'นักเขียน', 'author'
  ];
  const hasEnglishNames = nameContextKeywords.some(kw => lowerQ.includes(kw));
  
  return {
    originalQuestion: question,
    allowTranslation: isTranslation,
    allowEnglishNames: hasEnglishNames
  };
}

/**
 * ตรวจสอบว่าข้อความเป็นภาษาไทยหรือไม่ (ยกเว้นคำศัพท์เทคนิคและชื่อเฉพาะ)
 * รองรับ context-aware validation เพื่อความฉลาดในการตรวจสอบ
 */
export function validateThaiLanguage(
  text: string,
  context?: ValidationContext
): LanguageValidationResult {
  // === PHASE 1: ALLOWLIST - Remove allowed patterns before analysis ===
  
  // 1.1 Technical terms & Units
  const technicalTerms = /\b(API|URL|JSON|HTTP|HTTPS|HTML|CSS|JS|TS|SQL|XML|CSV|PDF|TMD|NWP|NASA|APOD|GDP|USD|THB|ISO|AI|ML|UI|UX|°C|°F|km|m|cm|mm|kg|g|mg|MB|GB|TB|KB|Hz|GHz|MHz)\b/gi;
  
  // 1.2 Brands & Products (ชื่อแบรนด์ที่ใช้บ่อย)
  const brandNames = /\b(Chrome|Firefox|Safari|Edge|VS\s*Code|Visual\s*Studio|Excel|Word|PowerPoint|Outlook|Teams|Slack|Discord|Zoom|GitHub|GitLab|Docker|Kubernetes|Node\.js|React|Vue|Angular|TikTok|Facebook|Instagram|Twitter|LinkedIn|YouTube|Google|Microsoft|Apple|Amazon|Netflix|Spotify|WhatsApp)\b/gi;
  
  // 1.3 NASA missions & Astronomy proper nouns
  const astronomyNouns = /\b(CTB|Medulla|Nebula|Perseverance|James\s*Webb|Hubble|Mars|Artemis|Europa|Titan|Voyager|Pioneer|Apollo|Cassini|Galileo|Juno|Kepler|Spitzer|Chandra|Curiosity|Opportunity|Spirit)\b/gi;
  
  // 1.4 MDES System specific
  const mdesTerms = /\b(MDES|Assistant|Ollama|Gemma|Qwen|DeepSeek|ChatGPT|OpenAI|Anthropic|Claude)\b/gi;
  
  // 1.5 File extensions & Technical patterns
  const filePatterns = /\.(icon|png|jpg|jpeg|gif|svg|webp|mp4|mp3|pdf|doc|docx|xls|xlsx|ppt|json|xml|html|css|js|ts|py|java|cpp|go|rs)\b/gi;
  
  // 1.6 Acronyms (2-10 ตัวอักษรใหญ่ล้วน + ตัวเลข/เครื่องหมาย)
  const acronyms = /\b[A-Z][A-Z0-9]{1,9}\b/g;
  
  // 1.7 Thai-English parenthetical pattern: "คำไทย (English)"
  const thaiEnglishPattern = /[\u0E00-\u0E7F]+\s*\([A-Za-z0-9\s.\-_/]+\)/g;
  
  // 1.8 Emojis (all emoji ranges)
  const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/gu;
  
  let cleanText = text;
  
  // Apply all allowlists
  cleanText = cleanText.replace(technicalTerms, '');
  cleanText = cleanText.replace(brandNames, '');
  cleanText = cleanText.replace(astronomyNouns, '');
  cleanText = cleanText.replace(mdesTerms, '');
  cleanText = cleanText.replace(filePatterns, '');
  cleanText = cleanText.replace(acronyms, '');
  cleanText = cleanText.replace(thaiEnglishPattern, '');
  cleanText = cleanText.replace(emojiPattern, '');
  
  // === PHASE 2: DENYLIST - Check for forbidden patterns ===
  
  // CRITICAL: Forbidden conversational opening words (must reject BEFORE allowlist)
  const forbiddenOpenings = [
    /^okay,?\s+/gi,
    /^ok,?\s+/gi,
    /^well,?\s+/gi,
    /^so,?\s+/gi,
    /^actually,?\s+/gi,
    /^basically,?\s+/gi,
    /^i\s+/gi,
    /^i'm\s+/gi,
    /^i've\s+/gi,
    /^let's\s+/gi,
    /^here's\s+/gi,
    /^here\s+is\s+/gi,
    /^this\s+is\s+/gi,
    /^based\s+on\s+/gi,
    /^the\s+provided\s+/gi,
    /^according\s+to\s+/gi,
    /^from\s+the\s+/gi,
  ];
  
  // Check first 100 chars (where opening phrases appear)
  const opening = text.slice(0, 100).toLowerCase();
  const hasForbiddenOpening = forbiddenOpenings.some(pattern => pattern.test(opening));
  if (hasForbiddenOpening) {
    const match = forbiddenOpenings.find(p => p.test(opening));
    logBoth("error", `[Language Validator] ❌ Forbidden opening phrase detected: "${opening.slice(0, 30)}..."`);
    return {
      isThaiOnly: false,
      detectedLanguages: ['English (forbidden-opening)'],
      nonThaiChars: [opening.slice(0, 30)],
      confidence: 0
    };
  }
  
  // CRITICAL: Forbidden system exposure phrases
  const forbiddenSystemPhrases = [
    /provided\s+JSON/gi,
    /JSON\s+data/gi,
    /JSON\s+object/gi,
    /the\s+data\s+provided/gi,
    /ข้อมูล\s*JSON\s*ที่/gi,
    /จากข้อมูลที่ให้มา/gi,
    /ตามข้อมูลที่ให้มา/gi,
    /ระบบไม่สามารถดึง/gi,
    /ไม่สามารถดึงข้อมูล/gi,
    /ข้อมูลการสังเกต/gi,
    /ผมไม่มี\s*API/gi,
    /station_id/gi,
    /datetime:/gi,
  ];
  
  const hasSystemExposure = forbiddenSystemPhrases.some(pattern => pattern.test(text));
  if (hasSystemExposure) {
    logBoth("error", `[Language Validator] ❌ System exposure phrase detected`);
    return {
      isThaiOnly: false,
      detectedLanguages: ['System-Exposure'],
      nonThaiChars: ['system-exposure-detected'],
      confidence: 0
    };
  }
  
  // English conversation phrases (ห้ามใช้)
  const denylistPhrases = [
    /\bhello\s+how\s+are\s+you\b/gi,
    /\bnice\s+to\s+meet\s+you\b/gi,
    /\bthank\s+you\s+(very\s+)?much\b/gi,
    /\bby\s+the\s+way\b/gi,
    /\blet'?s\s+go\b/gi,
    /\bi\s+think\s+that\b/gi,
    /\bhow\s+about\b/gi,
    /\bplease\s+(help|note|see)\b/gi,
    /\bi\s+am\s+sorry/gi,
    /\bcannot\s+fulfill/gi,
    /\bcannot\s+provide/gi,
  ];
  
  const hasForbiddenPhrases = denylistPhrases.some(pattern => pattern.test(text));
  if (hasForbiddenPhrases) {
    logBoth("error", `[Language Validator] ❌ Detected forbidden English conversational phrases`);
    return {
      isThaiOnly: false,
      detectedLanguages: ['English (forbidden)'],
      nonThaiChars: ['forbidden-phrases'],
      confidence: 0
    };
  }
  
  // CRITICAL: Thai unprofessional openings (must appear AFTER English checks)
  const thaiUnprofessional = [
    /^โอเค,?\s+/gi,
    /^โอเค\s+/gi,
    /^มาดู/gi,
    /^มาช่วย/gi,
    /^มาลอง/gi,
    /^มาวิเคราะห์/gi,
    /^ผมได้วิเคราะห์/gi,
    /^ว้าว/gi,
    /^โว้ว/gi,
    /ขอแจ้งให้ทราบว่า/gi,
  ];
  
  const openingThai = text.slice(0, 50);
  const hasThaiUnpro = thaiUnprofessional.some(pattern => pattern.test(openingThai));
  if (hasThaiUnpro) {
    logBoth("warn", `[Language Validator] ⚠️ Unprofessional Thai opening detected: "${openingThai.slice(0, 20)}..."`);
    // Don't fail completely, but flag as warning
  }
  
  // Check for Unicode special fonts (Mathematical Alphanumeric Symbols)
  const unicodeSpecialFonts = /[\uD835][\uDC00-\uDFFF]/g;
  const hasSpecialFonts = unicodeSpecialFonts.test(cleanText);
  
  // Remove numbers, punctuation, whitespace, markdown symbols
  const cleanedForAnalysis = cleanText
    .replace(/[\d\s\.,;:!?\-_()[\]{}<>\/\\|+=*&#@$%^~`'"]/g, '')
    .replace(/[#\-*`>]/g, '') // Markdown symbols
    .replace(unicodeSpecialFonts, ''); // Remove special fonts for analysis
  
  const detectedLanguages: string[] = [];
  const nonThaiChars: string[] = [];
  let thaiCharCount = 0;
  let totalCharCount = 0;
  
  // If special fonts detected, immediately flag as non-Thai
  if (hasSpecialFonts) {
    detectedLanguages.push('Unicode Special Fonts');
    logBoth("error", `[Language Validator] ❌ Unicode special fonts detected (𝘪𝘵𝘢𝘭𝘪𝘤/𝗯𝗼𝗹𝗱/𝚖𝚘𝚗𝚘)`);
    return {
      isThaiOnly: false,
      detectedLanguages,
      nonThaiChars: ['special-fonts'],
      confidence: 0
    };
  }
  
  for (const char of cleanedForAnalysis) {
    totalCharCount++;
    
    // Thai Unicode range: 0E00-0E7F
    if (/[\u0E00-\u0E7F]/.test(char)) {
      thaiCharCount++;
      continue;
    }
    
    // Chinese/Japanese ranges - STRICT MODE (even 1 char is rejected)
    if (/[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(char)) {
      if (!detectedLanguages.includes('Chinese/Japanese/Korean')) {
        detectedLanguages.push('Chinese/Japanese/Korean');
      }
      nonThaiChars.push(char);
      // Immediately reject if ANY Chinese/Japanese/Korean char found
      logBoth("error", `[Language Validator] ❌ CJK character detected: ${char} (code: ${char.charCodeAt(0).toString(16)})`);
    }
    
    // English letters (not in technical context)
    if (/[a-zA-Z]/.test(char)) {
      if (!detectedLanguages.includes('English')) {
        detectedLanguages.push('English');
      }
      nonThaiChars.push(char);
      continue;
    }
    
    // Other non-Thai characters
    nonThaiChars.push(char);
  }
  
  // === PHASE 4: CALCULATE METRICS & THRESHOLDS ===
  
  // Calculate confidence (% of Thai characters)
  const confidence = totalCharCount === 0 ? 100 : (thaiCharCount / totalCharCount) * 100;
  
  // Calculate English ratio (สัดส่วนอังกฤษ)
  const englishCount = nonThaiChars.filter(c => /[a-zA-Z]/.test(c)).length;
  const englishRatio = totalCharCount === 0 ? 0 : (englishCount / totalCharCount) * 100;
  
  // CONTEXT-AWARE VALIDATION
  const analyzedContext = context?.originalQuestion ? analyzeQuestionContext(context.originalQuestion) : {};
  const ctx: ValidationContext = { ...analyzedContext, ...context };
  
  // Check for CJK characters
  const hasCJK = detectedLanguages.some(lang => lang.includes('Chinese') || lang.includes('Japanese') || lang.includes('Korean'));
  
  // Smart CJK validation - อนุญาตถ้าเป็นคำถามแปลภาษา
  let rejectCJK = hasCJK;
  if (hasCJK && ctx.allowTranslation) {
    logBoth("info", `[Language Validator] 🌏 Translation context detected - allowing CJK characters`);
    rejectCJK = false;
  }
  
  // Check for excessive English (สัดส่วนอังกฤษ > 8%)
  const ENGLISH_THRESHOLD = 8.0; // 5-8% ตามคำแนะนำ
  const hasExcessiveEnglish = englishRatio > ENGLISH_THRESHOLD;
  let rejectEnglish = hasExcessiveEnglish;
  
  if (hasExcessiveEnglish && (ctx.allowEnglishNames || ctx.allowTranslation)) {
    logBoth("info", `[Language Validator] 📚 Name/Translation context - allowing English text (${englishRatio.toFixed(1)}%)`);
    rejectEnglish = false;
  }
  
  // Threshold: ไทย >= 92% AND อังกฤษ <= 8%
  const THAI_THRESHOLD = 92.0;
  const isThaiOnly = !rejectCJK && !rejectEnglish && confidence >= THAI_THRESHOLD;
  
  if (!isThaiOnly) {
    logBoth("warn", `[Language Validator] Non-Thai content detected!`);
    logBoth("warn", `  - Thai confidence: ${confidence.toFixed(1)}%`);
    logBoth("warn", `  - Detected languages: ${detectedLanguages.join(', ') || 'Unknown'}`);
    logBoth("warn", `  - Sample non-Thai chars: ${nonThaiChars.slice(0, 20).join('')}`);
    logBoth("warn", `  - Response preview: ${text.substring(0, 100)}...`);
    if (ctx.allowTranslation) {
      logBoth("info", `  - Context: Translation request detected`);
    }
    if (ctx.allowEnglishNames) {
      logBoth("info", `  - Context: English names/titles expected`);
    }
  }
  
  return {
    isThaiOnly,
    detectedLanguages,
    nonThaiChars,
    confidence
  };
}

/**
 * สร้าง fallback prompt สำหรับบังคับให้ตอบภาษาไทย
 */
export function createThaiOnlyFallbackPrompt(originalQuestion: string, invalidResponse: string): string {
  return `⚠️ คำตอบครั้งก่อนมีภาษาที่ไม่ใช่ภาษาไทยปนอยู่ กรุณาตอบใหม่เป็นภาษาไทย 100%

คำถามเดิม: "${originalQuestion}"

คำตอบที่ผิด (มีภาษาอื่นปน): "${invalidResponse.substring(0, 200)}..."

**กฎสำคัญ (ปฏิบัติอย่างเคร่งครัด):**
1. ✅ ตอบเป็นภาษาไทยเท่านั้น - ห้ามมีตัวอักษรจีน ญี่ปุ่น อังกฤษ หรือภาษาอื่นใดปนอยู่
2. ❌ ห้ามใช้ Unicode special fonts - ห้ามใช้ 𝘪𝘵𝘢𝘭𝘪𝘤, 𝗯𝗼𝗹𝗱, 𝚖𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎 หรือตัวอักษรพิเศษใดๆ
3. ❌ ห้ามแสดง raw JSON - แปลงข้อมูลให้เป็นภาษาไทยที่อ่านง่าย
4. ✅ ใช้ Markdown table ที่ถูกต้อง - ใช้ | และ - เท่านั้น
5. ✅ ยกเว้นคำศัพท์เทคนิคเท่านั้น: API, URL, JSON, HTTP (แต่ต้องอธิบายเป็นภาษาไทย)
6. ✅ ถ้าข้อมูลไม่เพียงพอ → ตอบว่า "ขออภัย ข้อมูลที่มีไม่เพียงพอสำหรับตอบคำถามนี้"

ตอบคำถามใหม่เป็นภาษาไทยบริสุทธิ์ (ไม่ใช่ภาษาอังกฤษหรือ special fonts):`;
}

/**
 * แปลงข้อความภาษาอื่นเป็นภาษาไทย (fallback response)
 */
export function createThaiErrorResponse(originalQuestion: string): string {
  return `ขออภัย เกิดข้อผิดพลาดในการสร้างคำตอบ กรุณาลองถามใหม่อีกครั้ง

หากคำถามเกี่ยวกับ:
- 📅 วันเวลา: ถาม "ตอนนี้กี่โมง" หรือ "วันนี้วันที่เท่าไหร่"
- 🌤️ อากาศ: ถาม "อากาศวันนี้เป็นอย่างไร" หรือ "พรุ่งนี้ฝนตกไหม"
- 🔢 คำนวณ: ถาม "25 + 75 เท่ากับเท่าไหร่" หรือ "999 แฟกทอเรียล"

ระบบจะพยายามตอบคำถามให้ดีที่สุดครับ 🙏`;
}

export default {
  validateThaiLanguage,
  createThaiOnlyFallbackPrompt,
  createThaiErrorResponse
};
