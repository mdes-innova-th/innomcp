/**
 * Weather Module - Real-time Weather Data
 * ดึงข้อมูลสภาพอากาศปัจจุบัน (WeatherNow)
 * 
 * Features:
 * - ผูก Open-Meteo (ฟรี, ไม่ต้อง API key)
 * - Cross-check OpenWeather (ต้อง API key)
 * - ตอบคำถาม "ตอนนี้ฝนตกไหม" ได้แม่นยำ
 * 
 * @author MDES Development Team
 * @created 2026-01-10
 */

export interface WeatherData {
  isRaining: 'yes' | 'no' | 'likely'; // ตอบตรง ๆ
  temperature: number; // °C
  humidity?: number; // %
  windSpeed?: number; // km/h
  pressure?: number; // hPa
  cloudCover?: number; // %
  rainChance?: number; // %
  weatherCode?: number; // Open-Meteo weather code
  location: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  observedAt: string; // ISO timestamp
  sources: Array<{
    name: string;
    url: string;
  }>;
  note?: string;
}

/**
 * Weather codes ที่หมายถึงฝนตก (Open-Meteo)
 * 51,53,55: Drizzle
 * 61,63,65: Rain
 * 80,81,82: Rain showers
 * 95,96,99: Thunderstorm
 */
const RAIN_WEATHER_CODES = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];

/**
 * ดึงสภาพอากาศปัจจุบันจาก Open-Meteo
 * API ฟรี, ไม่ต้อง key, อัพเดททุก 15 นาที
 */
export async function fetchOpenMeteoWeather(
  lat: number,
  lon: number,
  location: string
): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,pressure_msl&timezone=Asia/Bangkok`;

  try {
    const response = await fetch(url, { timeout: 5000 } as any);

    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }

    const data = await response.json();
    const current = data.current;

    // ตรวจสอบฝนตก
    const precipitation = current.precipitation ?? 0;
    const weatherCode = current.weather_code ?? 0;
    const isRainingByPrecip = precipitation > 0;
    const isRainingByCode = RAIN_WEATHER_CODES.includes(weatherCode);

    let isRaining: 'yes' | 'no' | 'likely';
    if (isRainingByPrecip || isRainingByCode) {
      isRaining = 'yes';
    } else if (weatherCode >= 45 && weatherCode <= 48) {
      // Fog - อาจมีฝนตามมา
      isRaining = 'likely';
    } else {
      isRaining = 'no';
    }

    return {
      isRaining,
      temperature: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      pressure: current.pressure_msl,
      cloudCover: current.cloud_cover,
      weatherCode,
      location,
      coordinates: { lat, lon },
      observedAt: new Date().toISOString(),
      sources: [
        {
          name: 'Open-Meteo',
          url: 'https://open-meteo.com',
        },
      ],
      note: `Precipitation: ${precipitation}mm, Code: ${weatherCode}`,
    };
  } catch (error: any) {
    console.error('[Weather Module] Open-Meteo error:', error.message);
    throw new Error('Failed to fetch weather from Open-Meteo');
  }
}

/**
 * ดึงสภาพอากาศจาก OpenWeather (ต้อง API key)
 * ใช้สำหรับ cross-check
 */
export async function fetchOpenWeatherWeather(
  lat: number,
  lon: number,
  location: string
): Promise<WeatherData> {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENWEATHER_API_KEY not configured');
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

  try {
    const response = await fetch(url, { timeout: 5000 } as any);

    if (!response.ok) {
      throw new Error(`OpenWeather API error: ${response.status}`);
    }

    const data = await response.json();

    // OpenWeather rain check
    const isRainingByWeather = data.weather.some((w: any) =>
      ['Rain', 'Drizzle', 'Thunderstorm'].includes(w.main)
    );
    const hasRainData = data.rain && (data.rain['1h'] || data.rain['3h']);

    const isRaining: 'yes' | 'no' | 'likely' = isRainingByWeather || hasRainData
      ? 'yes'
      : data.clouds.all > 80
      ? 'likely'
      : 'no';

    return {
      isRaining,
      temperature: data.main.temp,
      humidity: data.main.humidity,
      windSpeed: data.wind.speed * 3.6, // m/s → km/h
      pressure: data.main.pressure,
      cloudCover: data.clouds.all,
      location,
      coordinates: { lat, lon },
      observedAt: new Date(data.dt * 1000).toISOString(),
      sources: [
        {
          name: 'OpenWeather',
          url: 'https://openweathermap.org',
        },
      ],
      note: `Weather: ${data.weather[0].main}`,
    };
  } catch (error: any) {
    console.error('[Weather Module] OpenWeather error:', error.message);
    throw new Error('Failed to fetch weather from OpenWeather');
  }
}

/**
 * ดึงสภาพอากาศแบบ cross-check 2 แหล่ง
 * พยายาม Open-Meteo ก่อน (ฟรี), ถ้าสำเร็จจึง cross-check OpenWeather
 */
export async function fetchWeatherWithCrossCheck(
  lat: number,
  lon: number,
  location: string
): Promise<WeatherData> {
  try {
    // แหล่งหลัก: Open-Meteo
    const primaryData = await fetchOpenMeteoWeather(lat, lon, location);

    // พยายาม cross-check ด้วย OpenWeather (ถ้ามี API key)
    if (process.env.OPENWEATHER_API_KEY) {
      try {
        const secondaryData = await fetchOpenWeatherWeather(lat, lon, location);

        // เปรียบเทียบผลลัพธ์
        if (primaryData.isRaining === secondaryData.isRaining) {
          // สอดคล้องกัน
          primaryData.sources.push(...secondaryData.sources);
          primaryData.note = `Cross-checked 2 sources: ${primaryData.isRaining}`;
          return primaryData;
        } else {
          // ขัดแย้งกัน - ใช้แหล่งที่ใหม่กว่า (recent timestamp ชนะ)
          const primaryTime = new Date(primaryData.observedAt).getTime();
          const secondaryTime = new Date(secondaryData.observedAt).getTime();

          const winner = primaryTime >= secondaryTime ? primaryData : secondaryData;
          winner.sources.push(
            ...(winner === primaryData ? secondaryData.sources : primaryData.sources)
          );
          winner.note = `Sources disagree. Using most recent: ${winner.isRaining}`;
          return winner;
        }
      } catch (secondaryError) {
        // OpenWeather failed, ใช้ Open-Meteo อย่างเดียว
        console.warn('[Weather Module] Cross-check failed, using primary source only');
        return primaryData;
      }
    }

    // ไม่มี OpenWeather key, ใช้ Open-Meteo อย่างเดียว
    return primaryData;
  } catch (error: any) {
    console.error('[Weather Module] All weather sources failed:', error.message);
    throw new Error('ไม่สามารถดึงข้อมูลสภาพอากาศได้ในขณะนี้');
  }
}

/**
 * Location presets สำหรับเมืองหลักในไทย
 */
export const LOCATION_PRESETS: Record<string, { lat: number; lon: number }> = {
  Bangkok: { lat: 13.75, lon: 100.5 },
  'Chiang Mai': { lat: 18.78, lon: 98.98 },
  Phuket: { lat: 7.89, lon: 98.39 },
  Pattaya: { lat: 12.93, lon: 100.88 },
  'Khon Kaen': { lat: 16.43, lon: 102.82 },
  'Hat Yai': { lat: 7.01, lon: 100.47 },
  'Nakhon Ratchasima': { lat: 14.97, lon: 102.08 },
};

/**
 * รับ coordinates จากชื่อเมือง
 */
export function getCoordinates(location: string): { lat: number; lon: number } {
  return LOCATION_PRESETS[location] || LOCATION_PRESETS['Bangkok'];
}
