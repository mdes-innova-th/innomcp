<!-- cc-team deliverable
 group: G2 (Generate jest unit tests for untested innomcp-node modules (batch 2))
 member: T026 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":2054,"completion_tokens":3512,"total_tokens":5566,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1502,"image_tokens":0},"cache_creation_input_tokens":0} | 25s
 generated: 2026-06-13T10:55:59.479Z -->
```typescript
import { ThaiGovtTools, thaiGovtTools } from '../src/services/thaiGovtTools';

describe('ThaiGovtTools', () => {
  let mockClient: { callTool: jest.Mock };
  let tools: ThaiGovtTools;

  beforeEach(() => {
    mockClient = { callTool: jest.fn() };
    tools = new ThaiGovtTools(mockClient);
  });

  // -----------------------------------------------------------------------
  // Weather & Disaster
  // -----------------------------------------------------------------------

  describe('getWeatherReport', () => {
    it('should call tmd.weather_report with default province', async () => {
      const expected: any = { province: 'กรุงเทพมหานคร', temperature: 30 };
      mockClient.callTool.mockResolvedValue(expected);
      const result = await tools.getWeatherReport();
      expect(mockClient.callTool).toHaveBeenCalledWith('tmd.weather_report', {
        province: 'กรุงเทพมหานคร',
      });
      expect(result).toEqual(expected);
    });

    it('should call tmd.weather_report with provided province', async () => {
      const expected: any = { province: 'Chiang Mai', temperature: 25 };
      mockClient.callTool.mockResolvedValue(expected);
      const result = await tools.getWeatherReport('Chiang Mai');
      expect(mockClient.callTool).toHaveBeenCalledWith('tmd.weather_report', {
        province: 'Chiang Mai',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('getDisasterAlerts', () => {
    it('should call tmd.disaster_alerts and return array', async () => {
      const expected: any[] = [{ id: '1', type: 'flood' }];
      mockClient.callTool.mockResolvedValue(expected);
      const result = await tools.getDisasterAlerts();
      expect(mockClient.callTool).toHaveBeenCalledWith('tmd.disaster_alerts', {});
      expect(result).toEqual(expected);
    });
  });

  describe('getWeatherForecast', () => {
    it('should call tmd.weather_forecast with valid days', async () => {
      const expected: any[] = [{ date: '2025-01-01', maxTemp: 30 }];
      mockClient.callTool.mockResolvedValue(expected);
      const result = await tools.getWeatherForecast('Bangkok', 7);
      expect(mockClient.callTool).toHaveBeenCalledWith('tmd.weather_forecast', {
        province: 'Bangkok',
        days: 7,
      });
      expect(result).toEqual(expected);
    });

    it('should use default days=7 when not provided', async () => {
      mockClient.callTool.mockResolvedValue([]);
      await tools.getWeatherForecast('Bangkok');
      expect(mockClient.callTool).toHaveBeenCalledWith('tmd.weather_forecast', {
        province: 'Bangkok',
        days: 7,
      });
    });

    it('should throw error if days < 1', async () => {
      await expect(tools.getWeatherForecast('Bangkok', 0)).rejects.toThrow(
        'Forecast days must be between 1 and 14'
      );
    });

    it('should throw error if days > 14', async () => {
      await expect(tools.getWeatherForecast('Bangkok', 15)).rejects.toThrow(
        'Forecast days must be between 1 and 14'
      );
    });
  });

  // -----------------------------------------------------------------------
  // Geographic Data
  // -----------------------------------------------------------------------

  describe('getProvinceInfo', () => {
    it('should call geo.province_info with name', async () => {
      const expected: any = { name: 'Bangkok', nameTh: 'กรุงเทพมหานคร' };
      mockClient.callTool.mockResolvedValue(expected);
      const result = await tools.getProvinceInfo('Bangkok');
      expect(mockClient.callTool).toHaveBeenCalledWith('geo.province_info', {
        name: 'Bangkok',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('findNearest', () => {
    it('should call geo.find_nearest with lat, lon and type', async () => {
      const expected: any[] = [{ name: 'Hospital A', type: 'hospital' }];
      mockClient.callTool.mockResolvedValue(expected);
      const result = await tools.findNearest(13.7, 100.5, 'hospital');
      expect(mockClient.callTool).toHaveBeenCalledWith('geo.find_nearest', {
        lat: 13.7,
        lon: 100.5,
        type: 'hospital',
      });
      expect(result).toEqual(expected);
    });

    it('should use default type "all" when not provided', async () => {
      mockClient.callTool.mockResolvedValue([]);
      await tools.findNearest(13.7, 100.5);
      expect(mockClient.callTool).toHaveBeenCalledWith('geo.find_nearest', {
        lat: 13.7,
        lon: 100.5,
        type: 'all',
      });
    });
  });

  describe('searchLocation', () => {
    it('should call geo.search_location with query', async () => {
      const expected: any[] = [{ name: 'Wat Pho', type: 'temple' }];
      mockClient.callTool.mockResolvedValue(expected);
      const result = await tools.searchLocation('Wat Pho');
      expect(mockClient.callTool).toHaveBeenCalledWith('geo.search_location', {
        query: 'Wat Pho',
      });
      expect(result).toEqual(expected);
    });
  });

  // -----------------------------------------------------------------------
  // Evidence & Statistics
  // -----------------------------------------------------------------------

  describe('searchEvidence', () => {
    it('should call evidence.search with query and limit', async () => {
      const expected: any[] = [{ id: '1', title: 'Evidence1' }];
      mockClient.callTool.mockResolvedValue(expected);
      const result = await tools.searchEvidence('crime', 5);
      expect(mockClient.callTool).toHaveBeenCalledWith('evidence.search', {
        query: 'crime',
        limit: 5,
      });
      expect(result).toEqual(expected);
    });

    it('should use default limit=10 when not provided', async () => {
      mockClient.callTool.mockResolvedValue([]);
      await tools.searchEvidence('test');
      expect(mockClient.callTool).toHaveBeenCalledWith('evidence.search', {
        query: 'test',
        limit: 10,
      });
    });

    it('should throw error if limit < 1', async () => {
      await expect(tools.searchEvidence('test', 0)).rejects.toThrow(
        'Limit must be between 1 and 100'
      );
    });

    it('should throw error if limit > 100', async () => {
      await expect(tools.searchEvidence('test', 101)).rejects.toThrow(
        'Limit must be between 1 and 100'
      );
    });
  });

  describe('getDataStats', () => {
    it('should call evidence.data_stats with category', async () => {
      const expected: any = { category: 'crime', totalCount: 50 };
      mockClient.callTool.mockResolvedValue(expected);
      const result = await tools.getDataStats('crime');
      expect(mockClient.callTool).toHaveBeenCalledWith('evidence.data_stats', {
        category: 'crime',
      });
      expect(result).toEqual(expected);
    });
  });

  // -----------------------------------------------------------------------
  // Knowledge Base
  // -----------------------------------------------------------------------

  describe('searchKnowledge', () => {
    it('should call knowledge.search with query and language', async () => {
      const expected: any[] = [{ id: '1', title: 'กฎหมาย' }];
      mockClient.callTool.mockResolvedValue(expected);
      const result = await tools.searchKnowledge('กฎหมาย', 'th');
      expect(mockClient.callTool).toHaveBeenCalledWith('knowledge.search', {
        query: 'กฎหมาย',
        language: 'th',
      });
      expect(result).toEqual(expected);
    });

    it('should use default language "th" when not provided', async () => {
      mockClient.callTool.mockResolvedValue([]);
      await tools.searchKnowledge('law');
      expect(mockClient.callTool).toHaveBeenCalledWith('knowledge.search', {
        query: 'law',
        language: 'th',
      });
    });
  });

  describe('getGovInfo', () => {
    it('should call knowledge.gov_info with topic', async () => {
      const expected: any = { topic: 'tax', description: 'Tax info' };
      mockClient.callTool.mockResolvedValue(expected);
      const result = await tools.getGovInfo('tax');
      expect(mockClient.callTool).toHaveBeenCalledWith('knowledge.gov_info', {
        topic: 'tax',
      });
      expect(result).toEqual(expected);
    });
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('thaiGovtTools singleton', () => {
    it('should be an instance of ThaiGovtTools', () => {
      expect(thaiGovtTools).toBeInstanceOf(ThaiGovtTools);
    });
  });
});
```
