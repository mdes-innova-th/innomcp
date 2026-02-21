import { primeWeatherToolCallCachePayload } from "../toolCall";

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
      ],
    },
  };

  primeWeatherToolCallCachePayload({
    toolName: "tmd_weather_forecast_7days_by_province",
    args: {},
    scope: "national",
    payload: forecastPayload,
  });

  const stationPayload3h = {
    Stations: {
      Station: [
        {
          StationNameThai: "ดอนเมือง",
          Province: "กรุงเทพมหานคร",
          ObservationTime: lastBuildDate,
          Temp: 30,
          WindSpeed: 10,
          WindDirection: 90,
        },
        {
          StationNameThai: "เมืองเชียงราย",
          Province: "เชียงราย",
          ObservationTime: lastBuildDate,
          Temp: 27,
          WindSpeed: 6,
          WindDirection: 45,
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

  // Provide fallback 07am payload too (same shape) so StationEngine never needs network.
  primeWeatherToolCallCachePayload({
    toolName: "tmd_weather_today_07am_all_stations",
    args: {},
    scope: "province",
    payload: stationPayload3h,
  });
}
