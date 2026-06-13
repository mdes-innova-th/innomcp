<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-021 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2317,"completion_tokens":6084,"total_tokens":8401,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4064,"image_tokens":0},"cache_creation_input_tokens":0} | 53s
 generated: 2026-06-13T11:45:02.834Z -->
FILE: innomcp-node/src/services/thaiGovtTools.ts
<<<<<<< SEARCH
class ThaiGovtTools {
  constructor(private client: IMcpClient = mcpClient) {}

  // -----------------------------------------------------------------------
  // Weather & Disaster (TMD/NWP)
  // -----------------------------------------------------------------------
=======
class ThaiGovtTools {
  constructor(private client: IMcpClient = mcpClient) {}

  // Authentication check
  private checkAuth(): void {
    const apiKey = process.env.MCP_API_KEY;
    if (!apiKey || apiKey.length < 16) {
      throw new Error('Unauthorized: valid MCP_API_KEY required');
    }
  }

  // Input sanitization for prompt injection prevention
  private sanitizeInput(input: string): string {
    let sanitized = input.trim();
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200);
    }
    sanitized = sanitized
      .replace(/[{}]/g, '')
      .replace(/ignore\s+previous/gi, '')
      .replace(/system\s*prompt/gi, '')
      .replace(/<\|.*?\|>/g, '')
      .replace(/\b(output|print)\s+(this|the)\s+(prompt|instruction)/gi, '');
    return sanitized;
  }

  // -----------------------------------------------------------------------
  // Weather & Disaster (TMD/NWP)
  // -----------------------------------------------------------------------
>>>>>>> REPLACE

FILE: innomcp-node/src/services/thaiGovtTools.ts
<<<<<<< SEARCH
  async getWeatherReport(province?: string): Promise<WeatherReport> {
    const result = await this.client.callTool('tmd.weather_report', {
      province: province ?? 'กรุงเทพมหานคร', // default Bangkok
    });
    return result as WeatherReport;
  }
=======
  async getWeatherReport(province?: string): Promise<WeatherReport> {
    this.checkAuth();
    const safeProvince = this.sanitizeInput(province ?? 'กรุงเทพมหานคร');
    const result = await this.client.callTool('tmd.weather_report', {
      province: safeProvince,
    });
    return result as WeatherReport;
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/thaiGovtTools.ts
<<<<<<< SEARCH
  async getDisasterAlerts(): Promise<DisasterAlert[]> {
    const result = await this.client.callTool('tmd.disaster_alerts', {});
    // The MCP tool returns an array, cast appropriately
    return result as DisasterAlert[];
  }
=======
  async getDisasterAlerts(): Promise<DisasterAlert[]> {
    this.checkAuth();
    const result = await this.client.callTool('tmd.disaster_alerts', {});
    // The MCP tool returns an array, cast appropriately
    return result as DisasterAlert[];
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/thaiGovtTools.ts
<<<<<<< SEARCH
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
=======
  async getWeatherForecast(
    province: string,
    days: number = 7
  ): Promise<ForecastDay[]> {
    this.checkAuth();
    if (days < 1 || days > 14) {
      throw new Error('Forecast days must be between 1 and 14');
    }
    const safeProvince = this.sanitizeInput(province);
    const result = await this.client.callTool('tmd.weather_forecast', {
      province: safeProvince,
      days,
    });
    return result as ForecastDay[];
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/thaiGovtTools.ts
<<<<<<< SEARCH
  async getProvinceInfo(name: string): Promise<ProvinceInfo> {
    const result = await this.client.callTool('geo.province_info', { name });
    return result as ProvinceInfo;
  }
=======
  async getProvinceInfo(name: string): Promise<ProvinceInfo> {
    this.checkAuth();
    const safeName = this.sanitizeInput(name);
    const result = await this.client.callTool('geo.province_info', { name: safeName });
    return result as ProvinceInfo;
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/thaiGovtTools.ts
<<<<<<< SEARCH
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
=======
  async findNearest(
    lat: number,
    lon: number,
    type?: string
  ): Promise<GeoPoint[]> {
    this.checkAuth();
    const safeType = type ? this.sanitizeInput(type) : 'all';
    const result = await this.client.callTool('geo.find_nearest', {
      lat,
      lon,
      type: safeType,
    });
    return result as GeoPoint[];
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/thaiGovtTools.ts
<<<<<<< SEARCH
  async searchLocation(query: string): Promise<GeoPoint[]> {
    const result = await this.client.callTool('geo.search_location', { query });
    return result as GeoPoint[];
  }
=======
  async searchLocation(query: string): Promise<GeoPoint[]> {
    this.checkAuth();
    const safeQuery = this.sanitizeInput(query);
    const result = await this.client.callTool('geo.search_location', { query: safeQuery });
    return result as GeoPoint[];
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/thaiGovtTools.ts
<<<<<<< SEARCH
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
=======
  async searchEvidence(query: string, limit: number = 10): Promise<Evidence[]> {
    this.checkAuth();
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }
    const safeQuery = this.sanitizeInput(query);
    const result = await this.client.callTool('evidence.search', {
      query: safeQuery,
      limit,
    });
    return result as Evidence[];
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/thaiGovtTools.ts
<<<<<<< SEARCH
  async getDataStats(category: string): Promise<DataStats> {
    const result = await this.client.callTool('evidence.data_stats', {
      category,
    });
    return result as DataStats;
  }
=======
  async getDataStats(category: string): Promise<DataStats> {
    this.checkAuth();
    const safeCategory = this.sanitizeInput(category);
    const result = await this.client.callTool('evidence.data_stats', {
      category: safeCategory,
    });
    return result as DataStats;
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/thaiGovtTools.ts
<<<<<<< SEARCH
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
=======
  async searchKnowledge(
    query: string,
    language: 'th' | 'en' = 'th'
  ): Promise<KnowledgeItem[]> {
    this.checkAuth();
    const safeQuery = this.sanitizeInput(query);
    const result = await this.client.callTool('knowledge.search', {
      query: safeQuery,
      language,
    });
    return result as KnowledgeItem[];
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/thaiGovtTools.ts
<<<<<<< SEARCH
  async getGovInfo(topic: string): Promise<GovInfo> {
    const result = await this.client.callTool('knowledge.gov_info', { topic });
    return result as GovInfo;
  }
=======
  async getGovInfo(topic: string): Promise<GovInfo> {
    this.checkAuth();
    const safeTopic = this.sanitizeInput(topic);
    const result = await this.client.callTool('knowledge.gov_info', { topic: safeTopic });
    return result as GovInfo;
  }
>>>>>>> REPLACE
