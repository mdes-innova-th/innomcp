/**
 * Thai Response Style Guide
 * มาตรฐานการตอบภาษาไทยสุภาพ กระชับ และมีประสิทธิภาพ
 * 
 * @author MDES Development Team
 * @created 2026-01-10
 */

/**
 * ==========================================
 * หลักการพื้นฐาน
 * ==========================================
 * 
 * 1. ใช้ภาษาไทยเป็นหลัก ไม่สลับภาษา (ยกเว้น proper noun, URL, ศัพท์เทคนิค)
 * 2. สุภาพ แต่ไม่เกินไป (ใช้ "ครับ/ค่ะ" ท้ายประโยค)
 * 3. กระชับ ตรงประเด็น ไม่วกวน
 * 4. มีข้อมูลอ้างอิง (sources) ทุกครั้งที่ตอบข้อมูลสด
 * 5. ไม่เดา ไม่ hallucinate (ถ้าไม่รู้ให้บอกชัดเจน)
 */

/**
 * ==========================================
 * รูปแบบคำตอบ (Answer Style Contracts)
 * ==========================================
 */

/**
 * WeatherNow: ตอบในบรรทัดแรก "ตก/ไม่ตก/แนวโน้ม"
 * 
 * ✅ ดี:
 * "☀️ ตอนนี้ กรุงเทพมหานคร ไม่มีฝนตก อากาศแจ่มใส
 * 
 * สภาพอากาศปัจจุบัน:
 * • 🌡️ อุณหภูมิ: 28°C
 * • 💧 ความชื้น: 65%
 * 
 * แหล่งข้อมูล: Open-Meteo
 * อัพเดทเมื่อ: 10:30 น."
 * 
 * ❌ ไม่ดี:
 * "ขอบคุณที่ถามค่ะ ตอนนี้สภาพอากาศที่กรุงเทพฯนั้นดูเหมือนว่าจะไม่มีฝนตก
 * และอุณหภูมิก็อยู่ที่ประมาณ 28 องศาเซลเซียส..."
 */
export function formatWeatherNowResponse(data: {
  isRaining: 'yes' | 'no' | 'likely';
  temperature: number;
  humidity?: number;
  location: string;
  observedAt: string;
  sources: string[];
}): string {
  // บรรทัดแรก: สรุปชัดเจน
  let emoji = '';
  let status = '';

  switch (data.isRaining) {
    case 'yes':
      emoji = '🌧️';
      status = 'มีฝนตก';
      break;
    case 'likely':
      emoji = '🌥️';
      status = 'มีแนวโน้มฝนตก';
      break;
    case 'no':
      emoji = '☀️';
      status = 'ไม่มีฝนตก อากาศแจ่มใส';
      break;
  }

  let response = `${emoji} ตอนนี้ ${data.location} ${status}\n\n`;

  // รายละเอียด
  response += `**สภาพอากาศปัจจุบัน:**\n`;
  response += `• 🌡️ อุณหภูมิ: ${data.temperature.toFixed(1)}°C\n`;

  if (data.humidity) {
    response += `• 💧 ความชื้น: ${data.humidity}%\n`;
  }

  // แหล่งข้อมูล
  response += `\n**แหล่งข้อมูล:** ${data.sources.join(', ')}\n`;

  // เวลา
  const time = new Date(data.observedAt).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
  response += `_อัพเดทเมื่อ: ${time} น._`;

  return response;
}

/**
 * LocalTime: แสดงวันและเวลาภาษาไทยชัดเจน
 * 
 * ✅ ดี:
 * "เวลาตอนนี้: วันศุกร์ที่ 10 มกราคม 2569 เวลา 22:30:45 น."
 * 
 * ❌ ไม่ดี:
 * "The current time is 2026-01-10T22:30:45+07:00"
 */
export function formatLocalTimeResponse(data: {
  humanReadable: string;
}): string {
  return `เวลาตอนนี้: ${data.humanReadable}`;
}

/**
 * CurrentOfficeHolder: แสดงชื่อ ตำแหน่ง พรรค
 * 
 * ✅ ดี:
 * "นายกรัฐมนตรีคนปัจจุบัน: นางสาวแพทองธาร ชินวัตร (พรรคเพื่อไทย)
 * เริ่มดำรงตำแหน่ง: 18 สิงหาคม 2567"
 */
export function formatOfficeHolderResponse(data: {
  office: string;
  name: string;
  party?: string;
  startedAt?: string;
}): string {
  let response = `**${data.office}คนปัจจุบัน:** ${data.name}`;

  if (data.party) {
    response += ` (${data.party})`;
  }

  if (data.startedAt) {
    const date = new Date(data.startedAt).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    response += `\n**เริ่มดำรงตำแหน่ง:** ${date}`;
  }

  response += '\n\n**แหล่งข้อมูล:** ข้อมูลราชการไทย';

  return response;
}

/**
 * ==========================================
 * คำที่ควรหลีกเลี่ยง
 * ==========================================
 * 
 * ❌ "ผมคิดว่า...", "อาจจะ...", "น่าจะ..." → เดา, ไม่แน่ใจ
 * ❌ "ตามที่ผมเข้าใจ...", "ความรู้ของผม..." → subjective
 * ❌ "ขออภัยอย่างยิ่ง...", "ต้องขออภัยจริงๆ..." → เกินไป
 * ❌ ภาษาปนกัน: "weather ตอนนี้", "กำลัง loading"
 * 
 * ✅ ใช้แทน:
 * - "ตามข้อมูลจาก..."
 * - "ผลการตรวจสอบพบว่า..."
 * - "ขออภัยครับ..." (สั้นกระชับ)
 * - "สภาพอากาศตอนนี้", "กำลังโหลดข้อมูล"
 */

export const AVOID_PHRASES = [
  'ผมคิดว่า',
  'อาจจะ',
  'น่าจะ',
  'ตามที่ผมเข้าใจ',
  'ความรู้ของผม',
  'ขออภัยอย่างยิ่ง',
];

/**
 * ==========================================
 * การใช้ emoji
 * ==========================================
 * 
 * ใช้ได้ เพื่อเพิ่มความชัดเจน:
 * ✅ อากาศ: ☀️ 🌤️ ⛅ 🌥️ ☁️ 🌧️ ⛈️ 🌨️
 * ✅ อุณหภูมิ: 🌡️
 * ✅ ความชื้น: 💧
 * ✅ ลม: 💨
 * ✅ เวลา: ⏰ 🕐
 * ✅ สถานที่: 📍
 * 
 * แต่ไม่ควรใช้เกินไป (1-2 emoji ต่อประโยค)
 */

export const WEATHER_EMOJIS = {
  clear: '☀️',
  partlyCloudy: '🌤️',
  cloudy: '☁️',
  rain: '🌧️',
  thunder: '⛈️',
  snow: '🌨️',
  fog: '🌫️',
};

/**
 * ==========================================
 * Validation: ตรวจสอบคำตอบก่อนส่ง
 * ==========================================
 */
export function validateThaiResponse(response: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for avoided phrases
  AVOID_PHRASES.forEach((phrase) => {
    if (response.includes(phrase)) {
      issues.push(`พบคำที่ควรหลีกเลี่ยง: "${phrase}"`);
    }
  });

  // Check for excessive English
  const englishWords = response.match(/[a-zA-Z]+/g) || [];
  const totalWords = response.split(/\s+/).length;
  const englishRatio = englishWords.length / totalWords;

  if (englishRatio > 0.3) {
    issues.push(`มีภาษาอังกฤษมากเกินไป (${(englishRatio * 100).toFixed(1)}%)`);
  }

  // Check for Arabic/other languages
  if (/[\u0600-\u06FF]/.test(response)) {
    issues.push('พบภาษาอาหรับในคำตอบ');
  }

  // Check for sources (should have)
  if (
    !response.includes('แหล่งข้อมูล') &&
    !response.includes('แหล่งอ้างอิง') &&
    !response.includes('ที่มา')
  ) {
    issues.push('ไม่มีการระบุแหล่งข้อมูล');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * ==========================================
 * Language Guard: บังคับภาษาไทย
 * ==========================================
 */
export function enforceThaiLanguage(text: string): string {
  // Remove excessive English (except proper nouns, URLs, technical terms)
  // This is a simplified version - actual implementation should be more sophisticated

  // Preserve URLs
  const urls: string[] = [];
  text = text.replace(/(https?:\/\/[^\s]+)/g, (match) => {
    urls.push(match);
    return `__URL_${urls.length - 1}__`;
  });

  // Restore URLs
  urls.forEach((url, index) => {
    text = text.replace(`__URL_${index}__`, url);
  });

  return text;
}

/**
 * หมายเหตุสำหรับการพัฒนาต่อ:
 * 
 * 1. ใช้ NLP เพื่อตรวจสอบ tone และ style
 * 2. A/B test รูปแบบคำตอบที่ต่างกัน
 * 3. User feedback สำหรับปรับปรุง style
 * 4. Machine learning เพื่อเรียนรู้ preferred style
 * 5. Multilingual support (อังกฤษ, จีน, ญี่ปุ่น)
 */
