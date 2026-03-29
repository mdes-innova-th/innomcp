// Mock engines so WeatherPipeline ordering can be verified without MCP.

const stationCalls: string[] = [];
const forecastCalls: string[] = [];
const nwpCalls: string[] = [];

jest.mock("../../../src/utils/weather/engines/stationEngine", () => {
  return {
    StationEngine: class StationEngine {
      async getStationData(province: string) {
        stationCalls.push(province);
        return { province, type: "error", error: "STATION_NOT_FOUND" };
      }
    }
  };
});

jest.mock("../../../src/utils/weather/engines/forecastEngine", () => {
  return {
    ForecastEngine: class ForecastEngine {
      async getForecast(province: string) {
        forecastCalls.push(province);
        return { province, type: "forecast7d", data: { ok: true }, sourceTool: "tmd_weather_forecast_7days_by_province" };
      }
    }
  };
});

jest.mock("../../../src/utils/weather/engines/nwpEngine", () => {
  return {
    NwpEngine: class NwpEngine {
      async getNwpData(province: string) {
        nwpCalls.push(province);
        return { province, type: "nwp", data: { ok: true }, sourceTool: "nwp_daily_by_place" };
      }
    }
  };
});

import { WeatherPipeline } from "../../../src/utils/weather/weatherPipeline";

describe("Phase 6.5 WeatherPipeline", () => {
  beforeEach(() => {
    stationCalls.length = 0;
    forecastCalls.length = 0;
    nwpCalls.length = 0;
  });

  it("PROVINCE_MISSING returns error without engine calls", async () => {
    const pipeline = new WeatherPipeline(new Map());
    const res = await pipeline.execute({ provinces: [], intent: { mode: "today" }, originalText: "" });
    expect(res[0].error).toBe("PROVINCE_MISSING");
    expect(stationCalls.length).toBe(0);
    expect(forecastCalls.length).toBe(0);
    expect(nwpCalls.length).toBe(0);
  });

  it("mode=now uses Station -> Forecast and stops after success", async () => {
    const pipeline = new WeatherPipeline(new Map());
    const res = await pipeline.execute({ provinces: ["กรุงเทพมหานคร"], intent: { mode: "now" }, originalText: "" });

    expect(stationCalls).toEqual(["กรุงเทพมหานคร"]);
    expect(forecastCalls).toEqual(["กรุงเทพมหานคร"]);
    expect(nwpCalls).toEqual([]);
    expect(res[0].type).toBe("forecast7d");
  });

  it("mode=future uses Forecast only when success", async () => {
    const pipeline = new WeatherPipeline(new Map());
    const res = await pipeline.execute({ provinces: ["เชียงใหม่"], intent: { mode: "future" }, originalText: "" });

    expect(forecastCalls).toEqual(["เชียงใหม่"]);
    expect(stationCalls).toEqual([]);
    expect(nwpCalls).toEqual([]);
    expect(res[0].type).toBe("forecast7d");
  });
});
