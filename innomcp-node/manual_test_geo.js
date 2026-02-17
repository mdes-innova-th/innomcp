
const { handleThaiGeoTool } = require('./dist/utils/mcp/tools/thai_geo_tool');

async function runTest() {
  try {
    console.log("🧪 Starting Manual Geo Tool Test (JS) - Phase 2...");
    
    // Test 1: Exact Match & Strict Output
    console.log("\n1. Testing 'เชียงใหม่' (Expect strict output)...");
    const t1 = await handleThaiGeoTool({ query: 'เชียงใหม่' });
    
    if (t1.success && t1.data[0].provinces_id === 'PROV-50' && t1.data[0].lat && t1.data[0].lon) {
      console.log("✅ PASS: Found Chiang Mai with strict output (provinces_id, lat, lon)");
      console.log("Sample Data: " + JSON.stringify(t1.data[0]).substring(0, 100) + "...");
    } else {
      console.error("❌ FAIL: Chiang Mai check failed", JSON.stringify(t1, null, 2));
    }

    // Test 2: Region Filter (North -> ภาคเหนือ)
    console.log("\n2. Testing 'North' filter (Map to ภาคเหนือ)...");
    const t2 = await handleThaiGeoTool({ query: 'เชียงใหม่', filter_region: 'North' });
    // Note: Region name in DB might be "เหนือ" or "ภาคเหนือ" depending on seed. 
    // The Tool ensures the query uses the right term if we mapped it correctly or if it matches LIKE.
    // We check if we got results and the region contains 'เหนือ'.
    const regionValid = t2.success && t2.data.length > 0 && t2.data[0].region && t2.data[0].region.includes('เหนือ');
    
    if (regionValid) {
      console.log(`✅ PASS: Region Filter working (Got: ${t2.data[0].region})`);
    } else {
      console.error("❌ FAIL: Region Filter failed", JSON.stringify(t2, null, 2));
    }
    
    // Test 3: Unknown Province (Graceful Error)
    console.log("\n3. Testing 'เมืองทิพย์' (Expect Graceful Failure)...");
    const t3 = await handleThaiGeoTool({ query: 'เมืองทิพย์' });
    if (t3.success === false && t3.message && t3.message.includes('ไม่พบช้อมูล') || t3.message.includes('ไม่พบข้อมูล')) {
       console.log("✅ PASS: Graceful error handled");
       console.log("Message: " + t3.message);
    } else {
       console.error("❌ FAIL: Unexpected response for unknown province", JSON.stringify(t3, null, 2));
    }

    console.log("\n🏁 All Tests Completed.");
    process.exit(0);
    
  } catch (err) {
    console.error("💥 Exception:", err);
    process.exit(1);
  }
}

runTest();
