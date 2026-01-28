/**
 * Intent-based Message Handler
 * จัดการคำถามตาม intent classification
 * เชื่อมต่อกับ weather modules, time, office holder ฯลฯ
 * 
 * @author MDES Development Team
 * @created 2026-01-10
 */

import { classifyIntent, ClassifiedIntent } from '../intent/classifier';
import { getRouteConfig, selectAvailableDataSource } from '../router/intentRouter';
import { fetchWeatherWithCrossCheck, getCoordinates, WeatherData } from '../weather/realtime';
import { resolveLocation } from '../location/resolver';
import { logBoth } from '../mcpLogger';
import { getCurrentTime } from '../time';
import { getCurrentPrimeMinister } from '../officeholder';
import { search } from '../search';
import { createFallbackMessage, tryFallbackSources } from '../fallback';
import { formatWeatherNowResponse, formatLocalTimeResponse, formatOfficeHolderResponse } from '../style/thaiResponse';

export interface IntentHandlerResult {
  handled: boolean;
  response?: string;
  structuredContent?: any;
  sources?: Array<{ name: string; url: string }>;
  latencyMs?: number;
  intent?: string;
}

/**
 * จัดการคำถามตาม intent
 * คืนค่า handled=true ถ้าสามารถตอบได้โดยตรงจาก data sources
 */
export async function handleByIntent(query: string): Promise<IntentHandlerResult> {
  const startTime = Date.now();

  try {
    // 1. Classify intent
    const intent = classifyIntent(query);
    logBoth('info', `[Intent] Classified as: ${intent.type} (confidence: ${intent.confidence})`);

    // 2. Get route config
    const routeConfig = getRouteConfig(intent);

    // 3. Handle based on intent type
    switch (intent.type) {
      case 'WeatherNow':
        return await handleWeatherNow(intent, startTime);

      case 'LocalTime':
        return await handleLocalTime(intent, startTime);

      case 'CurrentOfficeHolder':
        return await handleOfficeHolder(intent, startTime);

      case 'OpenSearch':
        return await handleOpenSearch(intent, startTime);

      case 'WeatherForecast':
      case 'GeneralFact':
      case 'ToolSpecific':
        // ยังไม่ได้ implement เต็มรูป ให้ LLM + MCP Tools จัดการต่อ
        return {
          handled: false,
          intent: intent.type,
        };

      case 'Fallback':
      default:
        return {
          handled: false,
          intent: 'Fallback',
        };
    }
  } catch (error: any) {
    logBoth('error', `[Intent Handler] Error: ${error.message}`);
    return {
      handled: false,
    };
  }
}

/**
 * จัดการคำถาม WeatherNow (สภาพอากาศปัจจุบัน)
 */
async function handleWeatherNow(
  intent: ClassifiedIntent,
  startTime: number
): Promise<IntentHandlerResult> {
  try {
    // Resolve location
    const location = resolveLocation(intent.originalQuery);
    logBoth('info', `[Weather] Location resolved: ${location.name} (${location.lat}, ${location.lon})`);

    // Fetch weather with cross-check
    const weatherData = await fetchWeatherWithCrossCheck(
      location.lat,
      location.lon,
      location.name
    );

    const latencyMs = Date.now() - startTime;
    logBoth('info', `[Weather] Data fetched in ${latencyMs}ms: ${weatherData.isRaining}`);

    // สร้างคำตอบภาษาไทยสุภาพ
    const response = formatWeatherResponse(weatherData, intent.originalQuery);

    return {
      handled: true,
      response,
      structuredContent: {
        type: 'weather',
        data: weatherData,
      },
      sources: weatherData.sources,
      latencyMs,
      intent: 'WeatherNow',
    };
  } catch (error: any) {
    logBoth('error', `[Weather] Error: ${error.message}`);

    // Fallback response
    return {
      handled: true,
      response:
        'ขออภัยครับ ตอนนี้ไม่สามารถดึงข้อมูลสภาพอากาศสดได้ อาจเกิดจากการเชื่อมต่อไม่เสถียรหรือแหล่งข้อมูลชั่วคราวไม่พร้อม\n\n' +
        'คุณสามารถตรวจสอบสภาพอากาศได้ที่:\n' +
        '• กรมอุตุนิยมวิทยา: https://www.tmd.go.th\n' +
        '• MSN Weather: https://www.msn.com/th-th/weather',
      latencyMs: Date.now() - startTime,
      intent: 'WeatherNow',
    };
  }
}

/**
 * จัดการคำถาม LocalTime (เวลาท้องถิ่น)
 */
async function handleLocalTime(
  intent: ClassifiedIntent,
  startTime: number
): Promise<IntentHandlerResult> {
  try {
    // Get current time from time module
    const timeData = getCurrentTime();
    const latencyMs = Date.now() - startTime;

    // Format using Thai response style
    const response = formatLocalTimeResponse(timeData);

    return {
      handled: true,
      response,
      structuredContent: {
        type: 'time',
        data: timeData,
      },
      sources: [
        {
          name: 'System Clock',
          url: 'https://time.is/Bangkok',
        },
      ],
      latencyMs,
      intent: 'LocalTime',
    };
  } catch (error: any) {
    logBoth('error', `[Time] Error: ${error.message}`);

    // Use fallback design
    const fallbackMsg = createFallbackMessage('LocalTime', error);
    return {
      handled: true,
      response: fallbackMsg,
      latencyMs: Date.now() - startTime,
      intent: 'LocalTime',
    };
  }
}

/**
 * จัดการคำถาม CurrentOfficeHolder (นายกรัฐมนตรี, รัฐมนตรี)
 */
async function handleOfficeHolder(
  intent: ClassifiedIntent,
  startTime: number
): Promise<IntentHandlerResult> {
  try {
    // Fetch office holder data with fallback
    const data = await tryFallbackSources(
      () => getCurrentPrimeMinister(),
      [] // No additional fallbacks for now
    );

    const latencyMs = Date.now() - startTime;

    // Format using Thai response style
    const response = formatOfficeHolderResponse({
      office: 'นายกรัฐมนตรี',
      name: data.name,
      party: data.party,
      startedAt: data.startedAt,
    });

    return {
      handled: true,
      response,
      structuredContent: {
        type: 'officeholder',
        data,
      },
      sources: [
        {
          name: 'Thai Government',
          url: 'https://www.thaigov.go.th',
        },
      ],
      latencyMs,
      intent: 'CurrentOfficeHolder',
    };
  } catch (error: any) {
    logBoth('error', `[OfficeHolder] Error: ${error.message}`);

    const fallbackMsg = createFallbackMessage('CurrentOfficeHolder', error);
    return {
      handled: true,
      response: fallbackMsg,
      latencyMs: Date.now() - startTime,
      intent: 'CurrentOfficeHolder',
    };
  }
}

/**
 * จัดการคำถาม OpenSearch (ค้นหาเว็บทั่วไป)
 */
async function handleOpenSearch(
  intent: ClassifiedIntent,
  startTime: number
): Promise<IntentHandlerResult> {
  try {
    // Extract search query from original query
    const searchQuery = intent.originalQuery;

    // Search with multiple APIs (cascade fallback)
    const searchResults = await search(searchQuery, 5);

    const latencyMs = Date.now() - startTime;

    // Format response in Thai
    let response = `🔍 **ผลการค้นหา:** "${searchQuery}"\n\n`;

    if (searchResults.results && searchResults.results.length > 0) {
      searchResults.results.forEach((result, index) => {
        response += `${index + 1}. **${result.title}**\n`;
        response += `   ${result.snippet}\n`;
        response += `   🔗 ${result.url}\n\n`;
      });

      response += `\n**แหล่งข้อมูล:** ${searchResults.sources[0]?.name || 'Search API'}`;
      if (searchResults.totalResults) {
        response += `\n_พบผลลัพธ์ทั้งหมด: ${searchResults.totalResults.toLocaleString()} รายการ_`;
      }
    } else {
      response += 'ไม่พบผลลัพธ์ที่เกี่ยวข้อง\n\n';
      response += 'คำแนะนำ:\n';
      response += '• ลองใช้คำค้นหาอื่น\n';
      response += '• ตรวจสอบการสะกดคำ\n';
      response += '• ใช้คำค้นหาที่เฉพาะเจาะจงมากขึ้น';
    }

    return {
      handled: true,
      response,
      structuredContent: {
        type: 'search',
        data: searchResults,
      },
      sources: [
        {
          name: searchResults.sources[0]?.name || 'Search API',
          url: 'https://www.google.com/search?q=' + encodeURIComponent(searchQuery),
        },
      ],
      latencyMs,
      intent: 'OpenSearch',
    };
  } catch (error: any) {
    logBoth('error', `[OpenSearch] Error: ${error.message}`);

    const fallbackMsg = createFallbackMessage('OpenSearch', error);
    return {
      handled: true,
      response: fallbackMsg,
      latencyMs: Date.now() - startTime,
      intent: 'OpenSearch',
    };
  }
}

/**
 * จัดรูปแบบคำตอบสภาพอากาศเป็นภาษาไทยสุภาพ
 */
function formatWeatherResponse(weatherData: WeatherData, originalQuery: string): string {
  // Use Thai response style formatter
  return formatWeatherNowResponse({
    isRaining: weatherData.isRaining,
    temperature: weatherData.temperature,
    humidity: weatherData.humidity,
    location: weatherData.location,
    observedAt: weatherData.observedAt,
    sources: weatherData.sources.map(s => s.name),
  });
}
