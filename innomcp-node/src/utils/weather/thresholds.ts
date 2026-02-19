/**
 * Threshold Policy Documentation
 * กำหนดเงื่อนไขการตัดสินใจสำหรับสภาพอากาศ
 * 
 * @author MDES Development Team
 * @created 2026-01-10
 */

/**
 * ==========================================
 * RAINFALL DETECTION POLICY
 * ==========================================
 * 
 * กำหนดเงื่อนไขว่า "ฝนตก" เมื่อใด:
 * 
 * 1. PRIMARY INDICATOR: Precipitation (mm)
 *    - precipitation > 0 → ฝนตก
 *    - precipitation = 0 → ไม่ตก
 * 
 * 2. SECONDARY INDICATOR: Weather Code (WMO standard)
 *    Rain codes:
 *    - 51, 53, 55: Drizzle (light, moderate, dense)
 *    - 61, 63, 65: Rain (light, moderate, heavy)
 *    - 80, 81, 82: Rain showers (light, moderate, violent)
 *    - 95, 96, 99: Thunderstorm (with rain)
 * 
 *    ถ้า weather_code อยู่ในกลุ่มนี้ → ฝนตก
 * 
 * 3. COMBINED LOGIC:
 *    - precipitation > 0 OR weather_code in rain_codes → "yes" (ฝนตก)
 *    - weather_code in [45-48] (fog) → "likely" (มีแนวโน้ม)
 *    - precipitation = 0 AND weather_code not in rain_codes → "no" (ไม่ตก)
 * 
 * 4. RAIN PROBABILITY (ถ้ามีข้อมูล):
 *    - rainChance > 50% → "likely" (มีแนวโน้ม)
 *    - rainChance > 70% → "yes" (กำลังตก/จะตก)
 */

export const RAIN_WEATHER_CODES = [
  // Drizzle
  51, 53, 55,
  // Rain
  61, 63, 65,
  // Rain showers
  80, 81, 82,
  // Thunderstorm
  95, 96, 99,
];

export const FOG_CODES = [45, 46, 47, 48];

export type RainStatus = 'yes' | 'no' | 'likely';

/**
 * ตัดสินว่าฝนตกหรือไม่ตาม Threshold Policy
 */
export function determineRainStatus(
  precipitation: number,
  weatherCode: number,
  rainChance?: number
): RainStatus {
  // Rule 1: Precipitation > 0
  if (precipitation > 0) {
    return 'yes';
  }

  // Rule 2: Weather code in rain codes
  if (RAIN_WEATHER_CODES.includes(weatherCode)) {
    return 'yes';
  }

  // Rule 3: Rain probability
  if (rainChance !== undefined) {
    if (rainChance > 70) {
      return 'yes';
    }
    if (rainChance > 50) {
      return 'likely';
    }
  }

  // Rule 4: Fog conditions
  if (FOG_CODES.includes(weatherCode)) {
    return 'likely';
  }

  // Default: No rain
  return 'no';
}

/**
 * ==========================================
 * TEMPERATURE THRESHOLDS
 * ==========================================
 * 
 * สำหรับประเทศไทย:
 * - ร้อนมาก: > 35°C
 * - ร้อน: 30-35°C
 * - อบอุ่น: 25-30°C
 * - เย็นสบาย: 20-25°C
 * - เย็น: 15-20°C
 * - หนาว: < 15°C
 */

export type TemperatureCategory = 'very_hot' | 'hot' | 'warm' | 'pleasant' | 'cool' | 'cold';

export function categorizeTemperature(tempC: number): {
  category: TemperatureCategory;
  label: string;
} {
  if (tempC > 35) {
    return { category: 'very_hot', label: 'ร้อนมาก' };
  }
  if (tempC > 30) {
    return { category: 'hot', label: 'ร้อน' };
  }
  if (tempC > 25) {
    return { category: 'warm', label: 'อบอุ่น' };
  }
  if (tempC > 20) {
    return { category: 'pleasant', label: 'เย็นสบาย' };
  }
  if (tempC > 15) {
    return { category: 'cool', label: 'เย็น' };
  }
  return { category: 'cold', label: 'หนาว' };
}

/**
 * ==========================================
 * WIND SPEED THRESHOLDS
 * ==========================================
 * 
 * - สงบ: < 10 km/h
 * - ลมเบา: 10-20 km/h
 * - ลมปานกลาง: 20-30 km/h
 * - ลมแรง: 30-50 km/h
 * - ลมแรงมาก: > 50 km/h
 */

export function categorizeWindSpeed(windKmh: number): string {
  if (windKmh < 10) return 'สงบ';
  if (windKmh < 20) return 'ลมเบา';
  if (windKmh < 30) return 'ลมปานกลาง';
  if (windKmh < 50) return 'ลมแรง';
  return 'ลมแรงมาก';
}

/**
 * ==========================================
 * HUMIDITY THRESHOLDS
 * ==========================================
 * 
 * - แห้งมาก: < 30%
 * - แห้ง: 30-50%
 * - ปานกลาง: 50-70%
 * - ชื้น: 70-85%
 * - ชื้นมาก: > 85%
 */

export function categorizeHumidity(humidity: number): string {
  if (humidity < 30) return 'แห้งมาก';
  if (humidity < 50) return 'แห้ง';
  if (humidity < 70) return 'ปานกลาง';
  if (humidity < 85) return 'ชื้น';
  return 'ชื้นมาก';
}

/**
 * ==========================================
 * DATA FRESHNESS POLICY
 * ==========================================
 * 
 * กำหนดว่าข้อมูลถือว่า "สด" หรือ "เก่าเกินไป":
 * 
 * WeatherNow:
 * - Fresh: < 10 minutes
 * - Acceptable: 10-30 minutes
 * - Stale: > 30 minutes
 * 
 * WeatherForecast:
 * - Fresh: < 1 hour
 * - Acceptable: 1-6 hours
 * - Stale: > 6 hours
 * 
 * CurrentOfficeHolder:
 * - Fresh: < 1 day
 * - Acceptable: 1-7 days
 * - Stale: > 7 days
 */

export function isDataFresh(
  timestamp: string,
  intentType: 'WeatherNow' | 'WeatherForecast' | 'CurrentOfficeHolder' | 'General'
): { fresh: boolean; ageMinutes: number } {
  const now = new Date();
  const dataTime = new Date(timestamp);
  const ageMs = now.getTime() - dataTime.getTime();
  const ageMinutes = ageMs / (1000 * 60);

  let fresh = false;
  switch (intentType) {
    case 'WeatherNow':
      fresh = ageMinutes < 10;
      break;
    case 'WeatherForecast':
      fresh = ageMinutes < 60;
      break;
    case 'CurrentOfficeHolder':
      fresh = ageMinutes < 24 * 60;
      break;
    default:
      fresh = ageMinutes < 60;
  }

  return { fresh, ageMinutes };
}

/**
 * หมายเหตุสำหรับการพัฒนาต่อ:
 * 
 * 1. Threshold values ควรปรับตาม user feedback
 * 2. สามารถเพิ่ม machine learning เพื่อเรียนรู้ threshold ที่เหมาะสม
 * 3. ควรมี A/B testing สำหรับ threshold ที่ต่างกัน
 * 4. เก็บ metrics เพื่อวิเคราะห์ accuracy ของ threshold
 */
