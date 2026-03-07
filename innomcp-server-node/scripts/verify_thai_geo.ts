
import { thaiGeoTool } from "../src/mcp/tools/thaiGeoTool";

async function verify() {
  console.log("🔍 Verifying Thai Geo Tool...");
  
  // Test 1: Search Chiang Mai (Expect Success)
  console.log("\n--- Test 1: Search 'เชียงใหม่' ---");
  try {
    const result1 = await thaiGeoTool.execute({ query: "เชียงใหม่" });
    const json1 = JSON.parse(result1.content[0].text);
    console.log("Success:", json1.success);
    if (json1.success && json1.data?.[0]?.name_th?.includes("เชียงใหม่")) {
        console.log("✅ Data matched:", json1.data[0].attributes);
    } else {
        console.error("❌ Failed:", json1);
    }
  } catch (e) { console.error(e); }
  
  // Test 2: Search Khon Kaen with Region Filter
  console.log("\n--- Test 2: Search 'ขอนแก่น' (Filter: อีสาน) ---");
  try {
    const result2 = await thaiGeoTool.execute({ query: "ขอนแก่น", filter_region: "อีสาน" });
    const json2 = JSON.parse(result2.content[0].text);
    console.log("Success:", json2.success);
    if (json2.success) console.log("✅ Data matched:", json2.data[0].attributes);
  } catch (e) { console.error(e); }

  // Test 3: Search Unknown
  console.log("\n--- Test 3: Search 'BlaBla' ---");
  try {
    const result3 = await thaiGeoTool.execute({ query: "BlaBla" });
    const json3 = JSON.parse(result3.content[0].text);
    console.log("Success:", json3.success); // Should be false
    if (!json3.success) console.log("✅ Correctly returned failure");
  } catch (e) { console.error(e); }

  // Test 4: confidence gate
  console.log("\n--- Test 4: Search 'เชียงใหม่' with confidence_required=0.99 ---");
  try {
    const result4 = await thaiGeoTool.execute({ query: "เชียงใหม่", context: { confidence_required: 0.99 } });
    const json4 = JSON.parse(result4.content[0].text);
    console.log("Success:", json4.success);
    if (!json4.success) console.log("✅ Correctly rejected low confidence");
  } catch (e) { console.error(e); }
  
  process.exit(0);
}

verify().catch((err) => {
    console.error(err);
    process.exit(1);
});
