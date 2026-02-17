
import { resolveProvinces } from "./src/utils/locationResolver";
import { WeatherPipeline } from "./src/utils/weather/weatherPipeline";
import dotenv from "dotenv";

dotenv.config();

async function runTest() {
    const query = "รังสิตฝนตกไหม  ที่ไหนฝนตกบ้างในประเทศไทยวันนี้ และสัปดาห์นี้ จงแสดงในรูปแบบตาราง";
    console.log(`\n🔎 Testing Query: "${query}"`);

    try {
        // 1. Test Location Resolution
        console.log("1. Resolving Location...");
        const startLoc = Date.now();
        const locations = await resolveProvinces(query);
        console.log(`   Result: ${JSON.stringify(locations)} (${Date.now() - startLoc}ms)`);

        // 2. Test Weather Pipeline (Logic only, mocking MCP if needed or rely on real if configured)
        // Note: WeatherPipeline usually calls MCP tools. If we run this isolated, we might see where it breaks.
        console.log("2. Running WeatherPipeline...");
        const pipeline = new WeatherPipeline();
        
        // Mock dependencies or context if required, but let's try raw first
        // complex queries usually hit "nationwide" or "multi-province" logic.
        
        // This query has "Rangsit" (needs resolution) AND "Thailand" (National).
        // It's a mixed intent.
        
        // Let's see how resolver handles "Rangsit".
        
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

runTest();
