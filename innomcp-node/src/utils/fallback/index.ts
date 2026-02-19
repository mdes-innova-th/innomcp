/**
 * Fallback Design Guidelines
 * แนวทางการจัดการเมื่อ API ล่มหรือไม่สามารถดึงข้อมูลได้
 * 
 * @author MDES Development Team
 * @created 2026-01-10
 */

import { logBoth } from '../mcpLogger';

export interface FallbackConfig {
  intent: string;
  primarySource: string;
  fallbackSources: string[];
  errorMessage: string;
  userGuidance: string[]; // คำแนะนำสำหรับผู้ใช้
  alternativeActions?: string[]; // ทางเลือกอื่น
}

/**
 * Fallback configurations สำหรับแต่ละ intent
 */
export const FALLBACK_CONFIGS: Record<string, FallbackConfig> = {
  WeatherNow: {
    intent: 'WeatherNow',
    primarySource: 'Open-Meteo',
    fallbackSources: ['OpenWeather', 'TMD'],
    errorMessage:
      'ขออภัยครับ ตอนนี้ไม่สามารถดึงข้อมูลสภาพอากาศสดได้ อาจเกิดจากการเชื่อมต่อไม่เสถียรหรือแหล่งข้อมูลชั่วคราวไม่พร้อม',
    userGuidance: [
      'คุณสามารถตรวจสอบสภาพอากาศได้ที่ https://www.tmd.go.th',
      'หรือลองถามใหม่อีกครั้งในอีกสักครู่',
      'สำหรับข้อมูลเรดาร์ฝน: https://www.tmd.go.th/en/weather/radar',
    ],
    alternativeActions: [
      'ถามเกี่ยวกับพยากรณ์อากาศล่วงหน้าแทน',
      'ดูข้อมูลอากาศจากแหล่งอื่น',
    ],
  },

  WeatherForecast: {
    intent: 'WeatherForecast',
    primarySource: 'NWP-TMD',
    fallbackSources: ['Open-Meteo', 'OpenWeather'],
    errorMessage:
      'ขออภัยครับ ไม่สามารถดึงข้อมูลพยากรณ์อากาศได้ในขณะนี้',
    userGuidance: [
      'กรุณาตรวจสอบพยากรณ์อากาศที่ https://weather.tmd.go.th',
      'หรือลองถามอีกครั้งในอีกสักครู่',
    ],
  },

  LocalTime: {
    intent: 'LocalTime',
    primarySource: 'System Clock',
    fallbackSources: [],
    errorMessage: 'ขออภัยครับ ไม่สามารถดึงข้อมูลเวลาได้ในขณะนี้',
    userGuidance: [
      'กรุณาตรวจสอบเวลาบนอุปกรณ์ของคุณ',
      'หรือตรวจสอบที่ https://time.is/Bangkok',
    ],
  },

  CurrentOfficeHolder: {
    intent: 'CurrentOfficeHolder',
    primarySource: 'thaigov.go.th',
    fallbackSources: ['Wikipedia'],
    errorMessage:
      'ขออภัยครับ ไม่สามารถดึงข้อมูลตำแหน่งปัจจุบันได้ในขณะนี้',
    userGuidance: [
      'กรุณาตรวจสอบที่ https://www.thaigov.go.th',
      'หรือ https://th.wikipedia.org',
    ],
    alternativeActions: ['ถามเกี่ยวกับข้อมูลอื่นแทน'],
  },

  OpenSearch: {
    intent: 'OpenSearch',
    primarySource: 'Google Custom Search',
    fallbackSources: ['SerpAPI', 'Brave Search'],
    errorMessage: 'ขออภัยครับ ไม่สามารถค้นหาข้อมูลได้ในขณะนี้',
    userGuidance: [
      'กรุณาลองค้นหาด้วยตนเองที่ https://www.google.com',
      'หรือลองใช้คำค้นหาอื่น',
    ],
    alternativeActions: [
      'ลองถามคำถามเฉพาะเจาะจงมากขึ้น',
      'หรือถามในรูปแบบอื่น',
    ],
  },
};

/**
 * สร้างข้อความ fallback ที่เหมาะสม
 */
export function createFallbackMessage(
  intent: string,
  error?: Error,
  additionalContext?: string
): string {
  const config = FALLBACK_CONFIGS[intent];

  if (!config) {
    // Generic fallback
    return (
      'ขออภัยครับ ไม่สามารถดำเนินการตามคำขอของคุณได้ในขณะนี้\n\n' +
      'กรุณาลองอีกครั้งในภายหลัง หรือติดต่อทีมสนับสนุน'
    );
  }

  let message = config.errorMessage;

  // เพิ่มคำแนะนำ
  if (config.userGuidance && config.userGuidance.length > 0) {
    message += '\n\n**วิธีตรวจสอบด้วยตนเอง:**\n';
    config.userGuidance.forEach((guidance) => {
      message += `• ${guidance}\n`;
    });
  }

  // เพิ่มทางเลือก
  if (config.alternativeActions && config.alternativeActions.length > 0) {
    message += '\n**ทางเลือกอื่น:**\n';
    config.alternativeActions.forEach((action) => {
      message += `• ${action}\n`;
    });
  }

  // เพิ่ม context เพิ่มเติม
  if (additionalContext) {
    message += `\n_${additionalContext}_`;
  }

  // Log error for debugging
  if (error) {
    logBoth(
      'error',
      `[Fallback] ${intent} error: ${error.message}`
    );
  }

  return message;
}

/**
 * ลอง fallback sources ตามลำดับ
 */
export async function tryFallbackSources<T>(
  primaryFn: () => Promise<T>,
  fallbackFns: Array<() => Promise<T>>
): Promise<T> {
  try {
    // Try primary source
    return await primaryFn();
  } catch (primaryError: any) {
    // Try fallback sources
    for (let i = 0; i < fallbackFns.length; i++) {
      try {
        const result = await fallbackFns[i]();
        return result;
      } catch (fallbackError: any) {
        continue;
      }
    }

    // All sources failed
    throw primaryError;
  }
}

/**
 * Error categories
 */
export enum ErrorCategory {
  NETWORK = 'NETWORK_ERROR',
  AUTH = 'AUTH_ERROR',
  QUOTA = 'QUOTA_EXCEEDED',
  PARSE = 'PARSE_ERROR',
  STALE_DATA = 'STALE_DATA',
  UNKNOWN = 'UNKNOWN_ERROR',
}

/**
 * จำแนกประเภท error
 */
export function categorizeError(error: any): ErrorCategory {
  const message = error.message || error.toString();

  if (
    /timeout|network|ECONNREFUSED|ENOTFOUND/i.test(message)
  ) {
    return ErrorCategory.NETWORK;
  }

  if (/unauthorized|forbidden|401|403/i.test(message)) {
    return ErrorCategory.AUTH;
  }

  if (/quota|rate limit|429/i.test(message)) {
    return ErrorCategory.QUOTA;
  }

  if (/parse|json|syntax/i.test(message)) {
    return ErrorCategory.PARSE;
  }

  if (/stale|expired|old/i.test(message)) {
    return ErrorCategory.STALE_DATA;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * สร้าง error response ที่เป็นมิตร
 */
export function createFriendlyErrorMessage(
  error: any,
  intent: string
): string {
  const category = categorizeError(error);

  switch (category) {
    case ErrorCategory.NETWORK:
      return createFallbackMessage(
        intent,
        error,
        'เกิดปัญหาการเชื่อมต่อเครือข่าย กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตของคุณ'
      );

    case ErrorCategory.AUTH:
      return createFallbackMessage(
        intent,
        error,
        'เกิดปัญหาการยืนยันตัวตนกับแหล่งข้อมูล ทีมงานกำลังตรวจสอบ'
      );

    case ErrorCategory.QUOTA:
      return createFallbackMessage(
        intent,
        error,
        'แหล่งข้อมูลมีการใช้งานเกินโควตา กรุณาลองใหม่ในอีกสักครู่'
      );

    case ErrorCategory.PARSE:
      return createFallbackMessage(
        intent,
        error,
        'เกิดปัญหาในการประมวลผลข้อมูล ทีมงานกำลังแก้ไข'
      );

    default:
      return createFallbackMessage(intent, error);
  }
}

/**
 * หมายเหตุสำหรับการพัฒนาต่อ:
 * 
 * 1. เพิ่ม circuit breaker pattern
 * 2. Retry with exponential backoff
 * 3. Health check ก่อนเรียก API
 * 4. Alert เมื่อ fallback rate สูง
 * 5. A/B test fallback messages
 */
