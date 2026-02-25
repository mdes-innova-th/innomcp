import fs from "fs";
import path from "path";

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function assertTrue(cond: any, label: string, failures: string[]) {
  if (!cond) failures.push(label);
}

function assertIncludes(hay: string, needle: string, label: string, failures: string[]) {
  if (!String(hay || "").includes(needle)) failures.push(`${label}: missing ${JSON.stringify(needle)}`);
}

async function main() {
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  process.env.SMOKE_MODE = "1";
  process.env.LOG_MODE = process.env.LOG_MODE || "test";
  process.env.WEATHER_FIXTURE_W1 = "1";

  const evidenceDir = path.resolve(__dirname, "..", "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidenceFile = path.join(evidenceDir, `phase86_1-weather-nwp-guard-${stamp()}.log`);

  const logLines: string[] = [];
  const failures: string[] = [];

  const { WeatherPipeline } = await import("../src/utils/weather/weatherPipeline");
  const { renderWeatherContractAnswer } = await import("../src/utils/weather/answerContract");

  // Use a dummy MCP client to guarantee verifier is zero-network.
  const dummyClients = new Map<string, any>([
    [
      "innomcp-server",
      {
        callTool: async () => {
          throw new Error("Verifier must not call MCP tools");
        },
      },
    ],
  ]);

  // --- Case 1: resolver has no province -> ERR:WX_PROVINCE_MISSING ---
  try {
    const p = new WeatherPipeline(dummyClients);
    const target = p.resolveTarget("พรุ่งนี้ฝนตกไหม");

    const results = await p.execute(target);
    const out = renderWeatherContractAnswer(target.originalText, results).text;

    logLines.push(`C1.provinces=${JSON.stringify(target.provinces)}`);
    logLines.push(`C1.out=${JSON.stringify(String(out).slice(0, 220))}`);

    // Spec: PROVINCE_MISSING -> deterministic token
    assertIncludes(out, "ERR:WX_PROVINCE_MISSING", "C1", failures);
  } catch (err: any) {
    failures.push(`C1: unexpected error: ${String(err?.message || err)}`);
  }

  // --- Case 2: ForecastEngine throws PROVINCE_NOT_FOUND_IN_FORECAST -> stop chain (no NWP) ---
  try {
    const p = new WeatherPipeline(dummyClients);

    let nwpCalls = 0;
    let stationCalls = 0;

    // Monkey-patch per-instance engines (best-effort, deterministic)
    (p as any).forecastEngine.getForecast = async (province: string) => {
      return { province, type: "error", error: "PROVINCE_NOT_FOUND_IN_FORECAST" };
    };

    (p as any).stationEngine.getStationData = async (province: string) => {
      stationCalls++;
      return { province, type: "error", error: "STATION_SHOULD_NOT_RUN" };
    };

    (p as any).nwpEngine.getNwpData = async (province: string) => {
      nwpCalls++;
      return { province, type: "error", error: "NWP_SHOULD_NOT_RUN" };
    };

    const target = {
      provinces: ["เชียงใหม่"],
      intent: { mode: "future" as const, national: false },
      originalText: "พรุ่งนี้เชียงใหม่ฝนตกไหม",
    };

    const results = await p.execute(target as any);
    const out = renderWeatherContractAnswer(target.originalText, results).text;

    logLines.push(`C2.nwpCalls=${nwpCalls} stationCalls=${stationCalls}`);
    logLines.push(`C2.results0=${JSON.stringify(results?.[0] || null)}`);
    logLines.push(`C2.out=${JSON.stringify(String(out).slice(0, 220))}`);

    assertIncludes(out, "ERR:WX_NO_DATA", "C2", failures);
    assertTrue(nwpCalls === 0, `C2: expected nwpCalls=0 actual=${nwpCalls}`, failures);
    assertTrue(stationCalls === 0, `C2: expected stationCalls=0 actual=${stationCalls}`, failures);
  } catch (err: any) {
    failures.push(`C2: unexpected error: ${String(err?.message || err)}`);
  }

  const ok = failures.length === 0;
  logLines.push(ok ? "RESULT: PASS" : "RESULT: FAIL");
  if (!ok) logLines.push("FAILURES:\n" + failures.join("\n"));

  fs.writeFileSync(evidenceFile, logLines.join("\n") + "\n", "utf8");

  if (ok) {
    console.log("RESULT: PASS");
    console.log(`evidenceFile=${evidenceFile}`);
    return;
  }

  console.error("RESULT: FAIL");
  console.error(failures.join("\n"));
  console.error(`evidenceFile=${evidenceFile}`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exitCode = 1;
});
