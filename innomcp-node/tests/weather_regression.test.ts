// Mock Clients
const mockCallTool = jest.fn();
const mockClient = { callTool: mockCallTool };
const clients = new Map<string, any>();
clients.set("innomcp-server", mockClient);

const wasToolCalled = (toolName: string) =>
    mockCallTool.mock.calls.some((call: any[]) => call?.[0]?.name === toolName);

describe("Weather Architecture Regression (Phase 6.5)", () => {
    let WeatherPipeline: any;
    let resolveProvinces: any;
    let pipeline: any;
    const origFixture = process.env.WEATHER_FIXTURE_W1;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        // Disable fixture priming so mocks are reachable
        delete process.env.WEATHER_FIXTURE_W1;
        
        // Dynamic import to ensure fresh module state (clears ForecastEngine cache)
        const pipelineModule = require("../src/utils/weather/weatherPipeline");
        WeatherPipeline = pipelineModule.WeatherPipeline;
        const resolverModule = require("../src/utils/locationResolver");
        resolveProvinces = resolverModule.resolveProvinces;
        // Clear any primed cache from prior tests
        const { clearWeatherToolCallCache } = require("../src/utils/weather/toolCall");
        clearWeatherToolCallCache();
        const { ToolCache } = require("../src/utils/cache/toolCache");
        ToolCache.clear();

        pipeline = new WeatherPipeline(clients);
    });

    afterAll(() => {
        // Restore env
        if (origFixture !== undefined) process.env.WEATHER_FIXTURE_W1 = origFixture;
        else delete process.env.WEATHER_FIXTURE_W1;
    });

    /**
     * Group 1: Province Resolution
     * Covers: Thai unsegmented, Multi-province, Aliases
     */
    describe("Province Resolution (LocationResolver)", () => {
        test("A) Thai unsegmented: 'พรุ่งนี้หลักสี่ฝนจะตกไหม' -> 'กรุงเทพมหานคร'", () => {
            const result = resolveProvinces("พรุ่งนี้หลักสี่ฝนจะตกไหม");
            expect(result).toContain("กรุงเทพมหานคร");
            expect(result).toHaveLength(1);
        });

        test("B) Multi-province: 'สมุทรสาคร, ศรีสะเกษ' -> 2 Unique Provinces", () => {
            const result = resolveProvinces("สมุทรสาคร, ศรีสะเกษ");
            expect(result).toContain("สมุทรสาคร");
            expect(result).toContain("ศรีสะเกษ");
            expect(result).toHaveLength(2);
        });

        test("C) Aliases & Districts", () => {
            // Short names
            expect(resolveProvinces("สุราษฯ")).toContain("สุราษฎร์ธานี");
            expect(resolveProvinces("กทม")).toContain("กรุงเทพมหานคร");
            
            // District mapping
            expect(resolveProvinces("เชียงแสน")).toContain("เชียงราย");
            expect(resolveProvinces("หาดใหญ่")).toContain("สงขลา");
        });

        test("D) Deduplication: 'กรุงเทพ และ กทม' -> Single result", () => {
            const result = resolveProvinces("กรุงเทพ และ กทม");
            expect(result).toEqual(["กรุงเทพมหานคร"]);
        });
    });

    /**
     * Group 2: Pipeline Execution & Guards
     * Covers: Fake province, Fallbacks, Mode detection
     */
    describe("Weather Pipeline Execution", () => {
        
        test("Fake Province 'เมืองทิพย์' -> PROVINCE_MISSING & NO MCP CALL", async () => {
            // 1. Resolve Target
            const target = pipeline.resolveTarget("อากาศเมืองทิพย์");
            expect(target.provinces).toHaveLength(0);

            // 2. Execute Pipeline
            const results = await pipeline.execute(target);
            
            // 3. Verify Error Structure
            expect(results).toHaveLength(1);
            expect(results[0].error).toBe("PROVINCE_MISSING");
            
            // 4. PROOF: No MCP Tool called
            expect(mockCallTool).not.toHaveBeenCalled();
        });

        test("Future Mode -> Calls Forecast Engine", async () => {
            const target = pipeline.resolveTarget("พยากรณ์อากาศกรุงเทพ 7 วัน");
            expect(target.intent.mode).toBe("week");

            // Mock Success Response for Forecast
            mockCallTool.mockResolvedValueOnce({
                content: [{ text: JSON.stringify({ Provinces: { Province: [{ ProvinceNameThai: "กรุงเทพมหานคร", ForecastDaily: [] }] } }) }]
            });

            const results = await pipeline.execute(target);
            expect(results[0].type).toBe("forecast7d");
            expect(wasToolCalled("tmd_weather_forecast_7days_by_province")).toBe(true);
        });

        test("Now Mode -> Calls Station Engine First", async () => {
            const target = pipeline.resolveTarget("ตอนนี้เชียงใหม่เป็นไง");
            expect(target.intent.mode).toBe("now");

            // Mock Success for Station
            mockCallTool.mockResolvedValueOnce({
                content: [{ text: JSON.stringify({ Stations: { Station: [{ Province: "เชียงใหม่", Temp: 25 }] } }) }]
            });

            const results = await pipeline.execute(target);
            expect(results[0].type).toBe("station3h");
            expect(wasToolCalled("tmd_weather_3hours_all_stations")).toBe(true);
        });

        /**
         * Group 3: National Query Regression (Case G)
         * New capability for Phase 6.5.1
         */
        test("G) National Query: 'ประเทศไทย' -> Fetch All Provinces (Table Format)", async () => {
            const query = "พรุ่งนี้ในไทยที่ไหนฝนตกบ้าง บอกในรูปแบบตาราง % ฝน อุณหภูมิ ความชื้น ลม";
            
            // 1. Resolve Target
            // Currently logic: resolveTarget calls resolveProvinces -> returns []
            // This test expects the pipeline (or resolver) to Handle "National" intent.
            // If resolveProvinces returns [], pipeline blocks. This test asserts valid output.
            const target = pipeline.resolveTarget(query);
            
            // Mock Forecast Response (Simulate "All 77 Provinces")
            const mockProvinces = Array.from({ length: 77 }, (_, i) => ({
                ProvinceNameThai: `จังหวัดที่${i+1}`,
                ForecastDaily: Array(7).fill({ temp: 30, rain: 20 })
            }));
            
            mockCallTool.mockResolvedValueOnce({
                content: [{ text: JSON.stringify({ Provinces: { Province: mockProvinces } }) }]
            });

            // 2. Execute Pipeline
            const results = await pipeline.execute(target);
            
            // 3. Verify Success
            // Should NOT return PROVINCE_MISSING
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].error).not.toBe("PROVINCE_MISSING");
            
            // Should Call Forecast Engine
            expect(wasToolCalled("tmd_weather_forecast_7days_by_province")).toBe(true);
            
            // Expect results to potentially cover many provinces (or formatted single result if engine changes)
            // For now, assume it returns array of results for downstream formatting.
             // If the engine logic for "National" is "Get all provinces", then results.length should be high?
             // Or maybe pipeline aggregates?
             // The requirement is "Returns a table-like payload... to mcpclient".
             // Pipeline returns WeatherResult[], mcpclient formats it.
             // So here we assert WeatherResult[] contains data for potentially many provinces.
             // But WAIT: existing logic loops over `target.provinces`.
             // If `target.provinces` is empty, it returns `PROVINCE_MISSING`.
             // So for this to pass, `target.provinces` must be empty BUT handled, OR `target.provinces` contains "Thailand" or "ALL"?
            // We assert the outcome: RESULTS, not Error.
        });

        test("H) Mixed Intent: 'รังสิตและทั่วไทย' -> Fetch Pathum Thani AND Nationwide (honest error when no data)", async () => {
            const query = "ขอมูลสภาพอากาศรังสิต และสรุปภาพรวมทั่วไทยแบบตาราง"; // Contains "รังสิต" (Rangsit) and "ทั่วไทย" (Nationwide)
            
            // 1. Resolve Target
            const target = pipeline.resolveTarget(query);
            
            // Verify Provinces: Should contain 'ปทุมธานี' AND 'ALL_THAILAND'
            expect(target.provinces).toContain("ปทุมธานี");
            
            // Mock Responses
            // Execution Order for "table" mode: Station -> Forecast -> NWP
            
            // 1. Station Engine (Pathum Thani) -> Fail/Empty
            // Mocking executeWeatherToolCall to return the parsed payload directly
            mockCallTool.mockResolvedValueOnce({ Stations: { Station: [] } });

            // 2. Forecast Engine (Pathum Thani) -> Success
            mockCallTool.mockResolvedValueOnce({ 
                Provinces: { Province: [{ ProvinceNameThai: "ปทุมธานี", ForecastDaily: [] }] } 
            });

            // 3. Nationwide (ALL_THAILAND) -> Nationwide Execution -> ForecastEngine.getAllForecasts
            // Mock returns provinces but WITHOUT forecast data → nationwide should return honest error
            const mockNational = { Provinces: { Province: Array.from({ length: 5 }, (_, i) => ({ ProvinceNameThai: `P${i}` })) } };
            mockCallTool.mockResolvedValueOnce(mockNational);

            // 2. Execute Pipeline
            const results = await pipeline.execute(target);
            
            // 3. Verify Results
            expect(results.length).toBeGreaterThanOrEqual(2); // At least Pathum + National error
            
            const pathumResult = results.find((r: any) => r.province === "ปทุมธานี");
            // Weather truth contract: nationwide with no real forecast data → honest error, not fake rankings
            const nationalResult = results.find((r: any) => r.province === "ทั่วประเทศ");
            
            expect(pathumResult).toBeDefined();
            expect(pathumResult.type).not.toBe("error");
            
            expect(nationalResult).toBeDefined();
            expect(nationalResult.type).toBe("error");
            expect(nationalResult.error).toBe("NATIONAL_DATA_UNAVAILABLE");
        });
    });
});
