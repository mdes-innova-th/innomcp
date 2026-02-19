/**
 * User Override Module
 * à¸£à¸­à¸‡à¸£à¸±à¸šà¸„à¸³à¸ªà¸±à¹ˆà¸‡à¸žà¸´à¹€à¸¨à¸©à¸ˆà¸²à¸à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰
 * 
 * Features:
 * - Location override ("à¸”à¸¹à¸—à¸µà¹ˆà¹€à¸‚à¸•à¸«à¸¥à¸±à¸à¸ªà¸µà¹ˆ")
 * - Time range override ("à¹€à¸£à¸”à¸²à¸£à¹Œ 30 à¸™à¸²à¸—à¸µà¸¥à¹ˆà¸²à¸ªà¸¸à¸”")
 * - Data source selection
 * - Custom parameters
 * 
 * @module utils/userOverride
 */

import { logBoth } from '../mcpLogger';

/**
 * Override Type
 */
export type OverrideType = 
  | 'location'
  | 'time_range'
  | 'data_source'
  | 'parameter';

/**
 * Location Override
 */
export interface LocationOverride {
  type: 'location';
  district?: string;
  province?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  radius?: number; // km
}

/**
 * Time Range Override
 */
export interface TimeRangeOverride {
  type: 'time_range';
  startTime?: Date;
  endTime?: Date;
  duration?: number; // minutes
  preset?: 'last_30min' | 'last_1hour' | 'last_3hours' | 'last_24hours';
}

/**
 * Data Source Override
 */
export interface DataSourceOverride {
  type: 'data_source';
  sources: string[];
  exclude?: string[];
}

/**
 * Parameter Override
 */
export interface ParameterOverride {
  type: 'parameter';
  parameters: Record<string, any>;
}

/**
 * Any Override
 */
export type AnyOverride = 
  | LocationOverride 
  | TimeRangeOverride 
  | DataSourceOverride 
  | ParameterOverride;

/**
 * Override Parser
 */
class OverrideParser {
  private districtPatterns = [
    /(?:à¸—à¸µà¹ˆ|à¹€à¸‚à¸•|à¹à¸‚à¸§à¸‡|à¸•à¸³à¸šà¸¥)\s*([à¸-à¹™\s]+)/,
    /([à¸-à¹™]+)(?:à¹€à¸‚à¸•|à¹à¸‚à¸§à¸‡)/,
  ];

  private timeRangePatterns = [
    /(\d+)\s*à¸™à¸²à¸—à¸µ(?:à¸¥à¹ˆà¸²à¸ªà¸¸à¸”|à¸—à¸µà¹ˆà¹à¸¥à¹‰à¸§)/,
    /(\d+)\s*à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡(?:à¸¥à¹ˆà¸²à¸ªà¸¸à¸”|à¸—à¸µà¹ˆà¹à¸¥à¹‰à¸§)/,
    /à¹€à¸£à¸”à¸²à¸£à¹Œ\s*(\d+)\s*à¸™à¸²à¸—à¸µ/,
  ];

  /**
   * Parse user query for overrides
   */
  parseOverrides(query: string): AnyOverride[] {
    const overrides: AnyOverride[] = [];

    // Try to parse location override
    const location = this.parseLocation(query);
    if (location) {
      overrides.push(location);
    }

    // Try to parse time range override
    const timeRange = this.parseTimeRange(query);
    if (timeRange) {
      overrides.push(timeRange);
    }

    // Try to parse data source override
    const dataSource = this.parseDataSource(query);
    if (dataSource) {
      overrides.push(dataSource);
    }

    if (overrides.length > 0) {
      logBoth('info', `[Override] Parsed ${overrides.length} overrides from query`);
    }

    return overrides;
  }

  /**
   * Parse location override
   */
  private parseLocation(query: string): LocationOverride | null {
    // Check for district patterns
    for (const pattern of this.districtPatterns) {
      const match = query.match(pattern);
      if (match) {
        const district = match[1].trim();
        logBoth('info', `[Override] Location: ${district}`);
        
        return {
          type: 'location',
          district,
          province: 'à¸à¸£à¸¸à¸‡à¹€à¸—à¸žà¸¡à¸«à¸²à¸™à¸„à¸£' // Default to Bangkok
        };
      }
    }

    // Check for specific locations
    const locations: Record<string, { lat: number; lon: number }> = {
      'à¸«à¸¥à¸±à¸à¸ªà¸µà¹ˆ': { lat: 13.8719, lon: 100.5767 },
      'à¸”à¸­à¸™à¹€à¸¡à¸·à¸­à¸‡': { lat: 13.9128, lon: 100.6073 },
      'à¸šà¸²à¸‡à¸™à¸²': { lat: 13.6680, lon: 100.6174 },
      'à¸ªà¸¢à¸²à¸¡': { lat: 13.7462, lon: 100.5346 },
      'à¸ªà¸¸à¸§à¸£à¸£à¸“à¸ à¸¹à¸¡à¸´': { lat: 13.6900, lon: 100.7501 },
    };

    for (const [name, coords] of Object.entries(locations)) {
      if (query.includes(name)) {
        logBoth('info', `[Override] Known location: ${name}`);
        
        return {
          type: 'location',
          district: name,
          coordinates: {
            latitude: coords.lat,
            longitude: coords.lon
          }
        };
      }
    }

    return null;
  }

  /**
   * Parse time range override
   */
  private parseTimeRange(query: string): TimeRangeOverride | null {
    // Check for minute patterns
    const minuteMatch = query.match(/(\d+)\s*à¸™à¸²à¸—à¸µ(?:à¸¥à¹ˆà¸²à¸ªà¸¸à¸”|à¸—à¸µà¹ˆà¹à¸¥à¹‰à¸§|à¸—à¸µà¹ˆà¸œà¹ˆà¸²à¸™à¸¡à¸²)/);
    if (minuteMatch) {
      const minutes = parseInt(minuteMatch[1]);
      logBoth('info', `[Override] Time range: last ${minutes} minutes`);
      
      return {
        type: 'time_range',
        duration: minutes,
        endTime: new Date(),
        startTime: new Date(Date.now() - minutes * 60 * 1000)
      };
    }

    // Check for hour patterns
    const hourMatch = query.match(/(\d+)\s*à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡(?:à¸¥à¹ˆà¸²à¸ªà¸¸à¸”|à¸—à¸µà¹ˆà¹à¸¥à¹‰à¸§|à¸—à¸µà¹ˆà¸œà¹ˆà¸²à¸™à¸¡à¸²)/);
    if (hourMatch) {
      const hours = parseInt(hourMatch[1]);
      logBoth('info', `[Override] Time range: last ${hours} hours`);
      
      return {
        type: 'time_range',
        duration: hours * 60,
        endTime: new Date(),
        startTime: new Date(Date.now() - hours * 60 * 60 * 1000)
      };
    }

    // Check for radar-specific patterns
    const radarMatch = query.match(/à¹€à¸£à¸”à¸²à¸£à¹Œ\s*(\d+)\s*à¸™à¸²à¸—à¸µ/);
    if (radarMatch) {
      const minutes = parseInt(radarMatch[1]);
      logBoth('info', `[Override] Radar time range: ${minutes} minutes`);
      
      return {
        type: 'time_range',
        duration: minutes,
        preset: minutes === 30 ? 'last_30min' : undefined
      };
    }

    return null;
  }

  /**
   * Parse data source override
   */
  private parseDataSource(query: string): DataSourceOverride | null {
    const sources: string[] = [];

    // Check for specific source mentions
    if (/open[-\s]?meteo/i.test(query)) {
      sources.push('open-meteo');
    }
    if (/tmd|à¸à¸£à¸¡à¸­à¸¸à¸•à¸¸/i.test(query)) {
      sources.push('tmd');
    }
    if (/wiki/i.test(query)) {
      sources.push('wikipedia');
    }

    if (sources.length > 0) {
      logBoth('info', `[Override] Data sources: ${sources.join(', ')}`);
      
      return {
        type: 'data_source',
        sources
      };
    }

    return null;
  }

  /**
   * Apply overrides to parameters
   */
  applyOverrides<T extends Record<string, any>>(
    baseParams: T,
    overrides: AnyOverride[]
  ): T {
    let params: any = { ...baseParams };

    for (const override of overrides) {
      switch (override.type) {
        case 'location':
          if (override.coordinates) {
            params.latitude = override.coordinates.latitude;
            params.longitude = override.coordinates.longitude;
          }
          if (override.district) {
            params.district = override.district;
          }
          if (override.province) {
            params.province = override.province;
          }
          break;

        case 'time_range':
          if (override.startTime) {
            params.startTime = override.startTime;
          }
          if (override.endTime) {
            params.endTime = override.endTime;
          }
          if (override.duration) {
            params.duration = override.duration;
          }
          break;

        case 'data_source':
          params.sources = override.sources;
          if (override.exclude) {
            params.excludeSources = override.exclude;
          }
          break;

        case 'parameter':
          params = { ...params, ...override.parameters };
          break;
      }
    }

    return params;
  }

  /**
   * Get override summary
   */
  getSummary(overrides: AnyOverride[]): string {
    if (overrides.length === 0) {
      return 'No overrides';
    }

    const parts: string[] = [];

    for (const override of overrides) {
      switch (override.type) {
        case 'location':
          if (override.district) {
            parts.push(`Location: ${override.district}`);
          }
          if (override.coordinates) {
            parts.push(`Coords: ${override.coordinates.latitude.toFixed(4)}, ${override.coordinates.longitude.toFixed(4)}`);
          }
          break;

        case 'time_range':
          if (override.duration) {
            parts.push(`Time range: last ${override.duration} minutes`);
          }
          break;

        case 'data_source':
          parts.push(`Sources: ${override.sources.join(', ')}`);
          break;

        case 'parameter':
          parts.push(`Custom params: ${Object.keys(override.parameters).join(', ')}`);
          break;
      }
    }

    return parts.join(' | ');
  }
}

// Export singleton instance
export const overrideParser = new OverrideParser();

/**
 * Helper: Parse overrides
 */
export function parseUserOverrides(query: string): AnyOverride[] {
  return overrideParser.parseOverrides(query);
}

/**
 * Helper: Apply overrides
 */
export function applyUserOverrides<T extends Record<string, any>>(
  baseParams: T,
  overrides: AnyOverride[]
): T {
  return overrideParser.applyOverrides(baseParams, overrides);
}

/**
 * Helper: Get override summary
 */
export function getOverrideSummary(overrides: AnyOverride[]): string {
  return overrideParser.getSummary(overrides);
}
