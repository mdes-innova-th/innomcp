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
  duration: z.number().min(1).max(126).optional().default(7).describe("จำนวนวัน (1-126) Default: 7"),
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
  duration: z.number().min(1).max(126).optional().default(7).describe("จำนวนวัน (1-126)"),
  fields: z.array(z.enum(AVAILABLE_FIELDS)).optional().describe("ตัวแปรที่ต้องการ"),
});

// Schema for location by region
export const nwpDailyByRegionSchema = z.object({
  region: z.enum(["C", "N", "NE", "E", "S", "W"]).describe("ภูมิภาค: C=กลาง, N=เหนือ, NE=อีสาน, E=ตะวันออก, S=ใต้, W=ตะวันตก"),
  date: z.string().optional().describe("วันที่เริ่มต้น (YYYY-MM-DD)"),
  duration: z.number().min(1).max(126).optional().default(7).describe("จำนวนวัน (1-126)"),
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
      const url = `${NWP_API_BASE}/at`;
      
      const params = buildQueryParams({
        lat: input.lat,
        lon: input.lon,
        date: input.date,
        duration: input.duration,
        fields: input.fields || ["tc_max", "tc_min", "rain", "cond"]
      });

      console.log(`[NWP Daily] GET ${url}?${params}`);

      const response = await axios.get(`${url}?${params}`, {
        headers: {
          'authorization': `bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        timeout: DEFAULT_TIMEOUT
      });

      // Interpret weather conditions across legacy/current response shapes
      const data = response.data;
      const locations = extractDailyEntries(data);
      locations.forEach((forecast: any) => {
        if (forecast.forecasts && Array.isArray(forecast.forecasts)) {
          forecast.forecasts.forEach((f: any) => {
            if (f.data && f.data.cond !== undefined) {
              f.data.condMeaning = interpretCondition(f.data.cond);
            }
          });
        }
      });

      const result = {
        source: "NWP High Performance Computing (18-27km resolution)",
        location: { lat: input.lat, lon: input.lon },
        duration: `${input.duration || 7} days`,
        data: data,
        success: true,
        timestamp: new Date().toISOString()
      };

      console.log(`[NWP Daily] Success: ${data.WeatherForcasts?.[0]?.forecasts?.length || 0} forecast days`);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }]
      };

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "เกิดข้อผิดพลาด";
      console.error(`[NWP Daily] Error: ${errorMessage}`);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            source: "NWP High Performance Computing",
            location: { lat: input.lat, lon: input.lon },
            success: false,
            error: errorMessage,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
    }
  }
};

// Tool 2: Forecast by place name
export const nwpDailyByPlaceTool = {
  name: "nwp_daily_by_place",
  description: `
หน้าที่: พยากรณ์อากาศรายวันตามชื่อสถานที่ (NWP)
ใช้เมื่อ:
- ต้องการพยากรณ์อากาศตามชื่อจังหวัด/อำเภอ/ตำบล
- ล่วงหน้าสูงสุด 126 วัน (4 เดือน)
- ความละเอียด 18-27 กม.

ตัวอย่าง:
- "พยากรณ์อากาศ 7 วัน จังหวัดนครปฐม"
- "สภาพอากาศล่วงหน้า 30 วัน อำเภอสามพราน"
- "อุณหภูมิและฝน 2 สัปดาห์ ตำบลบางเลน"
- "พยากรณ์อากาศ 3 เดือนข้างหน้า ภูเก็ต"
`,
  inputSchema: nwpDailyByPlaceSchema,

  execute: async (args: unknown) => {
    const parsed = nwpDailyByPlaceSchema.safeParse(args);
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
    const normalizedPlace = normalizePlaceInput(input as NwpDailyByPlaceInput & { place?: string });

    try {
      const apiKey = getNwpApiKey();
      const url = `${NWP_API_BASE}/place`;
      
      const params = buildQueryParams({
        province: normalizedPlace.province,
        amphoe: normalizedPlace.amphoe,
        tambon: normalizedPlace.tambon,
        subarea: input.subarea ? 1 : 0,
        date: input.date,
        duration: input.duration,
        fields: input.fields || ["tc_max", "tc_min", "rain", "cond"]
      });

      console.log(`[NWP Daily Place] GET ${url}?${params}`);

      const response = await axios.get(`${url}?${params}`, {
        headers: {
          'authorization': `bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        timeout: DEFAULT_TIMEOUT
      });

      // Interpret weather conditions across legacy/current response shapes
      const data = response.data;
      const locations = extractDailyEntries(data);
      locations.forEach((forecast: any) => {
        if (forecast.forecasts && Array.isArray(forecast.forecasts)) {
          forecast.forecasts.forEach((f: any) => {
            if (f.data && f.data.cond !== undefined) {
              f.data.condMeaning = interpretCondition(f.data.cond);
            }
          });
        }
      });

      const result = {
        source: "NWP High Performance Computing (18-27km resolution)",
        location: {
          province: normalizedPlace.province,
          amphoe: normalizedPlace.amphoe,
          tambon: normalizedPlace.tambon
        },
        duration: `${input.duration || 7} days`,
        data: data,
        success: true,
        timestamp: new Date().toISOString()
      };

      console.log(`[NWP Daily Place] Success: ${locations.length} locations`);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }]
      };

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "เกิดข้อผิดพลาด";
      console.error(`[NWP Daily Place] Error: ${errorMessage}`);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            source: "NWP High Performance Computing",
            location: {
              province: normalizedPlace.province,
              amphoe: normalizedPlace.amphoe,
              tambon: normalizedPlace.tambon
            },
            success: false,
            error: errorMessage,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
    }
  }
};

// Tool 3: Forecast by region
export const nwpDailyByRegionTool = {
  name: "nwp_daily_by_region",
  description: `
หน้าที่: พยากรณ์อากาศรายวันตามภูมิภาค (NWP)
ใช้เมื่อ:
- ต้องการพยากรณ์อากาศทั้งภูมิภาค
- ล่วงหน้าสูงสุด 126 วัน (4 เดือน)
- ข้อมูลทุกจังหวัดในภูมิภาค

ภูมิภาค:
- C: ภาคกลาง
- N: ภาคเหนือ
- NE: ภาคตะวันออกเฉียงเหนือ (อีสาน)
- E: ภาคตะวันออก
- S: ภาคใต้
- W: ภาคตะวันตก

ตัวอย่าง:
- "พยากรณ์อากาศภาคกลาง 7 วัน"
- "สภาพอากาศภาคเหนือล่วงหน้า 30 วัน"
- "แนวโน้มอากาศภาคใต้ 3 เดือน"
`,
  inputSchema: nwpDailyByRegionSchema,

  execute: async (args: unknown) => {
    const parsed = nwpDailyByRegionSchema.safeParse(args);
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
      const url = `${NWP_API_BASE}/region`;
      
      const params = buildQueryParams({
        region: input.region,
        date: input.date,
        duration: input.duration,
        fields: input.fields || ["tc_max", "tc_min", "rain", "cond"]
      });

      console.log(`[NWP Daily Region] GET ${url}?${params}`);

      const response = await axios.get(`${url}?${params}`, {
        headers: {
          'authorization': `bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        timeout: DEFAULT_TIMEOUT
      });

      // Interpret weather conditions
      const data = response.data;
      const regions = extractDailyEntries(data);
      regions.forEach((forecast: any) => {
        if (forecast.forecasts && Array.isArray(forecast.forecasts)) {
          forecast.forecasts.forEach((f: any) => {
            if (f.data && f.data.cond !== undefined) {
              f.data.condMeaning = interpretCondition(f.data.cond);
            }
          });
        }
      });

      const regionNames = {
        C: "ภาคกลาง", N: "ภาคเหนือ", NE: "ภาคตะวันออกเฉียงเหนือ",
        E: "ภาคตะวันออก", S: "ภาคใต้", W: "ภาคตะวันตก"
      };

      const result = {
        source: "NWP High Performance Computing (18-27km resolution)",
        region: regionNames[input.region],
        regionCode: input.region,
        duration: `${input.duration || 7} days`,
        provinces: regions.length,
        data: data,
        success: true,
        timestamp: new Date().toISOString()
      };

      console.log(`[NWP Daily Region] Success: ${regions.length} provinces`);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }]
      };

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "เกิดข้อผิดพลาด";
      console.error(`[NWP Daily Region] Error: ${errorMessage}`);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            source: "NWP High Performance Computing",
            region: input.region,
            success: false,
            error: errorMessage,
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
    }
  }
};

export default {
  nwpDailyByLocationTool,
  nwpDailyByPlaceTool,
  nwpDailyByRegionTool
};
