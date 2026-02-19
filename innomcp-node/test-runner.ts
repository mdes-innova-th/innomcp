// innomcp-node/test-runner.ts
import { execSync } from "child_process";

function runBasicTests() {
  try {
    console.log("🧪 Running BASIC smoke tests...");
    // ตัวอย่าง: รัน jest หรือ vitest ถ้ามี
    execSync("npm run test:basic", { stdio: "inherit" });
    console.log("✅ BASIC tests passed!");
  } catch (err) {
    console.error("❌ BASIC tests failed!");
    process.exit(1);
  }
}

// main entry
if (require.main === module) {
  runBasicTests();
}