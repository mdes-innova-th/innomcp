/**
 * Location Resolution Module
 * แปลงชื่อสถานที่เป็นพิกัด (lat, lon)
 * 
 * Features:
 * - ค่าเริ่มต้น: กรุงเทพฯ (13.75, 100.5)
 * - รองรับเมืองหลักในไทย (preset)
 * - รองรับพิกัดที่ผู้ใช้ระบุ
 * - รองรับการระบุเขต/จังหวัด
 * 
 * @author MDES Development Team
 * @created 2026-01-10
 */

export interface Location {
  name: string;
  lat: number;
  lon: number;
  type: 'city' | 'province' | 'district' | 'custom';
  country: string;
}

/**
 * เมืองหลักในไทย (76 จังหวัด + เมืองสำคัญ)
 */
export const THAILAND_LOCATIONS: Record<string, Location> = {
  // กรุงเทพฯ และปริมณฑล
  'กรุงเทพ': { name: 'กรุงเทพมหานคร', lat: 13.75, lon: 100.5, type: 'city', country: 'Thailand' },
  'Bangkok': { name: 'Bangkok', lat: 13.75, lon: 100.5, type: 'city', country: 'Thailand' },
  'นนทบุรี': { name: 'นนทบุรี', lat: 13.86, lon: 100.52, type: 'province', country: 'Thailand' },
  'ปทุมธานี': { name: 'ปทุมธานี', lat: 14.02, lon: 100.52, type: 'province', country: 'Thailand' },
  'นครปฐม': { name: 'นครปฐม', lat: 13.82, lon: 100.04, type: 'province', country: 'Thailand' },
  'สมุทรปราการ': { name: 'สมุทรปราการ', lat: 13.60, lon: 100.60, type: 'province', country: 'Thailand' },
  'สมุทรสาคร': { name: 'สมุทรสาคร', lat: 13.55, lon: 100.27, type: 'province', country: 'Thailand' },

  // ภาคเหนือ
  'เชียงใหม่': { name: 'เชียงใหม่', lat: 18.78, lon: 98.98, type: 'city', country: 'Thailand' },
  'Chiang Mai': { name: 'Chiang Mai', lat: 18.78, lon: 98.98, type: 'city', country: 'Thailand' },
  'เชียงราย': { name: 'เชียงราย', lat: 19.91, lon: 99.83, type: 'province', country: 'Thailand' },
  'ลำปาง': { name: 'ลำปาง', lat: 18.29, lon: 99.49, type: 'province', country: 'Thailand' },
  'พะเยา': { name: 'พะเยา', lat: 19.19, lon: 99.90, type: 'province', country: 'Thailand' },
  'แม่ฮ่องสอน': { name: 'แม่ฮ่องสอน', lat: 19.30, lon: 97.97, type: 'province', country: 'Thailand' },

  // ภาคอีสาน
  'ขอนแก่น': { name: 'ขอนแก่น', lat: 16.43, lon: 102.82, type: 'city', country: 'Thailand' },
  'Khon Kaen': { name: 'Khon Kaen', lat: 16.43, lon: 102.82, type: 'city', country: 'Thailand' },
  'นครราชสีมา': { name: 'นครราชสีมา', lat: 14.97, lon: 102.08, type: 'city', country: 'Thailand' },
  'อุดรธานี': { name: 'อุดรธานี', lat: 17.41, lon: 102.79, type: 'province', country: 'Thailand' },
  'อุบลราชธานี': { name: 'อุบลราชธานี', lat: 15.23, lon: 104.86, type: 'province', country: 'Thailand' },
  'ร้อยเอ็ด': { name: 'ร้อยเอ็ด', lat: 16.05, lon: 103.65, type: 'province', country: 'Thailand' },

  // ภาคกลาง
  'อยุธยา': { name: 'พระนครศรีอยุธยา', lat: 14.35, lon: 100.58, type: 'province', country: 'Thailand' },
  'ลพบุรี': { name: 'ลพบุรี', lat: 14.80, lon: 100.62, type: 'province', country: 'Thailand' },
  'สุพรรณบุรี': { name: 'สุพรรณบุรี', lat: 14.47, lon: 100.12, type: 'province', country: 'Thailand' },

  // ภาคตะวันออก
  'พัทยา': { name: 'พัทยา', lat: 12.93, lon: 100.88, type: 'city', country: 'Thailand' },
  'Pattaya': { name: 'Pattaya', lat: 12.93, lon: 100.88, type: 'city', country: 'Thailand' },
  'ชลบุรี': { name: 'ชลบุรี', lat: 13.36, lon: 100.98, type: 'province', country: 'Thailand' },
  'ระยอง': { name: 'ระยอง', lat: 12.68, lon: 101.28, type: 'province', country: 'Thailand' },
  'ตราด': { name: 'ตราด', lat: 12.24, lon: 102.52, type: 'province', country: 'Thailand' },

  // ภาคใต้
  'ภูเก็ต': { name: 'ภูเก็ต', lat: 7.89, lon: 98.39, type: 'city', country: 'Thailand' },
  'Phuket': { name: 'Phuket', lat: 7.89, lon: 98.39, type: 'city', country: 'Thailand' },
  'สุราษฎร์ธานี': { name: 'สุราษฎร์ธานี', lat: 9.14, lon: 99.33, type: 'province', country: 'Thailand' },
  'หาดใหญ่': { name: 'หาดใหญ่', lat: 7.01, lon: 100.47, type: 'city', country: 'Thailand' },
  'Hat Yai': { name: 'Hat Yai', lat: 7.01, lon: 100.47, type: 'city', country: 'Thailand' },
  'สงขลา': { name: 'สงขลา', lat: 7.20, lon: 100.60, type: 'province', country: 'Thailand' },
  'กระบี่': { name: 'กระบี่', lat: 8.06, lon: 98.91, type: 'province', country: 'Thailand' },
};

/**
 * ค่าเริ่มต้น: กรุงเทพฯ
 */
export const DEFAULT_LOCATION: Location = THAILAND_LOCATIONS['Bangkok'];

/**
 * แปลงชื่อสถานที่เป็นพิกัด
 * รองรับทั้งภาษาไทยและอังกฤษ
 */
export function resolveLocation(query: string): Location {
  const normalizedQuery = query.trim();

  // ตรวจสอบในฐานข้อมูล
  for (const [key, location] of Object.entries(THAILAND_LOCATIONS)) {
    if (
      normalizedQuery.includes(key) ||
      normalizedQuery.includes(location.name) ||
      key.toLowerCase() === normalizedQuery.toLowerCase()
    ) {
      return location;
    }
  }

  // ตรวจสอบว่ามีพิกัดในคำถามไหม (lat, lon)
  const coordMatch = query.match(/(\d+\.?\d*)\s*,\s*(\d+\.?\d*)/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);

    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return {
        name: `Custom Location (${lat}, ${lon})`,
        lat,
        lon,
        type: 'custom',
        country: 'Unknown',
      };
    }
  }

  // ตรวจสอบรูปแบบ lat=X, lon=Y
  const latLonMatch = query.match(/lat\s*=\s*(\d+\.?\d*)/i);
  const lonMatch = query.match(/lon\s*=\s*(\d+\.?\d*)/i);

  if (latLonMatch && lonMatch) {
    const lat = parseFloat(latLonMatch[1]);
    const lon = parseFloat(lonMatch[1]);

    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return {
        name: `Custom Location (${lat}, ${lon})`,
        lat,
        lon,
        type: 'custom',
        country: 'Unknown',
      };
    }
  }

  // ไม่พบสถานที่ → ใช้ค่าเริ่มต้น (กรุงเทพฯ)
  console.log(`[Location Module] Location not found: "${query}", using default (Bangkok)`);
  return DEFAULT_LOCATION;
}

/**
 * ดึงรายชื่อจังหวัดทั้งหมดในไทย
 */
export function getAllProvinces(): Location[] {
  return Object.values(THAILAND_LOCATIONS).filter((loc) => loc.type === 'province');
}

/**
 * ดึงรายชื่อเมืองสำคัญ
 */
export function getMajorCities(): Location[] {
  return Object.values(THAILAND_LOCATIONS).filter((loc) => loc.type === 'city');
}

/**
 * ตรวจสอบว่าพิกัดอยู่ในประเทศไทยหรือไม่
 */
export function isInThailand(lat: number, lon: number): boolean {
  // ประเทศไทย: lat 5.61 - 20.46, lon 97.34 - 105.64
  return lat >= 5.61 && lat <= 20.46 && lon >= 97.34 && lon <= 105.64;
}

/**
 * หมายเหตุสำหรับการพัฒนาต่อ:
 * 
 * 1. ถ้าต้องการครอบคลุมทุกจังหวัด (76 จังหวัด) เพิ่มข้อมูลใน THAILAND_LOCATIONS
 * 2. ถ้าต้องการรองรับระดับอำเภอ/ตำบล ควรใช้ geocoding API (Google Maps, Nominatim)
 * 3. สามารถ cache location mapping ใน Redis เพื่อลด latency
 * 4. รองรับภาษาอังกฤษด้วยการเพิ่ม alias (เช่น "Bangkok" = "กรุงเทพ")
 */
