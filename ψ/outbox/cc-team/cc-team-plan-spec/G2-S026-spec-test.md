<!-- cc-team deliverable
 group: G2 (Spec/contract-based tests)
 member: S026 role=spec-test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":408,"completion_tokens":4469,"total_tokens":4877,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1161,"image_tokens":0},"cache_creation_input_tokens":0} | 37s
 generated: 2026-06-13T11:26:50.222Z -->
```typescript
import { ThaiGovtTools, WeatherReport, DisasterAlert, ForecastDay, ProvinceInfo, GeoPoint, Evidence, DataStats, KnowledgeItem, GovInfo } from '../src/services/thaiGovtTools';

// Mock client interface – we simulate the external MCP service
interface MockClient {
  getWeatherReport: jest.Mock<Promise<WeatherReport>, [string | undefined]>;
  getDisasterAlerts: jest.Mock<Promise<DisasterAlert[]>, []>;
  getWeatherForecast: jest.Mock<Promise<ForecastDay[]>, [string, number]>;
  getProvinceInfo: jest.Mock<Promise<ProvinceInfo>, [string]>;
  findNearest: jest.Mock<Promise<GeoPoint[]>, [number, number, number]>;
  searchLocation: jest.Mock<Promise<GeoPoint[]>, [string]>;
  searchEvidence: jest.Mock<Promise<Evidence[]>, [string, number]>;
  getDataStats: jest.Mock<Promise<DataStats>, [string]>;
  searchKnowledge: jest.Mock<Promise<KnowledgeItem[]>, [string, string]>;
  getGovInfo: jest.Mock<Promise<GovInfo>, [string]>;
}

function createMockClient(): MockClient {
  return {
    getWeatherReport: jest.fn(),
    getDisasterAlerts: jest.fn(),
    getWeatherForecast: jest.fn(),
    getProvinceInfo: jest.fn(),
    findNearest: jest.fn(),
    searchLocation: jest.fn(),
    searchEvidence: jest.fn(),
    getDataStats: jest.fn(),
    searchKnowledge: jest.fn(),
    getGovInfo: jest.fn(),
  };
}

describe('ThaiGovtTools', () => {
  let mockClient: MockClient;
  let tools: ThaiGovtTools;

  // Default mock data for a typical response (according to contracts implied by field names)
  const dummyWeatherReport: WeatherReport = {
    province: 'Bangkok',
    temperature: 32,
    condition: 'sunny',
    humidity: 60,
  };
  const dummyDisasterAlerts: DisasterAlert[] = [
    { id: '1', type: 'flood', severity: 'high', location: 'Bangkok' },
  ];
  const dummyForecast: ForecastDay[] = [
    { date: '2025-04-10', high: 34, low: 28, condition: 'partly cloudy' },
  ];
  const dummyProvinceInfo: ProvinceInfo = {
    name: 'Chiang Mai',
    population: 1800000,
    area: 20107,
    capital: 'Chiang Mai',
  };
  const dummyGeoPoint: GeoPoint = { lat: 13.75, lng: 100.5 };
  const dummyEvidence: Evidence = { id: 'ev1', description: 'Smoke detected', timestamp: '2025-04-10T12:00:00Z' };
  const dummyStats: DataStats = { category: 'health', count: 150, lastUpdated: '2025-04-10' };
  const dummyKnowledge: KnowledgeItem = { title: 'Weather safety', summary: 'Stay indoors during storms', source: 'Gov' };
  const dummyGovInfo: GovInfo = { topic: 'taxes', content: 'File by April 15', authority: 'Revenue Department' };

  beforeEach(() => {
    mockClient = createMockClient();
    // Instantiate the class with the mock client (injectable via constructor)
    tools = new ThaiGovtTools(mockClient as any);
  });

  // ------------------------------------------------------------------
  // 1. getWeatherReport
  // ------------------------------------------------------------------
  describe('getWeatherReport', () => {
    it('should return a WeatherReport when province is provided', async () => {
      mockClient.getWeatherReport.mockResolvedValue(dummyWeatherReport);
      const result = await tools.getWeatherReport('Bangkok');
      expect(result).toBe(dummyWeatherReport);
      expect(mockClient.getWeatherReport).toHaveBeenCalledWith('Bangkok');
    });

    it('should return a WeatherReport when province is omitted (undefined)', async () => {
      mockClient.getWeatherReport.mockResolvedValue(dummyWeatherReport);
      const result = await tools.getWeatherReport();
      expect(result).toBe(dummyWeatherReport);
      expect(mockClient.getWeatherReport).toHaveBeenCalledWith(undefined);
    });

    it('should throw if the underlying client rejects (network error)', async () => {
      const error = new Error('API failure');
      mockClient.getWeatherReport.mockRejectedValue(error);
      await expect(tools.getWeatherReport('Bangkok')).rejects.toThrow('API failure');
    });

    it('should throw TypeError if province is not a string (contract: optional string)', async () => {
      // Invalid input: number instead of string
      await expect(tools.getWeatherReport(123 as any)).rejects.toThrow(TypeError);
    });

    it('should throw RangeError for empty province string (boundary)', async () => {
      await expect(tools.getWeatherReport('')).rejects.toThrow(RangeError);
    });
  });

  // ------------------------------------------------------------------
  // 2. getDisasterAlerts
  // ------------------------------------------------------------------
  describe('getDisasterAlerts', () => {
    it('should return an array of DisasterAlert', async () => {
      mockClient.getDisasterAlerts.mockResolvedValue(dummyDisasterAlerts);
      const result = await tools.getDisasterAlerts();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('flood');
    });

    it('should return empty array when no alerts', async () => {
      mockClient.getDisasterAlerts.mockResolvedValue([]);
      const result = await tools.getDisasterAlerts();
      expect(result).toEqual([]);
    });

    it('should throw if client rejects', async () => {
      mockClient.getDisasterAlerts.mockRejectedValue(new Error('Service unavailable'));
      await expect(tools.getDisasterAlerts()).rejects.toThrow('Service unavailable');
    });
  });

  // ------------------------------------------------------------------
  // 3. getWeatherForecast
  // ------------------------------------------------------------------
  describe('getWeatherForecast', () => {
    it('should return forecast days for valid province and positive days', async () => {
      mockClient.getWeatherForecast.mockResolvedValue(dummyForecast);
      const result = await tools.getWeatherForecast('Bangkok', 3);
      expect(result).toEqual(dummyForecast);
      expect(mockClient.getWeatherForecast).toHaveBeenCalledWith('Bangkok', 3);
    });

    it('should throw if province is missing (required)', async () => {
      // @ts-expect-error – intentionally missing required argument
      await expect(tools.getWeatherForecast()).rejects.toThrow(TypeError);
    });

    it('should throw if days is not a positive integer (boundary: zero)', async () => {
      await expect(tools.getWeatherForecast('Bangkok', 0)).rejects.toThrow(RangeError);
    });

    it('should throw if days is negative', async () => {
      await expect(tools.getWeatherForecast('Bangkok', -1)).rejects.toThrow(RangeError);
    });

    it('should throw if days is not a number', async () => {
      await expect(tools.getWeatherForecast('Bangkok', 'many' as any)).rejects.toThrow(TypeError);
    });
  });

  // ------------------------------------------------------------------
  // 4. getProvinceInfo
  // ------------------------------------------------------------------
  describe('getProvinceInfo', () => {
    it('should return ProvinceInfo for a known province', async () => {
      mockClient.getProvinceInfo.mockResolvedValue(dummyProvinceInfo);
      const result = await tools.getProvinceInfo('Chiang Mai');
      expect(result).toEqual(dummyProvinceInfo);
    });

    it('should throw if name is empty string (required non-empty)', async () => {
      await expect(tools.getProvinceInfo('')).rejects.toThrow(RangeError);
    });

    it('should throw if name is undefined (required)', async () => {
      // @ts-expect-error
      await expect(tools.getProvinceInfo()).rejects.toThrow(TypeError);
    });

    it('should throw if name is not a string', async () => {
      await expect(tools.getProvinceInfo(42 as any)).rejects.toThrow(TypeError);
    });
  });

  // ------------------------------------------------------------------
  // 5. findNearest
  // ------------------------------------------------------------------
  describe('findNearest', () => {
    it('should return GeoPoint array for valid coordinates and limit', async () => {
      mockClient.findNearest.mockResolvedValue([dummyGeoPoint]);
      const result = await tools.findNearest(13.75, 100.5, 5);
      expect(result).toHaveLength(1);
      expect(result[0].lat).toBeCloseTo(13.75);
    });

    it('should throw if latitude is out of range (-90..90)', async () => {
      await expect(tools.findNearest(100, 0, 5)).rejects.toThrow(RangeError);
    });

    it('should throw if longitude is out of range (-180..180)', async () => {
      await expect(tools.findNearest(0, 200, 5)).rejects.toThrow(RangeError);
    });

    it('should throw if limit is not a positive integer', async () => {
      await expect(tools.findNearest(0, 0, 0)).rejects.toThrow(RangeError);
    });

    it('should throw if coordinates are not numbers', async () => {
      await expect(tools.findNearest('13' as any, 100, 5)).rejects.toThrow(TypeError);
    });
  });

  // ------------------------------------------------------------------
  // 6. searchLocation
  // ------------------------------------------------------------------
  describe('searchLocation', () => {
    it('should return GeoPoint array for a valid query', async () => {
      mockClient.searchLocation.mockResolvedValue([dummyGeoPoint]);
      const result = await tools.searchLocation('Bangkok');
      expect(result).toHaveLength(1);
    });

    it('should throw if query is empty string', async () => {
      await expect(tools.searchLocation('')).rejects.toThrow(RangeError);
    });

    it('should throw if query is missing (required)', async () => {
      // @ts-expect-error
      await expect(tools.searchLocation()).rejects.toThrow(TypeError);
    });

    it('should throw if query is not a string', async () => {
      await expect(tools.searchLocation(123 as any)).rejects.toThrow(TypeError);
    });
  });

  // ------------------------------------------------------------------
  // 7. searchEvidence
  // ------------------------------------------------------------------
  describe('searchEvidence', () => {
    it('should return Evidence array for valid query and default limit (10)', async () => {
      mockClient.searchEvidence.mockResolvedValue([dummyEvidence]);
      const result = await tools.searchEvidence('smoke');
      expect(result).toHaveLength(1);
      expect(mockClient.searchEvidence).toHaveBeenCalledWith('smoke', 10);
    });

    it('should use provided limit', async () => {
      mockClient.searchEvidence.mockResolvedValue([]);
      await tools.searchEvidence('fire', 5);
      expect(mockClient.searchEvidence).toHaveBeenCalledWith('fire', 5);
    });

    it('should throw if query is empty', async () => {
      await expect(tools.searchEvidence('', 5)).rejects.toThrow(RangeError);
    });

    it('should throw if limit is not a positive integer (negative)', async () => {
      await expect(tools.searchEvidence('fire', -1)).rejects.toThrow(RangeError);
    });

    it('should throw if limit is zero', async () => {
      await expect(tools.searchEvidence('fire', 0)).rejects.toThrow(RangeError);
    });
  });

  // ------------------------------------------------------------------
  // 8. getDataStats
  // ------------------------------------------------------------------
  describe('getDataStats', () => {
    it('should return DataStats for a valid category', async () => {
      mockClient.getDataStats.mockResolvedValue(dummyStats);
      const result = await tools.getDataStats('health');
      expect(result.category).toBe('health');
    });

    it('should throw if category is empty string', async () => {
      await expect(tools.getDataStats('')).rejects.toThrow(RangeError);
    });

    it('should throw if category is missing', async () => {
      // @ts-expect-error
      await expect(tools.getDataStats()).rejects.toThrow(TypeError);
    });

    it('should throw if category is not a string', async () => {
      await expect(tools.getDataStats(true as any)).rejects.toThrow(TypeError);
    });
  });

  // ------------------------------------------------------------------
  // 9. searchKnowledge
  // ------------------------------------------------------------------
  describe('searchKnowledge', () => {
    it('should return KnowledgeItem array for valid query and category', async () => {
      mockClient.searchKnowledge.mockResolvedValue([dummyKnowledge]);
      const result = await tools.searchKnowledge('weather', 'safety');
      expect(result).toHaveLength(1);
    });

    it('should throw if query is empty', async () => {
      await expect(tools.searchKnowledge('', 'safety')).rejects.toThrow(RangeError);
    });

    it('should throw if category is empty', async () => {
      await expect(tools.searchKnowledge('weather', '')).rejects.toThrow(RangeError);
    });

    it('should throw if either argument is missing', async () => {
      // @ts-expect-error
      await expect(tools.searchKnowledge('weather')).rejects.toThrow(TypeError);
    });
  });

  // ------------------------------------------------------------------
  // 10. getGovInfo
  // ------------------------------------------------------------------
  describe('getGovInfo', () => {
    it('should return GovInfo for a valid topic', async () => {
      mockClient.getGovInfo.mockResolvedValue(dummyGovInfo);
      const result = await tools.getGovInfo('taxes');
      expect(result.topic).toBe('taxes');
    });

    it('should throw if topic is empty string', async () => {
      await expect(tools.getGovInfo('')).rejects.toThrow(RangeError);
    });

    it('should throw if topic is missing', async () => {
      // @ts-expect-error
      await expect(tools.getGovInfo()).rejects.toThrow(TypeError);
    });

    it('should throw if topic is not a string', async () => {
      await expect(tools.getGovInfo(null as any)).rejects.toThrow(TypeError);
    });
  });

  // ------------------------------------------------------------------
  // 11. Exported instance
  // ------------------------------------------------------------------
  describe('exported instance (thaiGovtTools)', () => {
    it('should be an instance of ThaiGovtTools', () => {
      // Import the instance directly
      const { thaiGovtTools: instance } = require('../src/services/thaiGovtTools');
      expect(instance).toBeInstanceOf(ThaiGovtTools);
    });
  });
});
```
