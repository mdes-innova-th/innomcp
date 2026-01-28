/**
 * Response Schema Contracts
 * กำหนด TypeScript interfaces สำหรับแต่ละ intent
 * เพื่อให้คำตอบมีโครงสร้างชัด และตรวจสอบได้
 * 
 * @author MDES Development Team
 * @created 2026-01-10
 */

/**
 * Base Response Interface
 * ใช้ร่วมกันทุก intent
 */
export interface BaseResponse {
  intent: string;
  timestamp: string; // ISO 8601
  success: boolean;
  latencyMs: number;
  sources: SourceReference[];
  note?: string;
  error?: ErrorDetails;
}

export interface SourceReference {
  name: string;
  url: string;
  accessedAt: string; // ISO 8601 timestamp
  reliability: 'high' | 'medium' | 'low';
  dataAge?: number; // seconds since data was generated
  checksum?: string; // สำหรับตรวจสอบความถูกต้อง
}

export interface ErrorDetails {
  code: string; // 'NETWORK_ERROR', 'AUTH_ERROR', 'QUOTA_EXCEEDED', etc.
  message: string;
  details?: any;
}

/**
 * ==========================================
 * WeatherNow Response
 * ==========================================
 */
export interface WeatherNowResponse extends BaseResponse {
  intent: 'WeatherNow';
  data: {
    isRaining: 'yes' | 'no' | 'likely';
    temperature: number; // °C
    humidity?: number; // %
    windSpeed?: number; // km/h
    pressure?: number; // hPa
    cloudCover?: number; // %
    rainChance?: number; // %
    weatherCode?: number;
    weatherDescription?: string;
    location: {
      name: string;
      coordinates: {
        lat: number;
        lon: number;
      };
    };
    observedAt: string; // ISO timestamp
  };
  explanation: string; // เหตุผลการตัดสิน เช่น "precipitation=0, code=0 → ไม่ตก"
}

/**
 * ==========================================
 * WeatherForecast Response
 * ==========================================
 */
export interface WeatherForecastResponse extends BaseResponse {
  intent: 'WeatherForecast';
  data: {
    forecastPeriod: string; // '24hours', '7days', '30days'
    location: {
      name: string;
      coordinates: {
        lat: number;
        lon: number;
      };
    };
    predictions: ForecastPoint[];
    summary?: string; // สรุปแนวโน้ม
  };
}

export interface ForecastPoint {
  time: string; // ISO timestamp
  temperature: number;
  tempMin?: number;
  tempMax?: number;
  precipitation?: number;
  rainChance?: number;
  weatherCode?: number;
  weatherDescription?: string;
}

/**
 * ==========================================
 * LocalTime Response
 * ==========================================
 */
export interface LocalTimeResponse extends BaseResponse {
  intent: 'LocalTime';
  data: {
    datetime: string; // ISO 8601
    timezone: string; // "Asia/Bangkok (UTC+7)"
    humanReadable: string; // "วันศุกร์ที่ 10 มกราคม 2569 เวลา 22:30:00"
    timestamp: number; // Unix timestamp
    components: {
      year: number;
      month: number;
      day: number;
      weekday: string;
      hour: number;
      minute: number;
      second: number;
    };
  };
}

/**
 * ==========================================
 * CurrentOfficeHolder Response
 * ==========================================
 */
export interface CurrentOfficeHolderResponse extends BaseResponse {
  intent: 'CurrentOfficeHolder';
  data: {
    office: string; // "นายกรัฐมนตรี"
    name: string;
    party?: string;
    startedAt?: string; // ISO date
    endedAt?: string;
    previousHolder?: string;
    biography?: string;
  };
}

/**
 * ==========================================
 * OpenSearch Response
 * ==========================================
 */
export interface OpenSearchResponse extends BaseResponse {
  intent: 'OpenSearch';
  data: {
    query: string;
    results: SearchResult[];
    totalResults: number;
    topDomains?: string[]; // Top domains found
  };
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  domain?: string;
  score?: number;
}

/**
 * ==========================================
 * GeneralFact Response
 * ==========================================
 */
export interface GeneralFactResponse extends BaseResponse {
  intent: 'GeneralFact';
  data: {
    question: string;
    answer: string;
    confidence?: number; // 0-1
    relatedTopics?: string[];
  };
}

/**
 * ==========================================
 * Fallback Response
 * ==========================================
 */
export interface FallbackResponse extends BaseResponse {
  intent: 'Fallback';
  data: {
    originalQuery: string;
    reason: string; // เหตุผลที่ไม่สามารถตอบได้
    suggestions?: string[]; // คำแนะนำสำหรับผู้ใช้
    alternativeQuestions?: string[]; // คำถามที่เกี่ยวข้อง
  };
}

/**
 * Union type สำหรับทุก response
 */
export type IntentResponse =
  | WeatherNowResponse
  | WeatherForecastResponse
  | LocalTimeResponse
  | CurrentOfficeHolderResponse
  | OpenSearchResponse
  | GeneralFactResponse
  | FallbackResponse;

/**
 * Type guard functions
 */
export function isWeatherNowResponse(
  response: IntentResponse
): response is WeatherNowResponse {
  return response.intent === 'WeatherNow';
}

export function isLocalTimeResponse(
  response: IntentResponse
): response is LocalTimeResponse {
  return response.intent === 'LocalTime';
}

export function isOfficeHolderResponse(
  response: IntentResponse
): response is CurrentOfficeHolderResponse {
  return response.intent === 'CurrentOfficeHolder';
}

/**
 * Validation functions
 */
export function validateWeatherNowResponse(
  response: any
): response is WeatherNowResponse {
  return (
    response.intent === 'WeatherNow' &&
    response.data &&
    typeof response.data.isRaining === 'string' &&
    ['yes', 'no', 'likely'].includes(response.data.isRaining) &&
    typeof response.data.temperature === 'number' &&
    response.data.location &&
    typeof response.data.location.name === 'string'
  );
}

/**
 * หมายเหตุสำหรับการพัฒนาต่อ:
 * 
 * 1. ใช้ JSON Schema validation library (Zod, Joi, Yup)
 * 2. Generate OpenAPI/Swagger docs จาก types
 * 3. Versioning: เพิ่ม schemaVersion field
 * 4. เพิ่ม metadata: requestId, userId, sessionId
 * 5. Support streaming responses สำหรับ LLM
 */
