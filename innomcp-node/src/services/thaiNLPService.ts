// thaiNLPService.ts — Thai NLP utilities for INNOMCP AI pipeline
// TypeScript strict, no external libraries

export class ThaiNLPService {
  // Threshold for considering text as primarily Thai
  private static readonly THAI_THRESHOLD = 0.3;

  /**
   * Detect if text is primarily Thai (>= 30% Thai characters)
   */
  isThai(text: string): boolean {
    if (!text) return false;
    return this.thaiRatio(text) >= ThaiNLPService.THAI_THRESHOLD;
  }

  /**
   * Calculate ratio of Thai characters (0-1).
   * Only considers characters in the Thai Unicode block (U+0E00–U+0E7F)
   * against total non-whitespace characters.
   */
  thaiRatio(text: string): number {
    if (!text) return 0;
    const cleaned = text.replace(/\s+/g, '');
    if (cleaned.length === 0) return 1; // treat empty as Thai (default)
    let thaiCount = 0;
    for (const ch of cleaned) {
      if (ThaiNLPService.isThaiChar(ch)) thaiCount++;
    }
    return thaiCount / cleaned.length;
  }

  /**
   * Rule-based Thai intent detection – fast, no ML.
   */
  detectIntent(text: string): {
    type: 'question' | 'command' | 'greeting' | 'feedback' | 'unknown';
    language: 'thai' | 'english' | 'mixed';
    urgency: 'high' | 'normal' | 'low';
    domain: 'weather' | 'geo' | 'document' | 'code' | 'general';
  } {
    const t = text.trim();
    const normalized = t.toLowerCase();

    // Language
    const totalChars = t.replace(/\s/g, '').length;
    let thaiChars = 0;
    let engChars = 0;
    for (const ch of t) {
      if (ThaiNLPService.isThaiChar(ch)) thaiChars++;
      else if (/[a-zA-Z]/.test(ch)) engChars++;
    }
    const thaiShare = totalChars > 0 ? thaiChars / totalChars : 0;
    const engShare = totalChars > 0 ? engChars / totalChars : 0;
    let language: 'thai' | 'english' | 'mixed' = 'mixed';
    if (thaiShare >= 0.5) language = 'thai';
    else if (engShare >= 0.5) language = 'english';

    // Type detection
    let type: 'question' | 'command' | 'greeting' | 'feedback' | 'unknown' = 'unknown';
    // Question patterns (common Thai / English)
    if (/[?？]/.test(t) ||
        /อะไร|ไหม|หรือเปล่า|หรือยัง|ใช่ไหม|หรือ|เท่าไร|เมื่อไหร่|ที่ไหน|ใคร|ทำไม|อย่างไร/i.test(t) ||
        /\b(what|when|where|who|why|how|is|are|do|does|can|could|would|will|shall)\b/i.test(t)) {
      type = 'question';
    }
    // Commands (imperative starters)
    else if (/^(ช่วย|กรุณา|โปรด|ขอ|จง|อย่า|ไป|มา|ทำ|ส่ง|เปิด|ปิด|เขียน|อ่าน)/i.test(t) ||
             /\b(please|do|don't|start|stop|open|close|create|delete|run|show)\b/i.test(t)) {
      type = 'command';
    }
    // Greetings
    else if (/^(สวัสดี|หวัดดี|สวัสดีครับ|สวัสดีค่ะ|hello|hi|hey|good morning|good evening)/i.test(t)) {
      type = 'greeting';
    }
    // Feedback (opinion words)
    else if (/ชอบ|ไม่ชอบ|ดี|แย่|เยี่ยม|ห่วย|สุดยอด|พอใช้|พอใจ|ไม่พอใจ|thank|thanks|sorry|bad|good|awesome/i.test(t)) {
      type = 'feedback';
    }

    // Urgency keywords
    let urgency: 'high' | 'normal' | 'low' = 'normal';
    if (/ด่วน|เร่งด่วน|เร็ว|เดี๋ยวนี้|ทันที|urgent|immediately|asap|emergency/i.test(t)) {
      urgency = 'high';
    } else if (/ช้า|ภายหลัง|ไม่เร่ง|whenever|later|low priority/i.test(t)) {
      urgency = 'low';
    }

    // Domain detection
    let domain: 'weather' | 'geo' | 'document' | 'code' | 'general' = 'general';
    if (/อากาศ|ฝน|ร้อน|หนาว|พายุ|แดด|ลม|อุณหภูมิ|weather|rain|storm|sunny|cloudy|temperature/i.test(t)) {
      domain = 'weather';
    } else if (/จังหวัด|อำเภอ|ตำบล|ภาค|ที่ตั้ง|แผนที่|ภูมิศาสตร์|พิกัด|map|geo|location|region/i.test(t)) {
      domain = 'geo';
    } else if (/เอกสาร|ไฟล์|pdf|word|สัญญา|บันทึก|หนังสือ|รายงาน|document|file|report|contract/i.test(t)) {
      domain = 'document';
    } else if (/โค้ด|โปรแกรม|เขียนโปรแกรม|code|javascript|python|typescript|function|class|api/i.test(t)) {
      domain = 'code';
    }

    return { type, language, urgency, domain };
  }

  /**
   * Suggest the best MDES model for the given Thai content.
   * Prefer models with 'thai' in name, else fallback to first available.
   */
  suggestModel(text: string, availableModels: string[]): string {
    if (!availableModels || availableModels.length === 0) {
      return 'mdes/llama3:latest';
    }
    // Priority: any model containing 'thai' (case-insensitive)
    const thaiModel = availableModels.find(m => /thai/i.test(m));
    if (thaiModel) return thaiModel;
    // Otherwise return the first model
    return availableModels[0];
  }

  /**
   * Simple Thai tokenizer: splits by whitespace and zero-width spaces.
   * This is a heuristic – a full Thai word segmenter would require a dictionary.
   */
  tokenize(text: string): string[] {
    if (!text) return [];
    // Split by any whitespace or zero-width space (U+200B)
    return text.split(/[\s\u200B]+/)
      .filter(token => token.length > 0);
  }

  /**
   * Extract entities from Thai text: provinces, dates, government agencies, numbers.
   */
  extractEntities(text: string): {
    provinces: string[];
    dates: string[];
    agencies: string[];
    numbers: number[];
  } {
    const provinces: string[] = [];
    const dates: string[] = [];
    const agencies: string[] = [];
    const numbers: number[] = [];

    if (!text) return { provinces, dates, agencies, numbers };

    // --- Provinces (common ones) ---
    const provinceList = [
      'กรุงเทพมหานคร', 'กรุงเทพ', 'เชียงใหม่', 'ภูเก็ต', 'นครราชสีมา', 'ขอนแก่น',
      'ชลบุรี', 'ระยอง', 'สงขลา', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ',
      'อุบลราชธานี', 'อุดรธานี', 'นครศรีธรรมราช', 'สุราษฎร์ธานี', 'พัทยา'
    ];
    for (const prov of provinceList) {
      if (text.includes(prov)) {
        provinces.push(prov);
      }
    }
    // Remove duplicates but preserve order
    const uniqueProvs = [...new Set(provinces)];

    // --- Dates ---
    // Thai date patterns: "วันที่ 12 มกราคม 2567", "12/01/2024", "2024-01-12"
    // Also capture isolated numbers that are likely dates? We'll do regex.
    const thaiDateRegex = /วันที่?\s*(\d{1,2})\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(\d{4})/gi;
    let match;
    while ((match = thaiDateRegex.exec(text)) !== null) {
      dates.push(match[0].trim());
    }
    // International date patterns
    const intlDateRegex = /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/g;
    while ((match = intlDateRegex.exec(text)) !== null) {
      dates.push(match[0]);
    }

    // --- Government agencies ---
    const agencyKeywords = [
      'กระทรวง', 'กรม', 'สำนักงาน', 'องค์การ', 'สถาบัน', 'กอง', 'ศูนย์',
      'สำนัก', 'รัฐสภา', 'รัฐบาล', 'คณะกรรมการ', 'สำนักนายกรัฐมนตรี'
    ];
    // Simple substring matching; to avoid partial overlap we check word boundaries.
    for (const keyword of agencyKeywords) {
      const re = new RegExp(keyword + '[ก-ฮ0-9\s]*', 'g');
      while ((match = re.exec(text)) !== null) {
        const found = match[0].trim();
        if (found.length > 1) agencies.push(found);
      }
    }
    // Deduplicate
    const uniqueAgencies = [...new Set(agencies)];

    // --- Numbers (integers) ---
    const numberRegex = /[-+]?\b\d+\b/g;
    while ((match = numberRegex.exec(text)) !== null) {
      numbers.push(parseInt(match[0], 10));
    }

    return {
      provinces: uniqueProvs,
      dates: [...new Set(dates)],
      agencies: uniqueAgencies,
      numbers
    };
  }

  /**
   * Clean Thai text: normalize spaces, remove noise.
   */
  clean(text: string): string {
    if (!text) return '';
    let cleaned = text.trim();
    // Replace multiple spaces/tabs with single space
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    // Normalize line breaks (multiple newlines to double newline)
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    // Remove control characters except newline
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    // Collapse spaces around newlines
    cleaned = cleaned.replace(/ *\n */g, '\n');
    // Trim each line (optional) but maintain structure
    cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');
    return cleaned;
  }

  /**
   * Format Thai government document text: standardize spacing and line breaks.
   * Inserts a proper header spacing and ensures sentence-ending punctuation is followed by line break.
   */
  formatGovDoc(text: string): string {
    const cleaned = this.clean(text);
    if (!cleaned) return '';

    // Add document header if not present (a typical "เรื่อง:" prefix)
    let formatted = cleaned;
    if (!/เรื่อง\s*[:：]/.test(formatted)) {
      // Prepend "เรื่อง: " followed by the first line as title
      const lines = formatted.split('\n');
      if (lines[0]) {
        lines[0] = 'เรื่อง: ' + lines[0];
        formatted = lines.join('\n');
      }
    }

    // Ensure sentences are separated by line breaks:
    // Thai often uses period-less sentences; we'll break on common sentence-ending words or periods.
    // More reliable: break after period, exclamation, question mark (Thai or ASCII) followed by space.
    formatted = formatted.replace(/([.?!。？！])\s+/g, '$1\n');
    // Also break after newline‑like indicators that often end paragraphs
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    // Normalise whitespace again after the replacements
    return this.clean(formatted);
  }

  // --- Private helpers ---

  private static isThaiChar(ch: string): boolean {
    if (ch.length !== 1) return false;
    const code = ch.charCodeAt(0);
    // Thai Unicode block U+0E00 - U+0E7F
    return code >= 0x0E00 && code <= 0x0E7F;
  }
}

// Singleton instance exported as per specification
export const thaiNLPService = new ThaiNLPService();