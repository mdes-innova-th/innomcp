/* eslint-disable no-console */
import fs from "fs";
import path from "path";

interface CheckResult {
  name: string;
  pass: boolean;
  reason?: string;
}

function checkIncludes(content: string, token: string, name: string): CheckResult {
  const pass = content.includes(token);
  return { name, pass, reason: pass ? undefined : `missing token: ${token}` };
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const chatPath = path.join(repoRoot, "src", "routes", "api", "chat.ts");

  const chatContent = fs.readFileSync(chatPath, "utf8");
  const checks: CheckResult[] = [
    checkIncludes(chatContent, "godTierConfidence < 0.6", "LOW_CONF_THRESHOLD"),
    checkIncludes(chatContent, "godTierFallbackUsed", "FALLBACK_FLAG"),
    checkIncludes(chatContent, "Low Confidence", "LOW_CONF_MESSAGE"),
    checkIncludes(chatContent, "toolsUsed: []", "NO_TOOLS_USED"),
    checkIncludes(chatContent, "sendDoneOnce()", "WS_DONE_SIGNAL"),
  ];

  const passCount = checks.filter((item) => item.pass).length;
  const failCount = checks.length - passCount;

  for (const check of checks) {
    console.log(`${check.pass ? "✅" : "❌"} ${check.name}${check.pass ? "" : ` -> ${check.reason}`}`);
  }

  console.log(`\nSummary: total=${checks.length} pass=${passCount} fail=${failCount}`);
  if (failCount > 0) {
    console.log("RESULT: FAIL");
    process.exit(1);
  }

  console.log("RESULT: PASS");
}

main();
