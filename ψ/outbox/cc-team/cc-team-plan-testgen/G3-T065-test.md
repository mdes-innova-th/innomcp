<!-- cc-team deliverable
 group: G3 (Generate jest unit tests for untested innomcp-node modules (batch 3))
 member: T065 role=test model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":1564,"completion_tokens":2716,"total_tokens":4280,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 32s
 generated: 2026-06-13T11:04:47.086Z -->
```typescript
import { Request, Response } from "express";

// Mocks MUST be registered before importing the module under test.
jest.mock("../../services/leaderboardMetrics", () => ({
  getProviderStats: jest.fn(),
  getSparklineData: jest.fn(),
}));

jest.mock("../../services/motherProviderToggle", () => ({
  isProviderEnabled: jest.fn(),
}));

jest.mock("../../utils/errorRecovery", () => ({
  errorRecovery: {
    getCircuitStatus: jest.fn(),
  },
}));

import { getProviderStats, getSparklineData } from "../../services/leaderboardMetrics";
import { isProviderEnabled } from "../../services/motherProviderToggle";
import { errorRecovery } from "../../utils/errorRecovery";
import router from "../src/routes/api/motherScorecard";

const getProviderStatsMock = getProviderStats as jest.MockedFunction<typeof getProviderStats>;
const getSparklineDataMock = getSparklineData as jest.MockedFunction<typeof getSparklineData>;
const isProviderEnabledMock = isProviderEnabled as jest.MockedFunction<typeof isProviderEnabled>;
const getCircuitStatusMock = errorRecovery.getCircuitStatus as jest.Mock;

const ALL_PROVIDERS = [
  "mdes-cloud", "thai-llm", "ollama-local", "openai-gpt",
  "claude-haiku", "claude-sonnet", "copilot", "gemini-pro",
  "mistral-large", "deepseek-r1", "groq-llama", "together-llama",
  "innova-bot", "innova-oracle",
];

function makeStats(values: Array<Partial<{
  requests: number;
  avgLatency: number;
  p95Latency: number;
  successRate: number;
  avgQuality: number;
  consistencyScore: number;
  avgResponseLength: number;
  wins: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  topIntent: string;
  healthScore: number;
  efficiencyScore: number;
}>>): Map<string, any> {
  const m = new Map<string, any>();
  ALL_PROVIDERS.forEach((id, i) => {
    const v = values[i] ?? {};
    m.set(id, {
      requests: 0,
      avgLatency: 0,
      p95Latency: 0,
      successRate: 0,
      avgQuality: 0,
      consistencyScore: 0,
      avgResponseLength: 0,
      wins: 0,
      winRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      topIntent: undefined,
      healthScore: 0,
      efficiencyScore: 0,
      ...v,
    });
  });
  return m;
}

function findHandler() {
  const layer: any = (router as any).stack.find(
    (l: any) => l.route && l.route.path === "/" && l.route.methods.get
  );
  if (!layer) throw new Error("GET / handler not found");
  return layer.route.stack[0].handle as (req: Request, res: Response) => void;
}

function makeRes() {
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: any) { this.body = payload; return this; },
  };
  return res as Response & { body: any; statusCode: number };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
  jest.clearAllMocks();
  getSparklineDataMock.mockImplementation((id: string) => [1, 2, 3].map((n) => ({ id, n })));
  isProviderEnabledMock.mockReturnValue(true);
  getCircuitStatusMock.mockReturnValue({ state: "CLOSED" });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("motherScorecard router", () => {
  test("exports an express Router with a GET / handler", () => {
    expect(router).toBeDefined();
    expect(typeof (router as any).stack).toBe("object");
    const layer: any = (router as any).stack.find(
      (l: any) => l.route && l.route.methods.get && l.route.path === "/"
    );
    expect(layer).toBeDefined();
  });

  test("responds with providers, totalProviders, gradeDistribution, topProvider and timestamp", () => {
    getProviderStatsMock.mockReturnValue(makeStats([]));

    const handler = findHandler();
    const res = makeRes();
    handler({} as Request, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body.totalProviders).toBe(ALL_PROVIDERS.length);
    expect(Array.isArray(res.body.providers)).toBe(true);
    expect(res.body.providers).toHaveLength(ALL_PROVIDERS.length);
    expect(res.body.gradeDistribution).toBeDefined();
    expect(Object.keys(res.body.gradeDistribution).sort()).toEqual(
      ["—", "A", "A+", "B", "C", "D", "F"].sort()
    );
    expect(res.body.topProvider).not.toBeNull();
    expect(res.body.timestamp).toBe("2025-01-15T12:00:00.000Z");
  });

  test("providers are sorted by score descending and assigned rank + tier", () => {
    getProviderStatsMock.mockReturnValue(makeStats([
      { requests: 1000, successRate: 99, avgQuality: 95, wins: 50, p95Latency: 100 },
      { requests: 500, successRate: 90, avgQuality: 80, wins: 20, p95Latency: 200 },
      { requests: 200, successRate: 80, avgQuality: 70, wins: 10, p95Latency: 300 },
      { requests: 100, successRate: 70, avgQuality: 60, wins: 5, p95Latency: 400 },
    ]));

    const handler = findHandler();
    const res = makeRes();
    handler({} as Request, res);

    const providers = res.body.providers;
    for (let i = 1; i < providers.length; i++) {
      expect(providers[i - 1].score).toBeGreaterThanOrEqual(providers[i].score);
    }
    expect(providers[0].rank).toBe(1);
    expect(providers[1].rank).toBe(2);
    expect(providers[0].tier).toBe("gold");
    expect(providers[2].tier).toBe("gold");
    expect(providers[3].tier).toBe("silver");
    expect(providers[6].tier).toBe("silver");
    expect(providers[9].tier).toBe("bronze");
    expect(providers[10].tier).toBe("none");
    expect(providers[13].tier).toBe("none");
  });

  test("uses hasData=false and grade='—' when provider has no stats", () => {
    getProviderStatsMock.mockReturnValue(new Map());

    const handler = findHandler();
    const res = makeRes();
    handler({} as Request, res);

    const first = res.body.providers[0];
    expect(first.hasData).toBe(false);
    expect(first.grade).toBe("—");
    expect(first.score).toBe(0);
    expect(first.requests).toBe(0);
    expect(first.circuitState).toBe("CLOSED");
  });

  test("defaults circuitState to 'UNKNOWN' when errorRecovery returns nothing", () => {
    getProviderStatsMock.mockReturnValue(makeStats([]));
    getCircuitStatusMock.mockReturnValue(undefined);

    const handler = findHandler();
    const res = makeRes();
    handler({} as Request, res);

    for (const p of res.body.providers) {
      expect(p.circuitState).toBe("UNKNOWN");
    }
  });

  test("reflects isProviderEnabled value per provider", () => {
    getProviderStatsMock.mockReturnValue(makeStats([]));
    isProviderEnabledMock.mockImplementation((id: string) => id === "openai-gpt");

    const handler = findHandler();
    const res = makeRes();
    handler({} as Request, res);

    const openai = res.body.providers.find((p: any) => p.id === "openai-gpt");
    const other = res.body.providers.find((p: any) => p.id === "claude-haiku");
    expect(openai.enabled).toBe(true);
    expect(other.enabled).toBe(false);
  });

  test("includes sparkline data from getSparklineData for each provider", () => {
    getProviderStatsMock.mockReturnValue(makeStats([]));

    const handler = findHandler();
    const res = makeRes();
    handler({} as Request, res);

    expect(getSparklineDataMock).toHaveBeenCalled();
    for (const call of getSparklineDataMock.mock.calls) {
      expect(call[1]).toBe(10);
    }
    for (const p of res.body.providers) {
      expect(Array.isArray(p.sparkline)).toBe(true);
      expect(p.sparkline.length).toBe(3);
    }
  });

  test("grade distribution counts match providers' grades", () => {
    getProviderStatsMock.mockReturnValue(makeStats([
      { requests: 1000, successRate: 99, avgQuality: 99, wins: 50, p95Latency: 50 },   // A+
      { requests: 800, successRate: 95, avgQuality: 90, wins: 30, p95Latency: 80 },    // A
      { requests: 600, successRate: 85, avgQuality: 75, wins: 15, p95Latency: 120 },   // B
      { requests: 400, successRate: 70, avgQuality: 65, wins: 8, p95Latency: 200 },    // C
      { requests: 200, successRate: 55, avgQuality: 50, wins: 3, p95Latency: 300 },    // D
      { requests: 0, successRate: 0, avgQuality: 0, wins: 0, p95Latency: 0 },          // F likely
    ]));

    const handler = findHandler();
    const res = makeRes();
    handler({} as Request, res);

    const dist = res.body.gradeDistribution;
    const sum = Object.values(dist).reduce<number>((a: number, b: any) => a + (b as number), 0);
    expect(sum).toBe(ALL_PROVIDERS.length);

    const tally: Record<string, number> = {};
    for (const p of res.body.providers) {
      tally[p.grade] = (tally[p.grade] ?? 0) + 1;
    }
    for (const key of Object.keys(dist)) {
      expect(dist[key]).toBe(tally[key] ?? 0);
    }
  });

  test("compositeScore with no latency data does not throw and returns a finite number", () => {
    getProviderStatsMock.mockReturnValue(makeStats([
      { requests: 0, successRate: 0, avgQuality: 0, wins: 0 },
    ]));

    const handler = findHandler();
    const res = makeRes();
    expect(() => handler({} as Request, res)).not.toThrow();
    const mdes = res.body.providers.find((p: any) => p.id === "mdes-cloud");
    expect(Number.isFinite(mdes.score)).toBe(true);
    expect(mdes.grade).toBe("F");
  });

  test("topProvider equals providers[0] after sorting", () => {
    getProviderStatsMock.mockReturnValue(makeStats([
      { requests: 50, successRate: 50, avgQuality: 50, wins: 5, p95Latency: 500 },
    ]));

    const handler = findHandler();
    const res = makeRes();
    handler({} as Request, res);

    expect(res.body.topProvider).not.toBeNull();
    expect(res.body.topProvider.id).toBe(res.body.providers[0].id);
    expect(res.body.topProvider.rank).toBe(1);
  });
});
```
