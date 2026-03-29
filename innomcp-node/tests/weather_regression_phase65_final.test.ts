export {};

// Mock Clients
const mockCallTool = jest.fn();
const mockClient = { callTool: mockCallTool };
const clients = new Map<string, any>();
clients.set("innomcp-server", mockClient);

const wasToolCalled = (toolName: string) =>
    mockCallTool.mock.calls.some((call: any[]) => call?.[0]?.name === toolName);

describe("Weather Phase 6.5 Finalization (Nationwide & Negative)", () => {
    let WeatherPipeline: any;
    let resolveProvinces: any;
    let pipeline: any;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        
        const pipelineModule = require("../src/utils/weather/weatherPipeline");
        WeatherPipeline = pipelineModule.WeatherPipeline;
        const resolverModule = require("../src/utils/locationResolver");
        resolveProvinces = resolverModule.resolveProvinces;

        pipeline = new WeatherPipeline(clients);
    });

    /**
     * EXPERIMENT A: Nationwide "Tomorrow" (Table)
     * Query: "พรุ่งนี้ในไทยที่ไหนฝนตกบ้าง บอกเป็นตาราง"
     * Expectations:
     * - NOT PROVINCE_MISSING
     * - Calls ForecastEngine (7 days)
     * - Returns structured tableMarkdown
     */
    test("A) Nationwide Tomorrow: 'พรุ่งนี้ในไทย...ตาราง' -> Table Output", async () => {
        const query = "พรุ่งนี้ในไทยที่ไหนฝนตกบ้าง บอกเป็นตาราง";
        
        // 1. Resolve Target
        const target = pipeline.resolveTarget(query);
        // Expect "ALL_THAILAND" or empty provinces but handled by pipeline as Nationwide
        // Current logic might return empty provinces array if "ไทย" is removed/ignored or treated as stopword?
        // Let's see what pipeline does. If resolvedProvinces returns [], pipeline checks for "Thailand" keyword?
        
        // 2. Mock Forecast Response (Simulate "All 77 Provinces")
        // We need a payload that ForecastEngine accepts
        const mockProvinces = Array.from({ length: 5 }, (_, i) => ({
            ProvinceNameThai: `จังหวัดทดสอบ${i+1}`,
            ForecastDaily: [
                { Date: "2026-02-17", Rain60: 10, TempMax: 35, TempMin: 25, WindDir: "SW", WindSpeed: 10, DescTh: "ฝนเล็กน้อย" }, // Match target date
                { Date: "2026-02-18", Rain60: 20 },
            ]
        }));
        
        mockCallTool.mockResolvedValueOnce({
            Provinces: { Province: mockProvinces }
        });

        // 3. Execute
        const results = await pipeline.execute(target);
        
        // 4. Assert
        expect(results.length).toBe(1);
        expect(results[0].error).toBeUndefined();
        expect(results[0].type).toBe("national");
        expect(results[0].data.tableMarkdown).toMatch(/\| จังหวัด \| %ฝน \|/); // Check for table header
        expect(results[0].data.rows.length).toBeGreaterThan(0);
        
        // Verify Tool Call
        expect(wasToolCalled("tmd_weather_forecast_7days_by_province")).toBe(true);
    });

    /**
     * EXPERIMENT B: Nationwide "Today" (No Gate)
     * Query: "วันนี้ในไทยที่ไหนฝนตกบ้าง"
     * Expectations:
     * - Mode = now/today
     * - No province gate blocking execution
     */
    test("B) Nationwide Today: 'วันนี้ในไทย...' -> exec without PROVINCE_MISSING", async () => {
        const query = "วันนี้ในไทยที่ไหนฝนตกบ้าง";
        const target = pipeline.resolveTarget(query);
        
        // Mock Response (Forecast Engine for 'today')
        // Only need one mock since 'today' usually falls back to Forecast if Station fails or direct Forecast?
        // WeatherPipeline logic for 'today': Forecast -> Station -> NWP ? Or just Forecast?
        // Let's assume Forecast for Nationwide "Today".
        
         const mockProvinces = Array.from({ length: 5 }, (_, i) => ({
            ProvinceNameThai: `จ.วันนี้${i+1}`,
            ForecastDaily: [
                { Date: new Date().toISOString().split('T')[0], Rain60: 50, TempMax: 33, TempMin: 24, DescTh: "ฝนตกหนัก" }
            ]
        }));

        mockCallTool.mockResolvedValueOnce({
            Provinces: { Province: mockProvinces }
        });

        const results = await pipeline.execute(target);

        expect(results[0].error).toBeUndefined();
        expect(results[0].type).toBe("national"); // Should default to national if query implies it
    });

    /**
     * EXPERIMENT C: Negative Test
     * Query: "สภาพอากาศเมืองทิพย์"
     * Expectations:
     * - PROVINCE_MISSING
     * - NO Tool Calls
     */
    test("C) Negative: 'เมืองทิพย์' -> PROVINCE_MISSING", async () => {
        const query = "สภาพอากาศเมืองทิพย์"; // Fake city
        const target = pipeline.resolveTarget(query);
        
        // Ensure resolver didn't find anything
        expect(target.provinces).toHaveLength(0);

        const results = await pipeline.execute(target);
        
        expect(results[0].error).toBe("PROVINCE_MISSING");
        expect(mockCallTool).not.toHaveBeenCalled();
    });
});
