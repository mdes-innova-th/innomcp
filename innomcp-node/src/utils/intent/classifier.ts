/**
 * Intent Classifier Module
 * จำแนกประเภทคำถามผู้ใช้เพื่อนำไปสู่ data source ที่เหมาะสม
 *
 * Intent Types:
 * - WeatherNow: สภาพอากาศปัจจุบัน (ตอนนี้ฝนตก, อากาศวันนี้)
 * - WeatherForecast: พยากรณ์อากาศล่วงหน้า (พรุ่งนี้, 7 วัน, NWP)
 * - LocalTime: เวลาท้องถิ่น (เวลาตอนนี้, กี่โมงแล้ว)
 * - CurrentOfficeHolder: ตำแหน่งบุคคลปัจจุบัน (นายกคนปัจจุบัน, รัฐมนตรี)
 * - GeneralFact: ความรู้ทั่วไป (ประวัติศาสตร์, คำนิยาม)
 * - OpenSearch: ค้นหาเว็บทั่วไป
 * - ToolSpecific: ระบุ tool เฉพาะ (Archive, WorldBank, NASA, etc.)
 * - Fallback: ไม่สามารถจำแนกได้
 *
 * @author MDES Development Team
 * @created 2026-01-10
 */

/**
 * @deprecated Phase C.10 (2026-05-17): part of the dead intent/handler subtree.
 * Live path uses services/intentClassifier.ts + agents/conductor.ts.
 * Imported only by intent/handler.ts (also deprecated). Kept for safety;
 * do not extend.
 */

export type IntentType =
  | 'WeatherNow'
  | 'WeatherForecast'
  | 'LocalTime'
  | 'CurrentOfficeHolder'
  | 'GeneralFact'
  | 'OpenSearch'
  | 'ToolSpecific'
  | 'Fallback';

export interface ClassifiedIntent {
  type: IntentType;
  confidence: number; // 0-1
  subtype?: string; // เช่น 'rainfall', 'temperature', 'prime_minister'
  location?: string; // สำหรับ weather queries
  timeframe?: string; // สำหรับ weather forecast
  originalQuery: string;
  keywords: string[];
}

/**
 * จำแนกประเภทคำถาม (Intent Classification)
 * ใช้ keyword matching และ pattern recognition
 */
export function classifyIntent(query: string): ClassifiedIntent {
  const lowerQuery = query.toLowerCase();
  const thaiQuery = query; // เก็บต้นฉบับไทยไว้

  // ========================================
  // 1. WeatherNow - สภาพอากาศปัจจุบัน
  // ========================================
  const weatherNowPatterns = [
    /ตอนนี้.*ฝน/,
    /ฝน.*ตอนนี้/,
    /กำลังตกฝน/,
    /ฝนตก.*ไหม/,
    /อากาศ.*ตอนนี้/,
    /อากาศ.*วันนี้/,
    /สภาพอากาศ.*ปัจจุบัน/,
    /อุณหภูมิ.*ตอนนี้/,
    /ร้อน.*ตอนนี้/,
    /หนาว.*ตอนนี้/,
  ];

  if (weatherNowPatterns.some((p) => p.test(thaiQuery))) {
    return {
      type: 'WeatherNow',
      confidence: 0.95,
      subtype: lowerQuery.includes('ฝน') ? 'rainfall' : 'general',
      location: extractLocation(query) || 'Bangkok',
      originalQuery: query,
      keywords: ['weather', 'now', 'current'],
    };
  }

  // ========================================
  // 2. WeatherForecast - พยากรณ์อากาศ
  // ========================================
  const forecastPatterns = [
    /พยากรณ์/,
    /พรุ่งนี้.*อากาศ/,
    /อาทิตย์หน้า.*อากาศ/,
    /7.*วัน/,
    /สัปดาห์หน้า/,
    /nwp/i,
    /forecast/i,
  ];

  if (forecastPatterns.some((p) => p.test(thaiQuery))) {
    return {
      type: 'WeatherForecast',
      confidence: 0.9,
      location: extractLocation(query) || 'Bangkok',
      timeframe: extractTimeframe(query),
      originalQuery: query,
      keywords: ['forecast', 'weather', 'prediction'],
    };
  }

  // ========================================
  // 3. LocalTime - เวลาท้องถิ่น
  // ========================================
  const timePatterns = [
    /เวลา.*ตอนนี้/,
    /กี่โมง.*แล้ว/,
    /เวลา.*ปัจจุบัน/,
    /what.*time/i,
    /current.*time/i,
  ];

  if (timePatterns.some((p) => p.test(thaiQuery))) {
    return {
      type: 'LocalTime',
      confidence: 0.95,
      originalQuery: query,
      keywords: ['time', 'current', 'now'],
    };
  }

  // ========================================
  // 4. CurrentOfficeHolder - ตำแหน่งบุคคล
  // ========================================
  const officeHolderPatterns = [
    /นายก.*ปัจจุบัน/,
    /นายก.*คน.*ปัจจุบัน/,
    /นายก.*ตอนนี้/,
    /รัฐมนตรี.*ปัจจุบัน/,
    /ผู้นำ.*ประเทศไทย/,
    /prime.*minister.*current/i,
  ];

  if (officeHolderPatterns.some((p) => p.test(thaiQuery))) {
    return {
      type: 'CurrentOfficeHolder',
      confidence: 0.9,
      subtype: thaiQuery.includes('นายก') ? 'prime_minister' : 'other',
      originalQuery: query,
      keywords: ['office', 'holder', 'current', 'thailand'],
    };
  }

  // ========================================
  // 5. ToolSpecific - ระบุ tool เฉพาะ
  // ========================================
  const toolPatterns = [
    { pattern: /archive|อาร์ไคฟ/i, tool: 'archive' },
    { pattern: /worldbank|ธนาคารโลก/i, tool: 'worldbank' },
    { pattern: /nasa/i, tool: 'nasa' },
    { pattern: /echart|กราฟ/i, tool: 'echarts' },
    { pattern: /govdata|ข้อมูลภาครัฐ/i, tool: 'govdata' },
  ];

  for (const { pattern, tool } of toolPatterns) {
    if (pattern.test(thaiQuery)) {
      return {
        type: 'ToolSpecific',
        confidence: 0.85,
        subtype: tool,
        originalQuery: query,
        keywords: [tool],
      };
    }
  }

  // ========================================
  // 6. GeneralFact - ความรู้ทั่วไป
  // ========================================
  const factPatterns = [
    /คือ.*อะไร/,
    /อธิบาย/,
    /ประวัติ/,
    /ความหมาย/,
    /what.*is/i,
    /define/i,
    /explain/i,
  ];

  if (factPatterns.some((p) => p.test(thaiQuery))) {
    return {
      type: 'GeneralFact',
      confidence: 0.7,
      originalQuery: query,
      keywords: ['fact', 'knowledge', 'definition'],
    };
  }

  // ========================================
  // 7. OpenSearch - ค้นหาทั่วไป
  // ========================================
  const searchPatterns = [
    /ค้นหา/,
    /หา.*ข้อมูล/,
    /search/i,
    /find/i,
  ];

  if (searchPatterns.some((p) => p.test(thaiQuery))) {
    return {
      type: 'OpenSearch',
      confidence: 0.75,
      originalQuery: query,
      keywords: ['search', 'find'],
    };
  }

  // ========================================
  // 8. Fallback - ไม่สามารถจำแนกได้
  // ========================================
  return {
    type: 'Fallback',
    confidence: 0.5,
    originalQuery: query,
    keywords: [],
  };
}

/**
 * ดึงข้อมูลสถานที่จากคำถาม
 */
function extractLocation(query: string): string | null {
  const locationPatterns = [
    { pattern: /กรุงเทพ|bangkok/i, location: 'Bangkok' },
    { pattern: /เชียงใหม่|chiang mai/i, location: 'Chiang Mai' },
    { pattern: /ภูเก็ต|phuket/i, location: 'Phuket' },
    { pattern: /พัทยา|pattaya/i, location: 'Pattaya' },
    { pattern: /ขอนแก่น|khon kaen/i, location: 'Khon Kaen' },
  ];

  for (const { pattern, location } of locationPatterns) {
    if (pattern.test(query)) {
      return location;
    }
  }

  return null;
}

/**
 * ดึงข้อมูลช่วงเวลาจากคำถาม
 */
function extractTimeframe(query: string): string {
  if (/พรุ่งนี้|tomorrow/i.test(query)) return '1day';
  if (/7.*วัน|week/i.test(query)) return '7days';
  if (/สัปดาห์|week/i.test(query)) return '7days';
  if (/24.*ชั่วโมง|24.*hour/i.test(query)) return '24hours';
  if (/48.*ชั่วโมง|48.*hour/i.test(query)) return '48hours';
  return 'default';
}
