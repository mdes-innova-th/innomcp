// @ts-nocheck
import { mcpClient } from './mcp-client'; // Pre-configured MCP client (McpClient instance)

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

export interface WeatherReport {
  province: string;
  temperature: number;         // Celsius
  humidity: number;            // percentage
  condition: string;           // e.g. "Partly Cloudy"
  windSpeed?: number;          // km/h
  visibility?: number;         // meters
  timestamp: string;           // ISO 8601
}

export interface DisasterAlert {
  id: string;
  type: string;                // e.g. "flood", "earthquake"
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  province: string;
  issuedAt: string;            // ISO 8601
  expiresAt?: string;
}

export interface ForecastDay {
  date: string;                // YYYY-MM-DD
  maxTemp: number;
  minTemp: number;
  condition: string;
  precipitation: number;       // mm
  humidity: number;
}

export interface ProvinceInfo {
  name: string;
  nameTh: string;
  region: string;
  areaKm2: number;
  population: number;
  capital: string;
  postalCodes: string[];
  borderingProvinces: string[];
}

export interface GeoPoint {
  name: string;
  latitude: number;
  longitude: number;
  type: string;                // e.g. "hospital", "school", "police"
  address: string;
  province: string;
}

export interface Evidence {
  id: string;
  title: string;
  description: string;
  category: string;
  source: string;
  date: string;                // ISO 8601
  attachments?: string[];      // URLs
}

export interface DataStats {
  category: string;
  totalCount: number;
  lastUpdated: string;
  summary: Record<string, number>;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  language: 'th' | 'en';
  category: string;
  lastModified: string;
}

export interface GovInfo {
  topic: string;
  description: string;
  relevantLaws: string[];
  contacts: {
    name: string;
    department: string;
    phone: string;
    email: string;
  }[];
}

// ---------------------------------------------------------------------------
// Minimal MCP client interface (for flexibility)
// ---------------------------------------------------------------------------

interface IMcpClient {
  callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

class ThaiGovtTools {
  constructor(private client: IMcpClient = mcpClient) {}

  // -----------------------------------------------------------------------
  // Weather & Disaster (TMD/NWP)
  // -----------------------------------------------------------------------

  async getWeatherReport(province?: string): Promise<WeatherReport> {
    const result = await this.client.callTool('tmd.weather_report', {
      province: province ?? 'กรุงเทพมหานคร', // default Bangkok
    });
    return result as WeatherReport;
  }

  async getDisasterAlerts(): Promise<DisasterAlert[]> {
    const result = await this.client.callTool('tmd.disaster_alerts', {});
    // The MCP tool returns an array, cast appropriately
    return result as DisasterAlert[];
  }

  async getWeatherForecast(
    province: string,
    days: number = 7
  ): Promise<ForecastDay[]> {
    if (days < 1 || days > 14) {
      throw new Error('Forecast days must be between 1 and 14');
    }
    const result = await this.client.callTool('tmd.weather_forecast', {
      province,
      days,
    });
    return result as ForecastDay[];
  }

  // -----------------------------------------------------------------------
  // Geographic Data
  // -----------------------------------------------------------------------

  async getProvinceInfo(name: string): Promise<ProvinceInfo> {
    const result = await this.client.callTool('geo.province_info', { name });
    return result as ProvinceInfo;
  }

  async findNearest(
    lat: number,
    lon: number,
    type?: string
  ): Promise<GeoPoint[]> {
    const result = await this.client.callTool('geo.find_nearest', {
      lat,
      lon,
      type: type ?? 'all',
    });
    return result as GeoPoint[];
  }

  async searchLocation(query: string): Promise<GeoPoint[]> {
    const result = await this.client.callTool('geo.search_location', { query });
    return result as GeoPoint[];
  }

  // -----------------------------------------------------------------------
  // Evidence & Statistics
  // -----------------------------------------------------------------------

  async searchEvidence(query: string, limit: number = 10): Promise<Evidence[]> {
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }
    const result = await this.client.callTool('evidence.search', {
      query,
      limit,
    });
    return result as Evidence[];
  }

  async getDataStats(category: string): Promise<DataStats> {
    const result = await this.client.callTool('evidence.data_stats', {
      category,
    });
    return result as DataStats;
  }

  // -----------------------------------------------------------------------
  // Knowledge Base
  // -----------------------------------------------------------------------

  async searchKnowledge(
    query: string,
    language: 'th' | 'en' = 'th'
  ): Promise<KnowledgeItem[]> {
    const result = await this.client.callTool('knowledge.search', {
      query,
      language,
    });
    return result as KnowledgeItem[];
  }

  async getGovInfo(topic: string): Promise<GovInfo> {
    const result = await this.client.callTool('knowledge.gov_info', { topic });
    return result as GovInfo;
  }
}

export const thaiGovtTools = new ThaiGovtTools();