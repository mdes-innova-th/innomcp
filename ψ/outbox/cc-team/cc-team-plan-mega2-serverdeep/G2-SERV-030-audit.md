<!-- cc-team deliverable
 group: G2 (serverdeep division)
 member: SERV-030 role=audit model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":3331,"completion_tokens":2995,"total_tokens":6326,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 29s
 generated: 2026-06-13T12:17:21.383Z -->
```typescript
import { z } from "zod";
import axios from "axios";

/**
 * NWP Daily Forecast Tool
 * ข้อมูลพยากรณ์อากาศรายวันจากคอมพิวเตอร์สมรรถนะสูง (High Performance Computing)
 * - ความละเอียด: 18-27 กม.
 * - ล่วงหน้าสูงสุด: 126 วัน
 * - ตัวแปร: อุณหภูมิสูงสุด-ต่ำสุด, ความชื้น, ฝน, ลม, เมฆ, สภาพอากาศ
 */

const NWP_API_BASE = "https://data.tmd.go.th/nwpapi/v1/forecast/location/daily";
const NWP_AREA_REGION_API_BASE = "https://data.tmd.go.th/nwpapi/v1/forecast/area/region";
const DEFAULT_TIMEOUT = 15000;

function getNwpApiKey(): string {
  const key = String(process.env.NWP_API_KEY || "").trim();
  if (!key) {
    throw new Error("NWP_API_KEY not found in environment variables");
  }

  // Live Mode validation:
  const isSmoke = process.env.SMOKE_MODE === "1";
  const isFixture = process.env.WEATHER_FIXTURE_W1 === "1" || process.env.CHAT_TRACE_QA === "1";
  const isLiveMode = !isSmoke && !isFixture;

  if (isLiveMode && (key === "demo" || key === "demokey" || key.includes("api12345"))) {
    throw new Error("TMD_API_LIVE_MODE_DEMO_KEY_BLOCKED: Using demo keys in Live Mode is prohibited.");
  }

  return key;
}

// ตัวแปรพยากรณ์รายวันที่รองรับ
const AVAILABLE_FIELDS = [
  "tc_max", "tc_min", "rh", "slp", "psfc", "rain", "ws10m", "wd10m",
  "ws925", "wd925", "ws850", "wd850", "ws700", "wd700", "ws500", "wd500", "ws200", "wd200",
  "cloudlow", "cloudmed", "cloudhigh", "swdown", "cond"
] as const;

// Weather condition meanings
const WEATHER_CONDITIONS = {
  1: "ท้องฟ้าแจ่มใส (Clear)",
  2: "มีเมฆบางส่วน (Partly cloudy)",
  3: "เมฆเป็นส่วนมาก (Cloudy)",
  4: "มีเมฆมาก (Overcast)",
  5: "ฝนตกเล็กน้อย (Light rain)",
  6: "ฝนปานกลาง (Moderate rain)",
  7: "ฝนตกหนัก (Heavy rain)",
  8: "ฝนฟ้าคะนอง (Thunderstorm)",
  9: "อากาศหนาวจัด (Very cold)",
  10: "อากาศหนาว (Cold)",
  11: "อากาศเย็น (Cool)",
  12: "อากาศร้อนจัด (Very hot)"
} as const;

// Schema for location by coordinates
export const nwpDailyByLocationSchema = z.object({
  lat: z.number().min(-90).max(90).describe("พิกัดละติจูด (latitude)"),
  lon: z.number().min(-180).max(180).describe("พิกัดลองจิจูด (longitude)"),
  date: z.string().optional().describe("วันที่เริ่มต้น (YYYY-MM-DD) Default: วันนี้"),
  starttime: z.string().optional().describe("alias ของ date (YYYY-MM-DD) — ใช้แทน date ได้"),
  duration: z.number().min(1).max(126).optional().default(7).describe("จำนวนวัน (1-126) Default: 7"),
  domain: z.string().optional().describe("NWP forecast domain (เช่น thai, sea) Default: ใช้ค่า default ของ API"),
  fields: z.array(z.enum(AVAILABLE_FIELDS)).optional().describe("ตัวแปรที่ต้องการ Default: tc_max,tc_min,rain,cond"),
});

// Schema for location by place name
export const nwpDailyByPlaceSchema = z.object({
  place: z.string().optional().describe("ชื่อสถานที่แบบสั้น เช่น จังหวัดหรืออำเภอ (alias ของ province เพื่อรองรับตัวเรียกเก่า)"),
  province: z.string().optional().describe("ชื่อจังหวัด (ภาษาไทย)"),
  amphoe: z.string().optional().describe("ชื่ออำเภอ (ภาษาไทย)"),
  tambon: z.string().optional().describe("ชื่อตำบล (ภาษาไทย)"),
  subarea: z.boolean().optional().describe("แนบข้อมูลสถานที่ย่อยด้วย Default: false"),
  date: z.string().optional().describe("วันที่เริ่มต้น (YYYY-MM-DD)"),
  starttime: z.string().optional().describe("alias ของ date (YYYY-MM-DD)"),
  duration: z.number().min(1).max(126).optional().default(7).describe("จำนวนวัน (1-126)"),
  domain: z.string().optional().describe("NWP forecast domain (เช่น thai, sea) Default: ใช้ค่า default ของ API"),
  fields: z.array(z.enum(AVAILABLE_FIELDS)).optional().describe("ตัวแปรที่ต้องการ"),
});

// Schema for location by region
export const nwpDailyByRegionSchema = z.object({
  region: z.enum(["C", "N", "NE", "E", "S", "W"]).describe("ภูมิภาค: C=กลาง, N=เหนือ, NE=อีสาน, E=ตะวันออก, S=ใต้, W=ตะวันตก"),
  date: z.string().optional().describe("วันที่เริ่มต้น (YYYY-MM-DD)"),
  starttime: z.string().optional().describe("alias ของ date (YYYY-MM-DD)"),
  duration: z.number().min(1).max(126).optional().default(7).describe("จำนวนวัน (1-126)"),
  domain: z.string().optional().describe("NWP forecast domain (เช่น thai, sea) Default: ใช้ค่า default ของ API"),
  fields: z.array(z.enum(AVAILABLE_FIELDS)).optional().describe("ตัวแปรที่ต้องการ"),
});

type NwpDailyByLocationInput = z.infer<typeof nwpDailyByLocationSchema>;
type NwpDailyByPlaceInput = z.infer<typeof nwpDailyByPlaceSchema>;
type NwpDailyByRegionInput = z.infer<typeof nwpDailyByRegionSchema>;

// Helper: sanitize place name
function sanitizePlaceName(value?: string): string | undefined {
  const v = String(value || "").trim();
  return v || undefined;
}

// Helper: normalize place input — map `place` → `province` alias
function normalizePlaceInput(input: NwpDailyByPlaceInput & { place?: string }) {
  const province = sanitizePlaceName(input.province) || sanitizePlaceName(input.place);
  const amphoe = sanitizePlaceName(input.amphoe);
  const tambon = sanitizePlaceName(input.tambon);
  return { province, amphoe, tambon };
}

// Helper: extract forecast entries from multiple NWP response shapes
// Supports: WeatherForcasts, WeatherForecast, weather_forecast.locations, locations, root array
function extractDailyEntries(data: any): any[] {
  const candidates = [
    data?.WeatherForecasts,
    data?.WeatherForcasts,
    data?.WeatherForecast,
    data?.weather_forecast?.locations,
    data?.locations,
    Array.isArray(data) ? data : null,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

// Helper: Build query parameters
function buildQueryParams(params: Record<string, any>): string {
  const query = new URLSearchParams();
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        query.append(key, value.join(","));
      } else {
        query.append(key, String(value));
      }
    }
  }
  
  return query.toString();
}

// Helper: Interpret weather condition
function interpretCondition(cond: number): string {
  return WEATHER_CONDITIONS[cond as keyof typeof WEATHER_CONDITIONS] || `Unknown (${cond})`;
}

// Tool 1: Forecast by coordinates
export const nwpDailyByLocationTool = {
  name: "nwp_daily_by_location",
  description: `
หน้าที่: พยากรณ์อากาศรายวันตามพิกัด (NWP - High Performance Computing)
ใช้เมื่อ:
- ต้องการพยากรณ์อากาศรายวัน ล่วงหน้าได้นานถึง 126 วัน (4 เดือน)
- ระบุตำแหน่งด้วยพิกัด lat, lon
- ความละเอียดปานกลาง (18-27 กม.)

ตัวแปรที่รองรับ:
- tc_max, tc_min: อุณหภูมิสูงสุด-ต่ำสุด (°C)
- rh: ความชื้นสัมพัทธ์ (%)
- rain: ปริมาณฝน (mm)
- ws10m, wd10m: ความเร็ว/ทิศทางลมที่ 10m
- cond: สภาพอากาศ (1-12)
- swdown: Solar radiation (W/m²)
- และอื่นๆ

ตัวอย่าง:
- "พยากรณ์อากาศ 7 วัน ที่ lat=13.75, lon=100.5"
- "อุณหภูมิและฝนล่วงหน้า 30 วัน กรุงเทพ (พิกัด)"
- "สภาพอากาศ 2 สัปดาห์ข้างหน้า เชียงใหม่"
`,
  inputSchema: nwpDailyByLocationSchema,

  execute: async (args: unknown) => {
    const parsed = nwpDailyByLocationSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: false,
            error: "Invalid input",
            details: parsed.error.issues
          }, null, 2)
        }]
      };
    }

    const input = parsed.data;

    try {
      const apiKey = getNwpApiKey();

      // Use /forecast/location/daily/at — confirmed working with scopes:[] JWT
      const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
      const date = (input.starttime || input.date || today).slice(0, 10);
      const fields = (input.fields || ["tc_max", "tc_min", "rain", "cond"]).join(",");
      const params = new URLSearchParams({
        lat: String(input.lat),
        lon: String(input.lon),
        date: date,
        duration: String(input.duration ||
```
