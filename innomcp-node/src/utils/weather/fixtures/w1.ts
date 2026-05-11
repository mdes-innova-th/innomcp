import { primeWeatherToolCallCachePayload } from "../toolCall";
import { ToolCache } from "../../cache/toolCache";

let primed = false;

/** Allow re-priming when cache entries expire (called from engines on FIXTURE_MISS) */
export function resetFixturePrimeFlag(): void {
  primed = false;
}

// Use very long TTL for fixture data so it survives throughout the process lifetime
const FIXTURE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function bkkDateStr(offsetDays: number): string {
  const now = new Date();
  const bkkMs = now.getTime() + 7 * 60 * 60 * 1000;
  const bkk = new Date(bkkMs);
  bkk.setUTCDate(bkk.getUTCDate() + offsetDays);
  const dd = String(bkk.getUTCDate()).padStart(2, "0");
  const mm = String(bkk.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = bkk.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function bkkNowStr(): string {
  const now = new Date();
  const bkkMs = now.getTime() + 7 * 60 * 60 * 1000;
  const bkk = new Date(bkkMs);
  const yyyy = bkk.getUTCFullYear();
  const mm = String(bkk.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(bkk.getUTCDate()).padStart(2, "0");
  const hh = String(bkk.getUTCHours()).padStart(2, "0");
  const mi = String(bkk.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export function primeWeatherFixturesW1(): void {
  if (primed) return;
  primed = true;

  const today = bkkDateStr(0);
  const tomorrow = bkkDateStr(1);
  const day2 = bkkDateStr(2);
  const day3 = bkkDateStr(3);
  const day4 = bkkDateStr(4);
  const day5 = bkkDateStr(5);
  const day6 = bkkDateStr(6);

  const lastBuildDate = bkkNowStr();
  const dates7 = [today, tomorrow, day2, day3, day4, day5, day6];

  // Helper: generate a 7-day forecast for a province with realistic variance
  function mkForecast(
    name: string,
    baseRain: number, baseMinT: number, baseMaxT: number,
    baseWDir: number, baseWSpd: number,
    descs: [string, string]
  ) {
    return {
      ProvinceNameThai: name,
      SevenDaysForecast: {
        ForecastDate: [...dates7],
        PercentRainCover: dates7.map((_, i) => Math.min(100, Math.max(0, baseRain + (i % 3 === 0 ? 10 : -5) + i * 2))),
        MinimumTemperature: dates7.map((_, i) => baseMinT + (i % 2 === 0 ? 0 : -1)),
        MaximumTemperature: dates7.map((_, i) => baseMaxT + (i % 2 === 0 ? 0 : 1)),
        WindDirection: dates7.map((_, i) => (baseWDir + i * 15) % 360),
        WindSpeed: dates7.map((_, i) => baseWSpd + (i % 3)),
        DescriptionThai: dates7.map((_, i) => i % 2 === 0 ? descs[0] : descs[1]),
      },
    };
  }

  // Minimal national forecast payload shape expected by ForecastEngine.extractForecast
  const forecastPayload = {
    LastBuildDate: lastBuildDate,
    Provinces: {
      Province: [
        mkForecast("กรุงเทพมหานคร", 40, 26, 33, 90, 12, ["มีฝนบางแห่ง", "มีฝนฟ้าคะนองบางพื้นที่"]),
        mkForecast("เชียงราย", 20, 19, 30, 45, 8, ["ฟ้าหลัวในตอนเช้า", "มีฝนฟ้าคะนอง"]),
        mkForecast("ภูเก็ต", 55, 25, 32, 180, 16, ["มีฝนฟ้าคะนองบางแห่ง", "มีฝนฟ้าคะนองกระจาย"]),
        mkForecast("เชียงใหม่", 30, 20, 34, 60, 7, ["ฟ้าหลัวในตอนเช้า", "มีฝนบางแห่งในตอนบ่าย"]),
        mkForecast("ขอนแก่น", 35, 24, 36, 120, 9, ["มีฝนบางแห่ง", "มีฝนฟ้าคะนองบางพื้นที่"]),
        mkForecast("ชลบุรี", 45, 26, 34, 135, 13, ["มีฝนฟ้าคะนองบางแห่ง", "มีฝนฟ้าคะนองกระจาย"]),
        mkForecast("สงขลา", 60, 24, 32, 200, 17, ["มีฝนฟ้าคะนองกระจาย", "มีฝนหนักบางแห่ง"]),
        mkForecast("สุราษฎร์ธานี", 52, 25, 33, 190, 15, ["มีฝนฟ้าคะนองบางแห่ง", "มีฝนกระจายตามแนวชายฝั่ง"]),
        mkForecast("นครศรีธรรมราช", 55, 24, 33, 195, 16, ["มีฝนฟ้าคะนองกระจาย", "มีฝนหนักบางแห่ง"]),
        mkForecast("นครราชสีมา", 25, 24, 37, 110, 9, ["อากาศร้อน ฟ้าหลัวในตอนเช้า", "มีฝนบางแห่งในตอนบ่าย"]),
        // Additional provinces needed for common queries
        mkForecast("อุบลราชธานี", 40, 23, 35, 100, 10, ["มีฝนบางแห่ง", "มีฝนฟ้าคะนองบางพื้นที่"]),
        mkForecast("ยะลา", 65, 23, 31, 190, 14, ["มีฝนฟ้าคะนองกระจาย", "มีฝนหนักบางแห่ง"]),
        mkForecast("สมุทรสงคราม", 35, 25, 33, 140, 11, ["มีฝนบางแห่ง", "อากาศร้อนมีฝนฟ้าคะนอง"]),
        mkForecast("เพชรบุรี", 30, 24, 34, 150, 12, ["มีฝนบางแห่ง", "อากาศร้อนฟ้าหลัว"]),
        mkForecast("ลำพูน", 25, 19, 33, 55, 7, ["ฟ้าหลัวในตอนเช้า", "มีฝนบางแห่งในตอนบ่าย"]),
        mkForecast("ลำปาง", 20, 18, 34, 50, 6, ["อากาศร้อน ฟ้าหลัว", "มีฝนบางแห่งในตอนเย็น"]),
        mkForecast("พิษณุโลก", 30, 22, 35, 70, 8, ["อากาศร้อนในตอนกลางวัน", "มีฝนฟ้าคะนองบางพื้นที่"]),
        mkForecast("นครสวรรค์", 25, 23, 36, 80, 7, ["อากาศร้อน", "มีฝนบางแห่ง"]),
        mkForecast("สุพรรณบุรี", 30, 24, 35, 95, 8, ["อากาศร้อน", "มีฝนฟ้าคะนองบางแห่ง"]),
        mkForecast("นนทบุรี", 40, 26, 34, 100, 11, ["มีฝนบางแห่ง", "มีฝนฟ้าคะนองบางพื้นที่"]),
        mkForecast("อุดรธานี", 35, 23, 35, 105, 9, ["มีฝนบางแห่ง", "อากาศร้อนมีฝนฟ้าคะนอง"]),
        mkForecast("กำแพงเพชร", 25, 22, 36, 65, 7, ["อากาศร้อน", "มีฝนบางแห่ง"]),
      ],
    },
  };

  primeWeatherToolCallCachePayload({
    toolName: "tmd_weather_forecast_7days_by_province",
    args: {},
    scope: "national",
    payload: forecastPayload,
  });
  ToolCache.set(
    ToolCache.generateKey("tmd_weather_forecast_7days_by_province", { scope: "national" }),
    forecastPayload,
    FIXTURE_TTL
  );

  const stationPayload3h = {
    Stations: {
      Station: [
        {
          StationNameThai: "ดอนเมือง",
          Province: "กรุงเทพมหานคร",
          ObservationTime: lastBuildDate,
          Temp: 31,
          WindSpeed: 11,
          WindDirection: 90,
        },
        {
          StationNameThai: "หลักสี่",
          Province: "กรุงเทพมหานคร",
          ObservationTime: lastBuildDate,
          Temp: 32,
          WindSpeed: 9,
          WindDirection: 135,
        },
        {
          StationNameThai: "ลาดกระบัง",
          Province: "กรุงเทพมหานคร",
          ObservationTime: lastBuildDate,
          Temp: 29,
          WindSpeed: 14,
          WindDirection: 180,
        },
        {
          StationNameThai: "เมืองเชียงราย",
          Province: "เชียงราย",
          ObservationTime: lastBuildDate,
          Temp: 27,
          WindSpeed: 6,
          WindDirection: 45,
        },
        {
          StationNameThai: "สนามบินภูเก็ต",
          Province: "ภูเก็ต",
          ObservationTime: lastBuildDate,
          Temp: 30,
          WindSpeed: 19,
          WindDirection: 220,
        },
        {
          StationNameThai: "สนามบินเชียงใหม่",
          Province: "เชียงใหม่",
          ObservationTime: lastBuildDate,
          Temp: 32,
          WindSpeed: 8,
          WindDirection: 75,
        },
        {
          StationNameThai: "เมืองขอนแก่น",
          Province: "ขอนแก่น",
          ObservationTime: lastBuildDate,
          Temp: 35,
          WindSpeed: 10,
          WindDirection: 130,
        },
        {
          StationNameThai: "พัทยา",
          Province: "ชลบุรี",
          ObservationTime: lastBuildDate,
          Temp: 33,
          WindSpeed: 14,
          WindDirection: 145,
        },
        {
          StationNameThai: "หาดใหญ่",
          Province: "สงขลา",
          ObservationTime: lastBuildDate,
          Temp: 31,
          WindSpeed: 18,
          WindDirection: 210,
        },
        {
          StationNameThai: "เมืองนครราชสีมา",
          Province: "นครราชสีมา",
          ObservationTime: lastBuildDate,
          Temp: 36,
          WindSpeed: 9,
          WindDirection: 110,
        },
        // Additional stations for expanded provinces
        {
          StationNameThai: "เมืองอุบลราชธานี",
          Province: "อุบลราชธานี",
          ObservationTime: lastBuildDate,
          Temp: 34,
          WindSpeed: 10,
          WindDirection: 100,
        },
        {
          StationNameThai: "เมืองยะลา",
          Province: "ยะลา",
          ObservationTime: lastBuildDate,
          Temp: 30,
          WindSpeed: 13,
          WindDirection: 190,
        },
        {
          StationNameThai: "เมืองสมุทรสงคราม",
          Province: "สมุทรสงคราม",
          ObservationTime: lastBuildDate,
          Temp: 32,
          WindSpeed: 11,
          WindDirection: 145,
        },
        {
          StationNameThai: "เมืองเพชรบุรี",
          Province: "เพชรบุรี",
          ObservationTime: lastBuildDate,
          Temp: 33,
          WindSpeed: 12,
          WindDirection: 150,
        },
        {
          StationNameThai: "เมืองลำพูน",
          Province: "ลำพูน",
          ObservationTime: lastBuildDate,
          Temp: 31,
          WindSpeed: 7,
          WindDirection: 55,
        },
        {
          StationNameThai: "เมืองลำปาง",
          Province: "ลำปาง",
          ObservationTime: lastBuildDate,
          Temp: 33,
          WindSpeed: 6,
          WindDirection: 50,
        },
        {
          StationNameThai: "เมืองพิษณุโลก",
          Province: "พิษณุโลก",
          ObservationTime: lastBuildDate,
          Temp: 34,
          WindSpeed: 8,
          WindDirection: 70,
        },
        {
          StationNameThai: "เมืองนครสวรรค์",
          Province: "นครสวรรค์",
          ObservationTime: lastBuildDate,
          Temp: 35,
          WindSpeed: 7,
          WindDirection: 85,
        },
        {
          StationNameThai: "เมืองสุพรรณบุรี",
          Province: "สุพรรณบุรี",
          ObservationTime: lastBuildDate,
          Temp: 34,
          WindSpeed: 8,
          WindDirection: 95,
        },
        {
          StationNameThai: "เมืองนนทบุรี",
          Province: "นนทบุรี",
          ObservationTime: lastBuildDate,
          Temp: 32,
          WindSpeed: 11,
          WindDirection: 105,
        },
        {
          StationNameThai: "เมืองอุดรธานี",
          Province: "อุดรธานี",
          ObservationTime: lastBuildDate,
          Temp: 34,
          WindSpeed: 9,
          WindDirection: 110,
        },
        {
          StationNameThai: "เมืองกำแพงเพชร",
          Province: "กำแพงเพชร",
          ObservationTime: lastBuildDate,
          Temp: 35,
          WindSpeed: 7,
          WindDirection: 65,
        },
      ],
    },
  };

  primeWeatherToolCallCachePayload({
    toolName: "tmd_weather_3hours_all_stations",
    args: {},
    scope: "province",
    payload: stationPayload3h,
  });
  ToolCache.set(
    ToolCache.generateKey("tmd_weather_3hours_all_stations", { scope: "national" }),
    stationPayload3h,
    FIXTURE_TTL
  );

  // Provide fallback 07am payload too (same shape) so StationEngine never needs network.
  primeWeatherToolCallCachePayload({
    toolName: "tmd_weather_today_07am_all_stations",
    args: {},
    scope: "province",
    payload: stationPayload3h,
  });
  ToolCache.set(
    ToolCache.generateKey("tmd_weather_today_07am_all_stations", { scope: "national" }),
    stationPayload3h,
    FIXTURE_TTL
  );
}
