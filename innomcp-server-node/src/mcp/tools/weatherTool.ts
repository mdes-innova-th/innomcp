import { z } from "zod";
import { logBoth } from "../../utils/mcpLogger";

/**
 * WeatherTool - TMD & NWP Weather API Integration
 * 
 * Get weather forecasts using Thailand Meteorological Department APIs.
 * Primary: NWP (Numerical Weather Prediction) - High accuracy
 * Fallback: OpenWeather (current conditions only)
 * 
 * Use cases:
 * - "พรุ่งนี้กรุงเทพฝนตกไหม" → NWP hourly forecast
 * - "อากาศวันนี้เป็นอย่างไร" → OpenWeather current
 * - "พยากรณ์อากาศ 5 วัน" → NWP daily forecast
 */

// Zod schema for input validation
const WeatherToolInputSchema = z.object({
  city: z.string().describe("City name (e.g., Bangkok, London, Tokyo) or province name in Thai"),
  type: z.enum(["current", "forecast", "hourly"]).default("current")
    .describe("Weather type: 'current' for now, 'forecast' for daily, 'hourly' for next 24h"),
  units: z.enum(["metric", "imperial", "standard"]).default("metric")
    .describe("Units: metric (Celsius), imperial (Fahrenheit), standard (Kelvin)"),
  hours: z.number().optional().describe("For hourly forecast: number of hours ahead (max 24)")
});

type WeatherToolInput = z.infer<typeof WeatherToolInputSchema>;

interface CurrentWeather {
  coord: { lon: number; lat: number };
  weather: Array<{ id: number; main: string; description: string; icon: string }>;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  visibility: number;
  wind: { speed: number; deg: number };
  clouds: { all: number };
  dt: number;
  sys: { country: string; sunrise: number; sunset: number };
  timezone: number;
  name: string;
}

interface ForecastWeather {
  list: Array<{
    dt: number;
    main: {
      temp: number;
      feels_like: number;
      temp_min: number;
      temp_max: number;
      pressure: number;
      humidity: number;
    };
    weather: Array<{ id: number; main: string; description: string; icon: string }>;
    clouds: { all: number };
    wind: { speed: number; deg: number };
    visibility: number;
    pop: number; // Probability of precipitation
    dt_txt: string;
  }>;
  city: {
    name: string;
    coord: { lat: number; lon: number };
    country: string;
    timezone: number;
  };
}

/**
 * Get OpenWeather API key from environment
 */
function getWeatherApiKey(): string | null {
  return process.env.OPENWEATHER_API_KEY || null;
}

/**
 * Fetch current weather
 */
async function fetchCurrentWeather(params: WeatherToolInput): Promise<string> {
  const startTime = Date.now();
  const apiKey = getWeatherApiKey();
  
  if (!apiKey) {
    return JSON.stringify({
      success: false,
      error: "OpenWeather API key not configured",
      hint: "Please set OPENWEATHER_API_KEY in .env file. Get free key at https://openweathermap.org/api"
    }, null, 2);
  }
  
  try {
    const url = new URL("https://api.openweathermap.org/data/2.5/weather");
    url.searchParams.set("q", params.city);
    url.searchParams.set("appid", apiKey);
    url.searchParams.set("units", params.units);
    url.searchParams.set("lang", "th"); // Thai language for descriptions
    
    logBoth("INFO", `[WeatherTool] Fetching current weather for ${params.city}`);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenWeather API error: ${error.message || response.statusText}`);
    }
    
    const data: CurrentWeather = await response.json();
    const duration = Date.now() - startTime;
    
    logBoth("INFO", `[WeatherTool] Current weather fetched in ${duration}ms`);
    
    return formatCurrentWeather(data, params.units, duration);
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logBoth("ERROR", `[WeatherTool] Error after ${duration}ms: ${String(error)}`);
    
    return JSON.stringify({
      success: false,
      error: error.message || "Unknown error",
      city: params.city,
      duration: `${duration}ms`
    }, null, 2);
  }
}

/**
 * Fetch 5-day forecast
 */
async function fetchForecast(params: WeatherToolInput): Promise<string> {
  const startTime = Date.now();
  const apiKey = getWeatherApiKey();
  
  if (!apiKey) {
    return JSON.stringify({
      success: false,
      error: "OpenWeather API key not configured",
      hint: "Please set OPENWEATHER_API_KEY in .env file. Get free key at https://openweathermap.org/api"
    }, null, 2);
  }
  
  try {
    const url = new URL("https://api.openweathermap.org/data/2.5/forecast");
    url.searchParams.set("q", params.city);
    url.searchParams.set("appid", apiKey);
    url.searchParams.set("units", params.units);
    url.searchParams.set("lang", "th");
    
    logBoth("INFO", `[WeatherTool] Fetching 5-day forecast for ${params.city}`);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenWeather API error: ${error.message || response.statusText}`);
    }
    
    const data: ForecastWeather = await response.json();
    const duration = Date.now() - startTime;
    
    logBoth("INFO", `[WeatherTool] Forecast fetched in ${duration}ms`);
    
    return formatForecast(data, params.units, duration);
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logBoth("ERROR", `[WeatherTool] Error after ${duration}ms: ${String(error)}`);
    
    return JSON.stringify({
      success: false,
      error: error.message || "Unknown error",
      city: params.city,
      duration: `${duration}ms`
    }, null, 2);
  }
}

/**
 * Format current weather
 */
function formatCurrentWeather(data: CurrentWeather, units: string, duration: number): string {
  const unitSymbol = units === "metric" ? "°C" : units === "imperial" ? "°F" : "K";
  const speedUnit = units === "metric" ? "m/s" : "mph";
  
  let output = `🌤️  Current Weather\n\n`;
  
  output += `📍 Location: **${data.name}, ${data.sys.country}**\n`;
  output += `📅 Time: ${new Date(data.dt * 1000).toLocaleString("th-TH")}\n\n`;
  
  output += `🌡️  **Temperature**: ${data.main.temp}${unitSymbol}\n`;
  output += `🤔 **Feels Like**: ${data.main.feels_like}${unitSymbol}\n`;
  output += `📊 **Min/Max**: ${data.main.temp_min}${unitSymbol} / ${data.main.temp_max}${unitSymbol}\n\n`;
  
  output += `☁️  **Condition**: ${data.weather[0].description}\n`;
  output += `💧 **Humidity**: ${data.main.humidity}%\n`;
  output += `🎈 **Pressure**: ${data.main.pressure} hPa\n`;
  output += `👁️  **Visibility**: ${(data.visibility / 1000).toFixed(1)} km\n\n`;
  
  output += `💨 **Wind**: ${data.wind.speed} ${speedUnit}\n`;
  output += `☁️  **Cloudiness**: ${data.clouds.all}%\n\n`;
  
  const sunrise = new Date(data.sys.sunrise * 1000).toLocaleTimeString("th-TH", { 
    hour: "2-digit", minute: "2-digit" 
  });
  const sunset = new Date(data.sys.sunset * 1000).toLocaleTimeString("th-TH", { 
    hour: "2-digit", minute: "2-digit" 
  });
  output += `🌅 **Sunrise**: ${sunrise}\n`;
  output += `🌇 **Sunset**: ${sunset}\n\n`;
  
  output += `---\n\n`;
  output += `⏱️  Retrieved in ${duration}ms`;
  
  return output;
}

/**
 * Format forecast (group by day, show key times)
 */
function formatForecast(data: ForecastWeather, units: string, duration: number): string {
  const unitSymbol = units === "metric" ? "°C" : units === "imperial" ? "°F" : "K";
  
  let output = `🌦️  5-Day Weather Forecast\n\n`;
  
  output += `📍 Location: **${data.city.name}, ${data.city.country}**\n\n`;
  output += `---\n\n`;
  
  // Group by date
  const byDate = new Map<string, typeof data.list>();
  data.list.forEach(item => {
    const date = item.dt_txt.split(" ")[0];
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(item);
  });
  
  // Show each day
  let dayNum = 1;
  byDate.forEach((items, date) => {
    const dateObj = new Date(date);
    const dayName = dateObj.toLocaleDateString("th-TH", { weekday: "long" });
    
    output += `**${dayNum}. ${dayName} (${date})**\n\n`;
    
    // Get key times (morning, afternoon, evening)
    const morning = items.find(i => i.dt_txt.includes("06:00") || i.dt_txt.includes("09:00")) || items[0];
    const afternoon = items.find(i => i.dt_txt.includes("12:00") || i.dt_txt.includes("15:00")) || items[Math.floor(items.length / 2)];
    const evening = items.find(i => i.dt_txt.includes("18:00") || i.dt_txt.includes("21:00")) || items[items.length - 1];
    
    // Morning
    if (morning) {
      const time = morning.dt_txt.split(" ")[1].substring(0, 5);
      output += `   🌅 ${time} - ${morning.weather[0].description}\n`;
      output += `      ${morning.main.temp}${unitSymbol}, ☁️ ${morning.clouds.all}%, 💧 ${morning.main.humidity}%\n`;
      if (morning.pop > 0) {
        output += `      🌧️  ฝนตก: ${(morning.pop * 100).toFixed(0)}%\n`;
      }
      output += `\n`;
    }
    
    // Afternoon
    if (afternoon && afternoon !== morning) {
      const time = afternoon.dt_txt.split(" ")[1].substring(0, 5);
      output += `   ☀️  ${time} - ${afternoon.weather[0].description}\n`;
      output += `      ${afternoon.main.temp}${unitSymbol}, ☁️ ${afternoon.clouds.all}%, 💧 ${afternoon.main.humidity}%\n`;
      if (afternoon.pop > 0) {
        output += `      🌧️  ฝนตก: ${(afternoon.pop * 100).toFixed(0)}%\n`;
      }
      output += `\n`;
    }
    
    // Evening
    if (evening && evening !== afternoon && evening !== morning) {
      const time = evening.dt_txt.split(" ")[1].substring(0, 5);
      output += `   🌙 ${time} - ${evening.weather[0].description}\n`;
      output += `      ${evening.main.temp}${unitSymbol}, ☁️ ${evening.clouds.all}%, 💧 ${evening.main.humidity}%\n`;
      if (evening.pop > 0) {
        output += `      🌧️  ฝนตก: ${(evening.pop * 100).toFixed(0)}%\n`;
      }
      output += `\n`;
    }
    
    output += `\n`;
    dayNum++;
  });
  
  output += `---\n\n`;
  output += `⏱️  Retrieved in ${duration}ms`;
  
  return output;
}

/**
 * Tool definition for MCP
 */
export const weatherTool = {
  name: "weather",
  description: "Get CURRENT weather conditions ONLY. For forecasts (rain, temperature predictions), use nwpHourlyTool or nwpDailyTool instead. This tool shows real-time temperature, humidity, wind.",
  inputSchema: WeatherToolInputSchema,
  execute: async (args: unknown) => {
    // Validate input
    const parsed = WeatherToolInputSchema.safeParse(args);
    if (!parsed.success) {
      const errorText = JSON.stringify({
        success: false,
        error: "Invalid input",
        details: parsed.error.issues
      }, null, 2);
      return {
        content: [{ type: "text" as const, text: errorText }]
      };
    }
    
    // Route to appropriate API
    if (parsed.data.type === "hourly" || (parsed.data.type === "forecast" && parsed.data.hours)) {
      // Suggest using nwpHourlyTool
      const suggestion = JSON.stringify({
        success: false,
        suggestion: "For hourly forecasts, please use 'nwpHourlyTool' instead",
        hint: `Use tool: nwpHourlyPlace with province="${parsed.data.city}"`
      }, null, 2);
      return {
        content: [{ type: "text" as const, text: suggestion }]
      };
    }
    
    if (parsed.data.type === "forecast") {
      // Suggest using nwpDailyTool
      const suggestion = JSON.stringify({
        success: false,
        suggestion: "For daily forecasts, please use 'nwpDailyTool' instead",
        hint: `Use tool: nwpDailyPlace with province="${parsed.data.city}"`
      }, null, 2);
      return {
        content: [{ type: "text" as const, text: suggestion }]
      };
    }
    
    // Only handle current weather
    const result = await fetchCurrentWeather(parsed.data);
    
    return {
      content: [{ type: "text" as const, text: result }]
    };
  }
};

export default weatherTool;
