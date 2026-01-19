import { z } from "zod";
import axios from "axios";

/**
 * NWP Hourly Forecast Tool
 * ข้อมูลพยากรณ์อากาศรายชั่วโมงจากคอมพิวเตอร์สมรรถนะสูง (High Performance Computing)
 * - ความละเอียด: 2 กม.
 * - ล่วงหน้าสูงสุด: 48 ชั่วโมง
 * - ตัวแปร: อุณหภูมิ, ความชื้น, ฝน, ลม, เมฆ, สภาพอากาศ
 */

const NWP_API_BASE = "https://data.tmd.go.th/nwpapi/v1/forecast/location/hourly";
const DEFAULT_TIMEOUT = 15000;

// Get API key from environment
function getNwpApiKey(): string {
  const key = process.env.NWP_API_KEY;
  if (!key) {
    throw new Error("NWP_API_KEY not found in environment variables");
  }
  return key;
}

// ตัวแปรพยากรณ์ที่รองรับ
const AVAILABLE_FIELDS = [
  "tc", "rh", "slp", "rain", "ws10m", "wd10m",
  "ws925", "wd925", "ws850", "wd850", "ws700", "wd700", "ws500", "wd500", "ws200", "wd200",
  "cloudlow", "cloudmed", "cloudhigh", "cond"
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
export const nwpHourlyByLocationSchema = z.object({
  lat: z.number().min(-90).max(90).describe("พิกัดละติจูด (latitude)"),
  lon: z.number().min(-180).max(180).describe("พิกัดลองจิจูด (longitude)"),
  date: z.string().optional().describe("วันที่ต้องการข้อมูล (YYYY-MM-DD) Default: วันนี้"),
  hour: z.number().min(0).max(23).optional().describe("ชั่วโมงเริ่มต้น (0-23) Default: ชั่วโมงปัจจุบัน"),
  duration: z.number().min(1).max(48).optional().default(24).describe("จำนวนชั่วโมง (1-48) Default: 24"),
  fields: z.array(z.enum(AVAILABLE_FIELDS)).optional().describe("ตัวแปรที่ต้องการ Default: tc,rh,cond"),
});

// Schema for location by place name
export const nwpHourlyByPlaceSchema = z.object({
  province: z.string().optional().describe("ชื่อจังหวัด (ภาษาไทย)"),
  amphoe: z.string().optional().describe("ชื่ออำเภอ (ภาษาไทย)"),
  tambon: z.string().optional().describe("ชื่อตำบล (ภาษาไทย)"),
  subarea: z.boolean().optional().describe("แนบข้อมูลสถานที่ย่อยด้วย Default: false"),
  date: z.string().optional().describe("วันที่ต้องการข้อมูล (YYYY-MM-DD)"),
  hour: z.number().min(0).max(23).optional().describe("ชั่วโมงเริ่มต้น (0-23)"),
  duration: z.number().min(1).max(48).optional().default(24).describe("จำนวนชั่วโมง (1-48)"),
  fields: z.array(z.enum(AVAILABLE_FIELDS)).optional().describe("ตัวแปรที่ต้องการ"),
});

// Schema for location by region
export const nwpHourlyByRegionSchema = z.object({
  region: z.enum(["C", "N", "NE", "E", "S", "W"]).describe("ภูมิภาค: C=กลาง, N=เหนือ, NE=อีสาน, E=ตะวันออก, S=ใต้, W=ตะวันตก"),
  date: z.string().optional().describe("วันที่ต้องการข้อมูล (YYYY-MM-DD)"),
  hour: z.number().min(0).max(23).optional().describe("ชั่วโมงเริ่มต้น (0-23)"),
  duration: z.number().min(1).max(48).optional().default(24).describe("จำนวนชั่วโมง (1-48)"),
  fields: z.array(z.enum(AVAILABLE_FIELDS)).optional().describe("ตัวแปรที่ต้องการ"),
});

type NwpHourlyByLocationInput = z.infer<typeof nwpHourlyByLocationSchema>;
type NwpHourlyByPlaceInput = z.infer<typeof nwpHourlyByPlaceSchema>;
type NwpHourlyByRegionInput = z.infer<typeof nwpHourlyByRegionSchema>;

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
export const nwpHourlyByLocationTool = {
  name: "nwp_hourly_by_location",
  description: `
หน้าที่: พยากรณ์อากาศรายชั่วโมงตามพิกัด (NWP - High Performance Computing)
ใช้เมื่อ:
- ต้องการพยากรณ์อากาศรายชั่วโมงแบบละเอียดสูง (2 กม.)
- ระบุตำแหน่งด้วยพิกัด lat, lon
- ล่วงหน้าสูงสุด 48 ชั่วโมง

ตัวแปรที่รองรับ:
- tc: อุณหภูมิ (°C)
- rh: ความชื้นสัมพัทธ์ (%)
- rain: ปริมาณฝน (mm)
- ws10m, wd10m: ความเร็ว/ทิศทางลมที่ 10m
- cond: สภาพอากาศ (1-12)
- และอื่นๆ

ตัวอย่าง:
- "พยากรณ์อากาศ 24 ชั่วโมง ที่ lat=13.75, lon=100.5"
- "อุณหภูมิและฝนล่วงหน้า 12 ชม. กรุงเทพ (พิกัด)"
`,
  inputSchema: nwpHourlyByLocationSchema,

  execute: async (args: unknown) => {
    const parsed = nwpHourlyByLocationSchema.safeParse(args);
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
        hour: input.hour,
        duration: input.duration,
        fields: input.fields || ["tc", "rh", "cond"]
      });

      console.log(`[NWP Hourly] GET ${url}?${params}`);

      const response = await axios.get(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        timeout: DEFAULT_TIMEOUT
      });

      // Interpret weather conditions
      const data = response.data;
      if (data.WeatherForcasts && Array.isArray(data.WeatherForcasts)) {
        data.WeatherForcasts.forEach((forecast: any) => {
          if (forecast.forecasts && Array.isArray(forecast.forecasts)) {
            forecast.forecasts.forEach((f: any) => {
              if (f.data && f.data.cond !== undefined) {
                f.data.condMeaning = interpretCondition(f.data.cond);
              }
            });
          }
        });
      }

      const result = {
        source: "NWP High Performance Computing (2km resolution)",
        location: { lat: input.lat, lon: input.lon },
        duration: `${input.duration || 24} hours`,
        data: data,
        success: true,
        timestamp: new Date().toISOString()
      };

      console.log(`[NWP Hourly] Success: ${data.WeatherForcasts?.[0]?.forecasts?.length || 0} forecast points`);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }]
      };

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "เกิดข้อผิดพลาด";
      console.error(`[NWP Hourly] Error: ${errorMessage}`);

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
export const nwpHourlyByPlaceTool = {
  name: "nwp_hourly_by_place",
  description: `
หน้าที่: พยากรณ์อากาศรายชั่วโมงตามชื่อสถานที่ (NWP)
ใช้เมื่อ:
- ต้องการพยากรณ์อากาศตามชื่อจังหวัด/อำเภอ/ตำบล
- ล่วงหน้าสูงสุด 48 ชั่วโมง
- ความละเอียด 2 กม.

ตัวอย่าง:
- "พยากรณ์อากาศ 24 ชม. จังหวัดนครปฐม"
- "สภาพอากาศล่วงหน้า 12 ชม. อำเภอสามพราน"
- "อุณหภูมิและฝน 6 ชม. ตำบลบางเลน"
`,
  inputSchema: nwpHourlyByPlaceSchema,

  execute: async (args: unknown) => {
    const parsed = nwpHourlyByPlaceSchema.safeParse(args);
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
      const url = `${NWP_API_BASE}/place`;
      
      const params = buildQueryParams({
        province: input.province,
        amphoe: input.amphoe,
        tambon: input.tambon,
        subarea: input.subarea ? 1 : 0,
        date: input.date,
        hour: input.hour,
        duration: input.duration,
        fields: input.fields || ["tc", "rh", "cond"]
      });

      console.log(`[NWP Hourly Place] GET ${url}?${params}`);

      const response = await axios.get(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        timeout: DEFAULT_TIMEOUT
      });

      // Interpret weather conditions
      const data = response.data;
      if (data.WeatherForcasts && Array.isArray(data.WeatherForcasts)) {
        data.WeatherForcasts.forEach((forecast: any) => {
          if (forecast.forecasts && Array.isArray(forecast.forecasts)) {
            forecast.forecasts.forEach((f: any) => {
              if (f.data && f.data.cond !== undefined) {
                f.data.condMeaning = interpretCondition(f.data.cond);
              }
            });
          }
        });
      }

      const result = {
        source: "NWP High Performance Computing (2km resolution)",
        location: {
          province: input.province,
          amphoe: input.amphoe,
          tambon: input.tambon
        },
        duration: `${input.duration || 24} hours`,
        data: data,
        success: true,
        timestamp: new Date().toISOString()
      };

      console.log(`[NWP Hourly Place] Success: ${data.WeatherForcasts?.length || 0} locations`);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }]
      };

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "เกิดข้อผิดพลาด";
      console.error(`[NWP Hourly Place] Error: ${errorMessage}`);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            source: "NWP High Performance Computing",
            location: {
              province: input.province,
              amphoe: input.amphoe,
              tambon: input.tambon
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
export const nwpHourlyByRegionTool = {
  name: "nwp_hourly_by_region",
  description: `
หน้าที่: พยากรณ์อากาศรายชั่วโมงตามภูมิภาค (NWP)
ใช้เมื่อ:
- ต้องการพยากรณ์อากาศทั้งภูมิภาค
- ล่วงหน้าสูงสุด 48 ชั่วโมง
- ข้อมูลทุกจังหวัดในภูมิภาค

ภูมิภาค:
- C: ภาคกลาง
- N: ภาคเหนือ
- NE: ภาคตะวันออกเฉียงเหนือ (อีสาน)
- E: ภาคตะวันออก
- S: ภาคใต้
- W: ภาคตะวันตก

ตัวอย่าง:
- "พยากรณ์อากาศภาคกลาง 24 ชม."
- "สภาพอากาศภาคเหนือล่วงหน้า 12 ชม."
`,
  inputSchema: nwpHourlyByRegionSchema,

  execute: async (args: unknown) => {
    const parsed = nwpHourlyByRegionSchema.safeParse(args);
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
        hour: input.hour,
        duration: input.duration,
        fields: input.fields || ["tc", "rh", "cond"]
      });

      console.log(`[NWP Hourly Region] GET ${url}?${params}`);

      const response = await axios.get(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        timeout: DEFAULT_TIMEOUT
      });

      // Interpret weather conditions
      const data = response.data;
      if (data.WeatherForecast && Array.isArray(data.WeatherForecast)) {
        data.WeatherForecast.forEach((forecast: any) => {
          if (forecast.forecasts && Array.isArray(forecast.forecasts)) {
            forecast.forecasts.forEach((f: any) => {
              if (f.data && f.data.cond !== undefined) {
                f.data.condMeaning = interpretCondition(f.data.cond);
              }
            });
          }
        });
      }

      const regionNames = {
        C: "ภาคกลาง", N: "ภาคเหนือ", NE: "ภาคตะวันออกเฉียงเหนือ",
        E: "ภาคตะวันออก", S: "ภาคใต้", W: "ภาคตะวันตก"
      };

      const result = {
        source: "NWP High Performance Computing (2km resolution)",
        region: regionNames[input.region],
        regionCode: input.region,
        duration: `${input.duration || 24} hours`,
        provinces: data.WeatherForecast?.length || 0,
        data: data,
        success: true,
        timestamp: new Date().toISOString()
      };

      console.log(`[NWP Hourly Region] Success: ${data.WeatherForecast?.length || 0} provinces`);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
        }]
      };

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "เกิดข้อผิดพลาด";
      console.error(`[NWP Hourly Region] Error: ${errorMessage}`);

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
  nwpHourlyByLocationTool,
  nwpHourlyByPlaceTool,
  nwpHourlyByRegionTool
};
