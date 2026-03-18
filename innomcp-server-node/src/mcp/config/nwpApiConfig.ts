/**
 * NWP API Province → Lat/Lon mapping
 * ใช้เป็น fallback เมื่อ NWP place endpoint ไม่รู้จักชื่อจังหวัด
 * หรือเมื่อต้องการ call ByLocation endpoint แทน ByPlace
 *
 * Source: กรมการปกครอง + กรมอุตุนิยมวิทยา (ศูนย์กลางจังหวัด)
 */

export interface ProvinceCoords {
  lat: number;
  lon: number;
  /** ภูมิภาคสำหรับ NWP region code */
  region: "C" | "N" | "NE" | "E" | "S" | "W";
}

/**
 * Province name → coordinates map
 * รองรับตัวสะกดหลายแบบ (aliases) เช่น ภูเก็ต/ภูเกตุ, กรุงเทพ/กรุงเทพมหานคร
 */
const PROVINCE_COORDS: Record<string, ProvinceCoords> = {
  // ── ภาคกลาง (C) ──
  "กรุงเทพมหานคร":   { lat: 13.7563, lon: 100.5018, region: "C" },
  "กรุงเทพ":          { lat: 13.7563, lon: 100.5018, region: "C" },
  "กทม":              { lat: 13.7563, lon: 100.5018, region: "C" },
  "bangkok":          { lat: 13.7563, lon: 100.5018, region: "C" },
  "นนทบุรี":          { lat: 13.8621, lon: 100.5144, region: "C" },
  "ปทุมธานี":         { lat: 14.0208, lon: 100.5250, region: "C" },
  "พระนครศรีอยุธยา": { lat: 14.3532, lon: 100.5674, region: "C" },
  "อยุธยา":           { lat: 14.3532, lon: 100.5674, region: "C" },
  "สระบุรี":          { lat: 14.5289, lon: 100.9107, region: "C" },
  "ลพบุรี":           { lat: 14.7995, lon: 100.6534, region: "C" },
  "สิงห์บุรี":        { lat: 14.8936, lon: 100.4014, region: "C" },
  "ชัยนาท":           { lat: 15.1851, lon: 100.1253, region: "C" },
  "อ่างทอง":          { lat: 14.5896, lon: 100.4549, region: "C" },
  "นครนายก":          { lat: 14.2069, lon: 101.2130, region: "C" },
  "นครปฐม":           { lat: 13.8199, lon: 100.0450, region: "C" },
  "สมุทรปราการ":      { lat: 13.5991, lon: 100.5998, region: "C" },
  "สมุทรสาคร":        { lat: 13.5475, lon: 100.2747, region: "C" },
  "สมุทรสงคราม":      { lat: 13.4098, lon: 100.0023, region: "C" },
  "สุพรรณบุรี":       { lat: 14.4744, lon: 100.1177, region: "C" },
  "กาญจนบุรี":        { lat: 14.0023, lon: 99.5328, region: "C" },
  "ราชบุรี":          { lat: 13.5280, lon: 99.8134, region: "C" },
  "เพชรบุรี":         { lat: 13.1119, lon: 99.9390, region: "C" },
  "ประจวบคีรีขันธ์":  { lat: 11.8126, lon: 99.7957, region: "C" },

  // ── ภาคเหนือ (N) ──
  "เชียงใหม่":        { lat: 18.7883, lon: 98.9853, region: "N" },
  "เชียงราย":         { lat: 19.9071, lon: 99.8328, region: "N" },
  "แม่ฮ่องสอน":      { lat: 19.3020, lon: 97.9654, region: "N" },
  "ลำพูน":            { lat: 18.5744, lon: 99.0087, region: "N" },
  "ลำปาง":            { lat: 18.2888, lon: 99.4909, region: "N" },
  "แพร่":             { lat: 18.1445, lon: 100.1403, region: "N" },
  "น่าน":             { lat: 18.7756, lon: 100.7730, region: "N" },
  "พะเยา":            { lat: 19.1664, lon: 99.9019, region: "N" },
  "อุตรดิตถ์":        { lat: 17.6200, lon: 100.0993, region: "N" },
  "สุโขทัย":          { lat: 17.0068, lon: 99.8265, region: "N" },
  "พิษณุโลก":         { lat: 16.8211, lon: 100.2659, region: "N" },
  "พิจิตร":           { lat: 16.4430, lon: 100.3490, region: "N" },
  "กำแพงเพชร":        { lat: 16.4827, lon: 99.5226, region: "N" },
  "ตาก":              { lat: 16.8840, lon: 99.1259, region: "N" },
  "นครสวรรค์":        { lat: 15.7030, lon: 100.1371, region: "N" },
  "อุทัยธานี":        { lat: 15.3835, lon: 100.0255, region: "N" },
  "เพชรบูรณ์":        { lat: 16.4189, lon: 101.1550, region: "N" },

  // ── ภาคตะวันออกเฉียงเหนือ (NE) ──
  "ขอนแก่น":          { lat: 16.4419, lon: 102.8360, region: "NE" },
  "อุดรธานี":         { lat: 17.4108, lon: 102.7875, region: "NE" },
  "หนองคาย":          { lat: 17.8783, lon: 102.7417, region: "NE" },
  "หนองบัวลำภู":      { lat: 17.2217, lon: 102.4260, region: "NE" },
  "เลย":              { lat: 17.4860, lon: 101.7223, region: "NE" },
  "นครพนม":           { lat: 17.3922, lon: 104.7726, region: "NE" },
  "สกลนคร":           { lat: 17.1664, lon: 104.1486, region: "NE" },
  "มุกดาหาร":         { lat: 16.5436, lon: 104.7234, region: "NE" },
  "กาฬสินธุ์":        { lat: 16.4314, lon: 103.5059, region: "NE" },
  "อำนาจเจริญ":       { lat: 15.8656, lon: 104.6254, region: "NE" },
  "ยโสธร":            { lat: 15.7929, lon: 104.1452, region: "NE" },
  "ร้อยเอ็ด":         { lat: 16.0538, lon: 103.6520, region: "NE" },
  "นครราชสีมา":       { lat: 14.9799, lon: 102.0978, region: "NE" },
  "โคราช":            { lat: 14.9799, lon: 102.0978, region: "NE" },
  "ชัยภูมิ":          { lat: 15.8068, lon: 102.0317, region: "NE" },
  "บุรีรัมย์":        { lat: 14.9930, lon: 103.1029, region: "NE" },
  "สุรินทร์":         { lat: 14.8830, lon: 103.4937, region: "NE" },
  "ศรีสะเกษ":         { lat: 15.1186, lon: 104.3220, region: "NE" },
  "อุบลราชธานี":      { lat: 15.2448, lon: 104.8474, region: "NE" },
  "บึงกาฬ":           { lat: 18.3609, lon: 103.6461, region: "NE" },
  "มหาสารคาม":        { lat: 16.1851, lon: 103.3009, region: "NE" },

  // ── ภาคตะวันออก (E) ──
  "ชลบุรี":           { lat: 13.3611, lon: 100.9847, region: "E" },
  "ระยอง":            { lat: 12.6814, lon: 101.2816, region: "E" },
  "จันทบุรี":         { lat: 12.6097, lon: 102.1048, region: "E" },
  "ตราด":             { lat: 12.2428, lon: 102.5175, region: "E" },
  "ฉะเชิงเทรา":       { lat: 13.6902, lon: 101.0779, region: "E" },
  "ปราจีนบุรี":       { lat: 14.0521, lon: 101.3694, region: "E" },
  "สระแก้ว":          { lat: 13.8239, lon: 102.0642, region: "E" },

  // ── ภาคใต้ (S) ──
  "ภูเก็ต":           { lat: 7.8804, lon: 98.3923, region: "S" },
  "ภูเกตุ":           { lat: 7.8804, lon: 98.3923, region: "S" },
  "phuket":           { lat: 7.8804, lon: 98.3923, region: "S" },
  "สงขลา":            { lat: 7.1897, lon: 100.5951, region: "S" },
  "สุราษฎร์ธานี":     { lat: 9.1382, lon: 99.3214, region: "S" },
  "นครศรีธรรมราช":    { lat: 8.4325, lon: 99.9628, region: "S" },
  "กระบี่":           { lat: 8.0863, lon: 98.9063, region: "S" },
  "พังงา":            { lat: 8.4510, lon: 98.5258, region: "S" },
  "ระนอง":            { lat: 9.9583, lon: 98.6090, region: "S" },
  "ชุมพร":            { lat: 10.4930, lon: 99.1800, region: "S" },
  "ตรัง":             { lat: 7.5596, lon: 99.6113, region: "S" },
  "พัทลุง":           { lat: 7.6168, lon: 100.0742, region: "S" },
  "สตูล":             { lat: 6.6238, lon: 100.0677, region: "S" },
  "ปัตตานี":          { lat: 6.8696, lon: 101.2501, region: "S" },
  "ยะลา":             { lat: 6.5419, lon: 101.2804, region: "S" },
  "นราธิวาส":         { lat: 6.4254, lon: 101.8253, region: "S" },

  // ── ภาคตะวันตก (W) ──
  "ตาก (ตะวันตก)":   { lat: 16.8840, lon: 99.1259, region: "W" },
};

/**
 * ค้นหา coordinates ของจังหวัด (case-insensitive + trim whitespace)
 * รองรับชื่อย่อ เช่น "กทม" "โคราช" หรือตัวสะกดแตกต่าง เช่น "ภูเกตุ"
 */
export function getProvinceCoords(name: string): ProvinceCoords | undefined {
  if (!name) return undefined;
  const normalized = name.trim().toLowerCase();
  // exact match case-insensitive
  for (const [key, val] of Object.entries(PROVINCE_COORDS)) {
    if (key.toLowerCase() === normalized) return val;
  }
  // partial match — prefer shortest key that contains the query
  const partials = Object.entries(PROVINCE_COORDS)
    .filter(([k]) => k.toLowerCase().includes(normalized) || normalized.includes(k.toLowerCase()))
    .sort(([a], [b]) => a.length - b.length);
  return partials[0]?.[1];
}

/**
 * NWP region code → Thai name
 */
export const NWP_REGION_NAMES: Record<string, string> = {
  C: "ภาคกลาง",
  N: "ภาคเหนือ",
  NE: "ภาคตะวันออกเฉียงเหนือ (อีสาน)",
  E: "ภาคตะวันออก",
  S: "ภาคใต้",
  W: "ภาคตะวันตก",
};

export interface RegionBbox {
  /** "lat,lon" — bottom-left corner for /forecast/area/box */
  bottomLeft: string;
  /** "lat,lon" — top-right corner for /forecast/area/box */
  topRight: string;
}

/**
 * NWP region code → bounding box สำหรับ /forecast/area/box endpoint
 * ใช้แทน /forecast/location/daily|hourly/region ที่ต้องการ scope พิเศษ
 */
export const NWP_REGION_BBOX: Record<string, RegionBbox> = {
  C:  { bottomLeft: "11.0,98.0",  topRight: "17.0,101.5" },  // ภาคกลาง
  N:  { bottomLeft: "16.5,97.5",  topRight: "21.0,101.5" },  // ภาคเหนือ
  NE: { bottomLeft: "14.0,101.0", topRight: "18.5,105.5" },  // ภาคตะวันออกเฉียงเหนือ
  E:  { bottomLeft: "12.0,100.5", topRight: "14.5,102.8" },  // ภาคตะวันออก
  S:  { bottomLeft: "5.5,98.5",   topRight: "12.0,101.8" },  // ภาคใต้
  W:  { bottomLeft: "13.0,97.5",  topRight: "18.0,100.0" },  // ภาคตะวันตก
};

export function getRegionBbox(region: string): RegionBbox | undefined {
  return NWP_REGION_BBOX[region];
}
