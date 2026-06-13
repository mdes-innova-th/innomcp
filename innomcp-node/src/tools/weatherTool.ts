/**
 * Weather Tool for Thai provinces using Open-Meteo free API (no key required).
 *
 * @fileoverview Fetches current temperature, humidity, weather condition, and wind
 *              for a major Thai province. Uses a hardcoded lookup table of ~10 provinces
 *              to map province names to coordinates. The tool implements the uniform
 *              Tool interface expected by the integrator.
 *
 * Usage examples:
 *
 * 1. Simple invocation:
 *
 *    const weatherTool = require('./weatherTool').default; // or ES import
 *    const result = await weatherTool.run({ province: 'Bangkok' }, {});
 *    if (result.ok) {
 *      console.log(`Temp: ${result.output.temperature}°C`);
 *    } else {
 *      console.error(result.error);
 *    }
 *
 * 2. With AbortSignal (timeout):
 *
 *    const controller = new AbortController();
 *    setTimeout(() => controller.abort(), 2000);
 *    const result = await weatherTool.run(
 *      { province: 'Phuket' },
 *      { signal: controller.signal }
 *    );
 *    if (!result.ok) console.warn(result.error);
 * */

import { Tool } from '../types/tool';

// ---------------------------------------------------------------------------
// Province coordinate lookup (lat, lon for ~10 major Thai destinations)
// ---------------------------------------------------------------------------
const PROVINCE_COORDS: Record<string, { lat: number; lon: number }> = {
  'bangkok':            { lat: 13.7563, lon: 100.5018 },
  'chiang mai':         { lat: 18.7883, lon: 98.9853  },
  'phuket':             { lat:  7.8804, lon: 98.3923  },
  'pattaya':            { lat: 12.9283, lon: 100.8883  },
  'nakhon ratchasima':  { lat: 14.9798, lon: 102.0975 },
  'khon kaen':          { lat: 16.4322, lon: 102.8236 },
  'udon thani':         { lat: 17.4136, lon: 102.7872 },
  'hat yai':            { lat:  7.0086, lon: 100.4742 },
  'surat thani':        { lat:  9.1389, lon: 99.3331  },
  'rayong':            { lat: 12.6816, lon: 101.2818 },
};

// ---------------------------------------------------------------------------
// WMO Weather code → human-readable condition
// ---------------------------------------------------------------------------
const WMO_CONDITIONS: Record<number, string> = {
  0:  'Clear sky',
  1:  'Mainly clear',
  2:  'Partly cloudy',
  3:  'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

// ---------------------------------------------------------------------------
// Helper: normalize province name and look up coordinates
// ---------------------------------------------------------------------------
function lookupProvince(name: string): { lat: number; lon: number } | null {
  const key = name.trim().toLowerCase();
  return PROVINCE_COORDS[key] ?? null;
}

// ---------------------------------------------------------------------------
// Tool implementation
// ---------------------------------------------------------------------------
const weatherTool: Tool = {
  name: 'weather_thailand',
  description: 'Get current weather for a major Thai province using Open-Meteo (free, no API key)',
  inputSchema: {
    type: 'object',
    properties: {
      province: {
        type: 'string',
        description: 'Name of the Thai province (e.g., Bangkok, Chiang Mai, Phuket, Pattaya, Khon Kaen)',
      },
    },
    required: ['province'],
  },

  async run(input: any, ctx: { signal?: AbortSignal } = {}) {
    const provinceRaw: string | undefined = input?.province;
    if (typeof provinceRaw !== 'string' || provinceRaw.trim().length === 0) {
      return {
        ok: false,
        error: 'Missing or invalid "province" string field',
      };
    }

    const coords = lookupProvince(provinceRaw);
    if (!coords) {
      const supported = Object.keys(PROVINCE_COORDS)
        .map((n) => n.charAt(0).toUpperCase() + n.slice(1))
        .join(', ');
      return {
        ok: false,
        error: `Unknown province "${provinceRaw}". Supported: ${supported}`,
      };
    }

    const { lat, lon } = coords;

    // Open-Meteo endpoint with current parameters for temp, humidity, weather code, wind
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto&forecast_days=1`;

    let response: Response;
    try {
      response = await fetch(url, { signal: ctx.signal });
    } catch (err: any) {
      // Distinguish abort from network/other errors
      if (err?.name === 'AbortError') {
        return { ok: false, error: 'Request aborted' };
      }
      return {
        ok: false,
        error: `Failed to fetch weather data: ${err?.message ?? 'Unknown error'}`,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: `Open-Meteo API returned status ${response.status}`,
      };
    }

    let data: any;
    try {
      data = await response.json();
    } catch (err: any) {
      return {
        ok: false,
        error: `Failed to parse Open-Meteo response: ${err?.message ?? 'Unknown error'}`,
      };
    }

    const current = data?.current;
    if (!current || typeof current.temperature_2m !== 'number') {
      return {
        ok: false,
        error: 'Unexpected Open-Meteo response format (missing current data)',
      };
    }

    const temperature = current.temperature_2m;           // °C
    const humidity = current.relative_humidity_2m;       // %
    const weatherCode: number = current.weather_code;
    const windSpeed = current.wind_speed_10m;            // km/h (default)
    const windDirection: number = current.wind_direction_10m; // degrees

    const condition = WMO_CONDITIONS[weatherCode] ?? `Weather code ${weatherCode}`;

    const output = {
      province: provinceRaw.trim(),
      temperature,
      humidity,
      condition,
      windSpeed,
      windDirection,
      unit: '°C',
      timestamp: current.time,   // ISO string from Open-Meteo
    };

    const artifactContent = JSON.stringify(output, null, 2);
    const artifactFileName = `weather-${provinceRaw.trim().toLowerCase().replace(/\s+/g, '_')}.json`;

    return {
      ok: true,
      output,
      artifacts: [
        {
          name: artifactFileName,
          mime: 'application/json',
          content: artifactContent,
        },
      ],
    };
  },
};

export default weatherTool;
