/**
 * Intent Router Module
 * เชื่อม Intent → Data Source/Tool → Response Schema
 *
 * แต่ละ intent มี:
 * - Data source ที่ระบุชัด
 * - Response schema ที่กำหนด
 * - Fallback handler
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

import { ClassifiedIntent, IntentType } from '../intent/classifier';

export interface RouteConfig {
  intent: IntentType;
  dataSources: DataSource[];
  responseSchema: ResponseSchema;
  fallbackHandler: FallbackHandler;
  cacheTTL?: number; // seconds
  timeout?: number; // milliseconds
}

export interface DataSource {
  name: string;
  type: 'api' | 'scraper' | 'tool' | 'cache';
  url?: string;
  priority: number; // 1 = highest
  requiredEnv?: string[]; // ต้องมี env vars
}

export interface ResponseSchema {
  format: 'structured' | 'text' | 'mixed';
  requiredFields: string[];
  optionalFields?: string[];
  exampleResponse: any;
}

export interface FallbackHandler {
  message: string; // ข้อความสำรอง
  suggestedAction?: string; // แนะนำผู้ใช้ทำอะไรต่อ
  fallbackData?: any; // ข้อมูลสำรอง (ถ้ามี)
}

/**
 * ตารางเชื่อม Intent → Route Configuration
 * 
 * สำหรับ dev ท่านอื่น: เมื่อต้องเพิ่ม intent ใหม่
 * 1. เพิ่มใน IntentType (classifier.ts)
 * 2. เพิ่ม route config ที่นี่
 * 3. สร้าง data fetcher ใน modules ที่เกี่ยวข้อง
 * 4. Update unit tests
 */
export const INTENT_ROUTES: Record<IntentType, RouteConfig> = {
  /**
   * WeatherNow: สภาพอากาศปัจจุบัน
   * ต้องการข้อมูลสด ≤5 นาที
   */
  WeatherNow: {
    intent: 'WeatherNow',
    dataSources: [
      {
        name: 'Open-Meteo',
        type: 'api',
        url: 'https://api.open-meteo.com/v1/forecast',
        priority: 1,
        requiredEnv: [],
      },
      {
        name: 'OpenWeather',
        type: 'api',
        url: 'https://api.openweathermap.org/data/2.5/weather',
        priority: 2,
        requiredEnv: ['OPENWEATHER_API_KEY'],
      },
      {
        name: 'TMD Radar',
        type: 'api',
        url: 'https://data.tmd.go.th/api/radar',
        priority: 3,
        requiredEnv: ['TMD_API_KEY'],
      },
    ],
    responseSchema: {
      format: 'structured',
      requiredFields: ['isRaining', 'temperature', 'location', 'observedAt', 'sources'],
      optionalFields: ['humidity', 'windSpeed', 'pressure', 'cloudCover', 'rainChance'],
      exampleResponse: {
        isRaining: 'yes', // yes | no | likely
        temperature: 28.5,
        location: 'Bangkok, Thailand',
        observedAt: '2026-01-10T10:30:00+07:00',
        sources: [
          { name: 'Open-Meteo', url: 'https://open-meteo.com' },
        ],
        note: 'Cross-checked 2 sources',
      },
    },
    fallbackHandler: {
      message: 'ตอนนี้ไม่สามารถดึงข้อมูลสภาพอากาศสดได้ อาจเกิดจากการเชื่อมต่อไม่เสถียรหรือแหล่งข้อมูลชั่วคราวไม่พร้อม',
      suggestedAction: 'คุณสามารถตรวจสอบสภาพอากาศได้ที่ https://tmd.go.th หรือลองถามใหม่อีกครั้งในอีกสักครู่',
    },
    cacheTTL: 180, // 3 minutes
    timeout: 5000, // 5 seconds
  },

  /**
   * WeatherForecast: พยากรณ์อากาศล่วงหน้า
   * ใช้ NWP tools ที่มีอยู่แล้ว
   */
  WeatherForecast: {
    intent: 'WeatherForecast',
    dataSources: [
      {
        name: 'NWP Hourly by Location',
        type: 'tool',
        priority: 1,
      },
      {
        name: 'NWP Daily by Location',
        type: 'tool',
        priority: 2,
      },
      {
        name: 'Open-Meteo Forecast',
        type: 'api',
        url: 'https://api.open-meteo.com/v1/forecast',
        priority: 3,
      },
    ],
    responseSchema: {
      format: 'mixed',
      requiredFields: ['forecastPeriod', 'location', 'predictions', 'sources'],
      exampleResponse: {
        forecastPeriod: '24hours',
        location: 'Bangkok',
        predictions: [
          { time: '2026-01-10T12:00', temp: 32, rain: 10 },
        ],
        sources: ['NWP-TMD'],
      },
    },
    fallbackHandler: {
      message: 'ไม่สามารถดึงข้อมูลพยากรณ์อากาศได้ในขณะนี้',
      suggestedAction: 'กรุณาตรวจสอบที่ https://weather.tmd.go.th',
    },
    cacheTTL: 3600, // 1 hour
    timeout: 10000, // 10 seconds
  },

  /**
   * LocalTime: เวลาท้องถิ่น
   */
  LocalTime: {
    intent: 'LocalTime',
    dataSources: [
      {
        name: 'System Clock',
        type: 'tool',
        priority: 1,
      },
    ],
    responseSchema: {
      format: 'structured',
      requiredFields: ['datetime', 'timezone', 'humanReadable'],
      exampleResponse: {
        datetime: '2026-01-10T10:35:00+07:00',
        timezone: 'Asia/Bangkok (UTC+7)',
        humanReadable: 'วันศุกร์ที่ 10 มกราคม 2569 เวลา 10:35 น.',
      },
    },
    fallbackHandler: {
      message: 'ไม่สามารถดึงเวลาได้',
      suggestedAction: 'กรุณาตรวจสอบเวลาบนอุปกรณ์ของคุณ',
    },
    cacheTTL: 0, // ไม่ cache
    timeout: 500,
  },

  /**
   * CurrentOfficeHolder: ตำแหน่งบุคคลปัจจุบัน (เช่น นายกฯ)
   */
  CurrentOfficeHolder: {
    intent: 'CurrentOfficeHolder',
    dataSources: [
      {
        name: 'Thai Government Official',
        type: 'scraper',
        url: 'https://www.thaigov.go.th',
        priority: 1,
      },
      {
        name: 'Wikipedia',
        type: 'scraper',
        url: 'https://en.wikipedia.org/wiki/Prime_Minister_of_Thailand',
        priority: 2,
      },
    ],
    responseSchema: {
      format: 'structured',
      requiredFields: ['name', 'office', 'sources'],
      optionalFields: ['startedAt', 'party'],
      exampleResponse: {
        office: 'Prime Minister of Thailand',
        name: 'Paetongtarn Shinawatra',
        startedAt: '2024-08-18',
        sources: [
          { name: 'Royal Thai Government', url: 'https://www.thaigov.go.th' },
        ],
      },
    },
    fallbackHandler: {
      message: 'ไม่สามารถดึงข้อมูลตำแหน่งปัจจุบันได้',
      suggestedAction: 'กรุณาตรวจสอบที่ https://www.thaigov.go.th',
    },
    cacheTTL: 21600, // 6 hours
    timeout: 8000,
  },

  /**
   * GeneralFact: ความรู้ทั่วไป
   */
  GeneralFact: {
    intent: 'GeneralFact',
    dataSources: [
      {
        name: 'LLM Knowledge Base',
        type: 'tool',
        priority: 1,
      },
    ],
    responseSchema: {
      format: 'text',
      requiredFields: ['answer'],
      exampleResponse: {
        answer: 'คำตอบจากความรู้ทั่วไป',
      },
    },
    fallbackHandler: {
      message: 'ไม่พบข้อมูลที่ต้องการ',
    },
    timeout: 5000,
  },

  /**
   * OpenSearch: ค้นหาเว็บ
   */
  OpenSearch: {
    intent: 'OpenSearch',
    dataSources: [
      {
        name: 'Google Custom Search',
        type: 'api',
        priority: 1,
        requiredEnv: ['GOOGLE_SEARCH_API_KEY'],
      },
      {
        name: 'Brave Search',
        type: 'api',
        priority: 2,
        requiredEnv: ['BRAVE_SEARCH_API_KEY'],
      },
    ],
    responseSchema: {
      format: 'structured',
      requiredFields: ['results', 'sources'],
      exampleResponse: {
        results: [
          { title: 'Result', url: 'https://...', snippet: '...' },
        ],
        sources: ['Google'],
      },
    },
    fallbackHandler: {
      message: 'ไม่สามารถค้นหาได้ในขณะนี้',
    },
    timeout: 8000,
  },

  /**
   * ToolSpecific: ใช้ tool เฉพาะที่มีอยู่
   */
  ToolSpecific: {
    intent: 'ToolSpecific',
    dataSources: [
      {
        name: 'MCP Tools',
        type: 'tool',
        priority: 1,
      },
    ],
    responseSchema: {
      format: 'mixed',
      requiredFields: ['toolResponse'],
      exampleResponse: {
        toolResponse: 'ผลลัพธ์จาก tool',
      },
    },
    fallbackHandler: {
      message: 'เครื่องมือที่ระบุไม่พร้อมใช้งาน',
    },
    timeout: 15000,
  },

  /**
   * Fallback: ไม่สามารถจำแนก intent ได้
   */
  Fallback: {
    intent: 'Fallback',
    dataSources: [
      {
        name: 'LLM Default',
        type: 'tool',
        priority: 1,
      },
    ],
    responseSchema: {
      format: 'text',
      requiredFields: ['answer'],
      exampleResponse: {
        answer: 'คำตอบทั่วไป',
      },
    },
    fallbackHandler: {
      message: 'ขออภัยครับ ผมไม่เข้าใจคำถามของคุณ กรุณาลองถามใหม่อีกครั้ง',
      suggestedAction: 'คุณสามารถถามเกี่ยวกับ: สภาพอากาศ, เวลา, ข้อมูลทั่วไป หรือค้นหาข้อมูล',
    },
    timeout: 5000,
  },
};

/**
 * เลือก route config จาก classified intent
 */
export function getRouteConfig(intent: ClassifiedIntent): RouteConfig {
  return INTENT_ROUTES[intent.type];
}

/**
 * ตรวจสอบว่า data source พร้อมใช้งานไหม
 * (ตรวจ environment variables)
 */
export function isDataSourceAvailable(source: DataSource): boolean {
  if (!source.requiredEnv || source.requiredEnv.length === 0) {
    return true;
  }

  return source.requiredEnv.every((envVar) => {
    return process.env[envVar] !== undefined && process.env[envVar] !== '';
  });
}

/**
 * เลือก data source ที่พร้อมใช้งานตาม priority
 */
export function selectAvailableDataSource(config: RouteConfig): DataSource | null {
  const availableSources = config.dataSources
    .filter(isDataSourceAvailable)
    .sort((a, b) => a.priority - b.priority);

  return availableSources[0] || null;
}
