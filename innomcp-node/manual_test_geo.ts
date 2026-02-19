
import { handleThaiGeoTool } from './src/utils/mcp/tools/thai_geo_tool';

async function runTest() {
  try {
    console.log("🧪 Starting Manual Geo Tool Test...");
    
    // Test 1: Exact Match
    console.log("\n1. Testing 'เชียงใหม่'...");
    const t1 = await handleThaiGeoTool({ query: 'เชียงใหม่' });
    if (t1.success && t1.data[0].id === 'PROV-50') {
      console.log("✅ PASS: Found Chiang Mai");
    } else {
      console.error("❌ FAIL: Chiang Mai not found", t1);
    }

    // Test 2: Region Filter
    console.log("\n2. Testing 'เหนือ' filter...");
    const t2 = await handleThaiGeoTool({ query: 'เชียงใหม่', filter_region: 'เหนือ' });
    if (t2.success && t2.data[0].attributes.region === 'เหนือ') {
      console.log("✅ PASS: Region Filter working");
    } else {
      console.error("❌ FAIL: Region Filter failed", t2);
    }
    
    // Test 3: Invalid Query
    console.log("\n3. Testing 'มั่วซั่ว'...");
    const t3 = await handleThaiGeoTool({ query: 'มั่วซั่ว' });
    if (t3.success && t3.data.length === 0) {
       console.log("✅ PASS: Invalid query handled (Empty result)");
    } else {
       console.error("❌ FAIL: Invalid query returned data", t3);
    }

    console.log("\n🏁 All Tests Completed.");
    process.exit(0);
    
  } catch (err) {
    console.error("💥 Exception:", err);
    process.exit(1);
  }
}

runTest();
