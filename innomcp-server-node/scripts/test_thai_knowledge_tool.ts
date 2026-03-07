import "dotenv/config";
import { thaiKnowledgeTool } from "../src/mcp/tools/thaiKnowledgeTool";

async function runTests() {
  console.log("🧪 Testing thaiKnowledgeTool...");

  console.log("\n--- Test 1: Valid Query (High Confidence) ---");
  const result1 = await thaiKnowledgeTool.execute({
    query: "กรุงเทพ",
    context: { confidence_required: 0.6 }
  });
  console.log("Result 1:", JSON.stringify(result1, null, 2));

  const text1 = JSON.parse(result1.content[0].text);
  if (text1.success !== true) {
      console.error("❌ Test 1 failed: Expected success=true");
      process.exit(1);
  }

  console.log("\n--- Test 2: Invalid Query / Gibberish (Low Confidence) ---");
  const result2 = await thaiKnowledgeTool.execute({
    query: "asdkfjlasdkfj",
    context: { confidence_required: 0.6 }
  });
  console.log("Result 2:", JSON.stringify(result2, null, 2));
  
  const text2 = JSON.parse(result2.content[0].text);
  if (text2.success !== false) {
      console.error("❌ Test 2 failed: Expected success=false for gibberish");
      process.exit(1);
  }
  if (text2.error_code !== "LOW_CONFIDENCE" && text2.error_code !== "NOT_FOUND") {
      console.error(`❌ Test 2 failed: Expected error_code=LOW_CONFIDENCE or NOT_FOUND, got ${text2.error_code}`);
      process.exit(1);
  }
  
  console.log("\n✅ All tests passed.");
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
