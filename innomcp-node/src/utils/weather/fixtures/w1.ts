import { primeWeatherToolCallCachePayload } from "../toolCall";
import { ToolCache } from "../../cache/toolCache";

let primed = false;

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

  const lastBuildDate = bkkNowStr();

  // Minimal national forecast payload shape expected by ForecastEngine.extractForecast
  const forecastPayload = {
    LastBuildDate: lastBuildDate,
    Provinces: {
      Province: [
        {
          ProvinceNameThai: "กรุงเทพมหานคร",
          SevenDaysForecast: {
            ForecastDate: [today, tomorrow],
            PercentRainCover: [40, 30],
            MinimumTemperature: [26, 25],
            MaximumTemperature: [33, 34],
            WindDirection: [90, 135],
            WindSpeed: [12, 10],
            DescriptionThai: ["มีฝนบางแห่ง", "มีฝนฟ้าคะนองบางพื้นที่"],
          },
        },
        {
          ProvinceNameThai: "เชียงราย",
          SevenDaysForecast: {
            ForecastDate: [today, tomorrow],
            PercentRainCover: [20, 60],
            MinimumTemperature: [19, 18],
            MaximumTemperature: [30, 29],
            WindDirection: [45, 90],
            WindSpeed: [8, 9],
            DescriptionThai: ["ฟ้าหลัวในตอนเช้า", "มีฝนฟ้าคะนอง"],
          },
        },
        {
          ProvinceNameThai: "ภูเก็ต",
          SevenDaysForecast: {
            ForecastDate: [today, tomorrow],
            PercentRainCover: [55, 65],
            MinimumTemperature: [25, 25],
            MaximumTemperature: [32, 31],
            WindDirection: [180, 200],
            WindSpeed: [16, 18],
            DescriptionThai: ["มีฝนฟ้าคะนองบางแห่ง", "มีฝนฟ้าคะนองกระจาย"],
          },
        },
        {
          ProvinceNameThai: "เชียงใหม่",
          SevenDaysForecast: {
            ForecastDate: [today, tomorrow],
            PercentRainCover: [30, 50],
            MinimumTemperature: [20, 19],
            MaximumTemperature: [34, 33],
            WindDirection: [60, 90],
            WindSpeed: [7, 10],
            DescriptionThai: ["ฟ้าหลัวในตอนเช้า", "มีฝนบางแห่งในตอนบ่าย"],
          },
        },
        {
          ProvinceNameThai: "ขอนแก่น",
          SevenDaysForecast: {
            ForecastDate: [today, tomorrow],
            PercentRainCover: [35, 45],
            MinimumTemperature: [24, 23],
            MaximumTemperature: [36, 35],
            WindDirection: [120, 135],
            WindSpeed: [9, 11],
            DescriptionThai: ["มีฝนบางแห่ง", "มีฝนฟ้าคะนองบางพื้นที่"],
          },
        },
        {
          ProvinceNameThai: "ชลบุรี",
          SevenDaysForecast: {
            ForecastDate: [today, tomorrow],
            PercentRainCover: [45, 55],
            MinimumTemperature: [26, 26],
            MaximumTemperature: [34, 33],
            WindDirection: [135, 150],
            WindSpeed: [13, 15],
            DescriptionThai: ["มีฝนฟ้าคะนองบางแห่ง", "มีฝนฟ้าคะนองกระจาย"],
          },
        },
        {
          ProvinceNameThai: "สงขลา",
          SevenDaysForecast: {
            ForecastDate: [today, tomorrow],
            PercentRainCover: [60, 70],
            MinimumTemperature: [24, 24],
            MaximumTemperature: [32, 31],
            WindDirection: [200, 220],
            WindSpeed: [17, 20],
            DescriptionThai: ["มีฝนฟ้าคะนองกระจาย", "มีฝนหนักบางแห่ง"],
          },
        },
        {
          ProvinceNameThai: "นครราชสีมา",
          SevenDaysForecast: {
            ForecastDate: [today, tomorrow],
            PercentRainCover: [25, 40],
            MinimumTemperature: [24, 23],
            MaximumTemperature: [37, 36],
            WindDirection: [110, 120],
            WindSpeed: [9, 11],
            DescriptionThai: ["อากาศร้อน ฟ้าหลัวในตอนเช้า", "มีฝนบางแห่งในตอนบ่าย"],
          },
        },
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
    forecastPayload
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
    stationPayload3h
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
    stationPayload3h
  );
}
