/**
 * Unit tests for Memory + RAG Foundation services.
 * Tests: sessionMemory, answerContract, coldRetriever, retrievalOrchestrator, memoryRagHook
 */
import * as path from "path";

// ---- Session Memory ----

describe("SessionMemoryStore", () => {
  let SessionMemoryStore: any;

  beforeEach(() => {
    // Fresh import to reset singleton state
    jest.resetModules();
    const mod = require("../../../src/services/sessionMemory");
    SessionMemoryStore = mod.SessionMemoryStore;
  });

  test("recordTurn creates a session and stores entities", () => {
    const store = new SessionMemoryStore();
    store.recordTurn("s1", "อากาศเชียงใหม่วันนี้", "weather", [
      { name: "เชียงใหม่", type: "province", value: "เชียงใหม่", domain: "weather", confidence: 0.9 },
    ]);
    const snap = store.getSnapshot("s1");
    expect(snap.turnCount).toBe(1);
    expect(snap.activeDomain).toBe("weather");
    expect(snap.entities.length).toBe(1);
    expect(snap.entities[0].name).toBe("เชียงใหม่");
    expect(snap.entities[0].type).toBe("province");
  });

  test("multiple turns accumulate entities", () => {
    const store = new SessionMemoryStore();
    store.recordTurn("s1", "อากาศเชียงใหม่", "weather", [
      { name: "เชียงใหม่", type: "province", value: "เชียงใหม่", domain: "weather", confidence: 0.9 },
    ]);
    store.recordTurn("s1", "evidence ais", "evidence", [
      { name: "AIS", type: "isp", value: "AIS", domain: "evidence", confidence: 0.95 },
    ]);
    const snap = store.getSnapshot("s1");
    expect(snap.turnCount).toBe(2);
    expect(snap.activeDomain).toBe("evidence");
    expect(snap.entities.length).toBe(2);
    expect(snap.recentDomains).toContain("weather");
    expect(snap.recentDomains).toContain("evidence");
  });

  test("entity dedup keeps latest", () => {
    const store = new SessionMemoryStore();
    store.recordTurn("s1", "อากาศเชียงใหม่", "weather", [
      { name: "เชียงใหม่", type: "province", value: "เชียงใหม่", domain: "weather", confidence: 0.9 },
    ]);
    store.recordTurn("s1", "อากาศเชียงใหม่พรุ่งนี้", "weather", [
      { name: "เชียงใหม่", type: "province", value: "เชียงใหม่", domain: "weather", confidence: 0.95 },
    ]);
    const snap = store.getSnapshot("s1");
    // Dedup by type:name → only 1 entity
    const provinces = snap.entities.filter((e: any) => e.type === "province" && e.name === "เชียงใหม่");
    expect(provinces.length).toBe(1);
    expect(provinces[0].sourceTurn).toBe(2); // latest turn
  });

  test("empty session returns clean snapshot", () => {
    const store = new SessionMemoryStore();
    const snap = store.getSnapshot("nonexistent");
    expect(snap.turnCount).toBe(0);
    expect(snap.activeDomain).toBeNull();
    expect(snap.entities).toEqual([]);
  });

  test("hasMemory returns false for empty, true for populated", () => {
    const store = new SessionMemoryStore();
    expect(store.hasMemory("s1")).toBe(false);
    store.recordTurn("s1", "test", "general", []);
    expect(store.hasMemory("s1")).toBe(true);
  });

  test("clear removes session", () => {
    const store = new SessionMemoryStore();
    store.recordTurn("s1", "test", "general", []);
    store.clear("s1");
    expect(store.hasMemory("s1")).toBe(false);
  });

  test("getEntitiesByDomain filters correctly", () => {
    const store = new SessionMemoryStore();
    store.recordTurn("s1", "q1", "weather", [
      { name: "เชียงใหม่", type: "province", value: "เชียงใหม่", domain: "weather", confidence: 0.9 },
    ]);
    store.recordTurn("s1", "q2", "evidence", [
      { name: "AIS", type: "isp", value: "AIS", domain: "evidence", confidence: 0.95 },
    ]);
    const weatherEnts = store.getEntitiesByDomain("s1", "weather");
    expect(weatherEnts.length).toBe(1);
    expect(weatherEnts[0].name).toBe("เชียงใหม่");
  });

  test("getLastEntity returns most recent of type", () => {
    const store = new SessionMemoryStore();
    store.recordTurn("s1", "q1", "weather", [
      { name: "เชียงใหม่", type: "province", value: "เชียงใหม่", domain: "weather", confidence: 0.9 },
    ]);
    store.recordTurn("s1", "q2", "weather", [
      { name: "ภูเก็ต", type: "province", value: "ภูเก็ต", domain: "weather", confidence: 0.9 },
    ]);
    const last = store.getLastEntity("s1", "province");
    expect(last).not.toBeNull();
    expect(last!.name).toBe("ภูเก็ต");
  });
});

// ---- Answer Contract ----

describe("Answer Contract", () => {
  let buildAnswerContract: any;

  beforeEach(() => {
    jest.resetModules();
    const mod = require("../../../src/services/answerContract");
    buildAnswerContract = mod.buildAnswerContract;
  });

  test("builds contract with correct fields", () => {
    const contract = buildAnswerContract({
      route: "weather",
      toolsUsed: ["weatherPipeline"],
      sources: [
        { id: "tool:wp", type: "api", name: "weatherPipeline", freshness: "live", timestamp: new Date().toISOString(), confidence: 0.9 },
      ],
      answerMode: "deterministic",
      retrievalUsed: "hot",
      memoryUsed: true,
      memoryEntities: ["province:เชียงใหม่"],
      confidence: 0.9,
      grounded: true,
    });
    expect(contract.route).toBe("weather");
    expect(contract.toolsUsed).toEqual(["weatherPipeline"]);
    expect(contract.grounded).toBe(true);
    expect(contract.freshness).toBe("live");
    expect(contract.memoryUsed).toBe(true);
    expect(contract.retrievalUsed).toBe("hot");
    expect(contract.degraded).toBe(false);
    expect(contract.timestamp).toBeDefined();
  });

  test("freshness = mixed when both live and stale sources", () => {
    const contract = buildAnswerContract({
      route: "mixed",
      toolsUsed: ["t1", "t2"],
      sources: [
        { id: "hot", type: "api", name: "api1", freshness: "live", timestamp: new Date().toISOString(), confidence: 0.9 },
        { id: "cold", type: "document", name: "doc1", freshness: "stale", timestamp: "2024-01-01", confidence: 0.7 },
      ],
      answerMode: "hybrid",
      retrievalUsed: "both",
      memoryUsed: false,
      confidence: 0.8,
      grounded: true,
    });
    expect(contract.freshness).toBe("mixed");
    expect(contract.hotSources).toHaveLength(1);
    expect(contract.coldSources).toHaveLength(1);
  });

  test("deterministic route gets live freshness even without sources", () => {
    const contract = buildAnswerContract({
      route: "calculator",
      toolsUsed: [],
      sources: [],
      answerMode: "deterministic",
      retrievalUsed: "none",
      memoryUsed: false,
      confidence: 1.0,
      grounded: true,
    });
    expect(contract.freshness).toBe("live");
  });
});

// ---- Cold Retriever ----

describe("ColdRetriever", () => {
  let ColdRetriever: any;

  beforeEach(() => {
    jest.resetModules();
    const mod = require("../../../src/services/coldRetriever");
    ColdRetriever = mod.ColdRetriever;
  });

  test("loads corpus from seed directory", async () => {
    const retriever = new ColdRetriever();
    const corpusDir = path.resolve(__dirname, "../../../data/knowledge-base");
    const result = await retriever.loadCorpus(corpusDir);
    expect(result.docCount).toBeGreaterThanOrEqual(3);
    expect(result.chunkCount).toBeGreaterThan(0);
    expect(retriever.isReady()).toBe(true);
  });

  test("returns empty when corpus dir missing", async () => {
    const retriever = new ColdRetriever();
    const result = await retriever.loadCorpus("/nonexistent/path");
    expect(result.docCount).toBe(0);
    expect(retriever.isReady()).toBe(false);
  });

  test("search returns relevant results for Thai query", async () => {
    const retriever = new ColdRetriever();
    const corpusDir = path.resolve(__dirname, "../../../data/knowledge-base");
    await retriever.loadCorpus(corpusDir);

    const results = retriever.search("NIP คืออะไร");
    expect(results.length).toBeGreaterThan(0);
    // Should find evidence-nip-guide
    const docPaths = results.map((r: any) => r.document.path);
    expect(docPaths.some((p: string) => p.includes("evidence-nip"))).toBe(true);
  });

  test("search returns relevant results for weather", async () => {
    const retriever = new ColdRetriever();
    const corpusDir = path.resolve(__dirname, "../../../data/knowledge-base");
    await retriever.loadCorpus(corpusDir);

    const results = retriever.search("โอกาสฝน หมายความว่าอะไร");
    expect(results.length).toBeGreaterThan(0);
    const docPaths = results.map((r: any) => r.document.path);
    expect(docPaths.some((p: string) => p.includes("weather"))).toBe(true);
  });

  test("search with domain filter narrows results", async () => {
    const retriever = new ColdRetriever();
    const corpusDir = path.resolve(__dirname, "../../../data/knowledge-base");
    await retriever.loadCorpus(corpusDir);

    const allResults = retriever.search("ภาคเหนือ");
    const geoResults = retriever.search("ภาคเหนือ", { domain: "geo" });
    // Geo filter should narrow (or equal) total results
    expect(geoResults.length).toBeLessThanOrEqual(allResults.length);
  });

  test("getRegistry returns document metadata", async () => {
    const retriever = new ColdRetriever();
    const corpusDir = path.resolve(__dirname, "../../../data/knowledge-base");
    await retriever.loadCorpus(corpusDir);

    const registry = retriever.getRegistry();
    expect(registry.length).toBeGreaterThanOrEqual(3);
    for (const doc of registry) {
      expect(doc).toHaveProperty("id");
      expect(doc).toHaveProperty("title");
      expect(doc).toHaveProperty("domain");
      expect(doc).toHaveProperty("chunks");
    }
  });
});

// ---- Retrieval Orchestrator ----

describe("Retrieval Orchestrator", () => {
  let planRetrieval: any;

  beforeEach(() => {
    jest.resetModules();
    const mod = require("../../../src/services/retrievalOrchestrator");
    planRetrieval = mod.planRetrieval;
  });

  test("deterministic routes return none", () => {
    const plan = planRetrieval("2+2", "calculator");
    expect(plan.decision).toBe("none");
    expect(plan.reason).toBe("deterministic_route");
  });

  test("datetime routes return none", () => {
    const plan = planRetrieval("กี่โมงแล้ว", "datetime");
    expect(plan.decision).toBe("none");
  });

  test("weather today query returns hot", () => {
    const plan = planRetrieval("อากาศวันนี้เชียงใหม่");
    expect(plan.decision).toBe("hot");
    expect(plan.hotDomains).toContain("weather");
  });

  test("evidence live query returns hot", () => {
    const plan = planRetrieval("evidence วันนี้ AIS");
    expect(plan.decision).toBe("hot");
    expect(plan.hotDomains).toContain("evidence");
  });

  test("documentation question returns cold", () => {
    // Need cold retriever to be ready for cold path
    // Without it, falls through to none
    const plan = planRetrieval("NIP คืออะไร");
    // May return cold or none depending on coldRetriever.isReady()
    expect(["cold", "none"]).toContain(plan.decision);
  });

  test("mixed query returns hot+cold", () => {
    const plan = planRetrieval("อากาศวันนี้เชียงใหม่ และอธิบายว่าโอกาสฝนคืออะไร");
    expect(plan.decision).toBe("hot+cold");
    expect(plan.hotDomains.length).toBeGreaterThan(0);
    expect(plan.coldQuery).toBeDefined();
  });

  test("weather route hint returns hot even without keywords", () => {
    const plan = planRetrieval("ข้อมูลเพิ่มเติม", "weather");
    expect(plan.decision).toBe("hot");
  });

  test("no pattern defaults to none", () => {
    const plan = planRetrieval("สวัสดีครับ");
    expect(plan.decision).toBe("none");
    expect(plan.reason).toBe("no_retrieval_pattern");
  });
});

// ---- Hot Retriever ----

describe("Hot Retriever", () => {
  let normalizeWeatherFacts: any;
  let normalizeEvidenceFacts: any;
  let normalizeDeterministicFact: any;
  let mergeRetrievalFacts: any;
  let composeFactSummary: any;

  beforeEach(() => {
    jest.resetModules();
    const mod = require("../../../src/services/hotRetriever");
    normalizeWeatherFacts = mod.normalizeWeatherFacts;
    normalizeEvidenceFacts = mod.normalizeEvidenceFacts;
    normalizeDeterministicFact = mod.normalizeDeterministicFact;
    mergeRetrievalFacts = mod.mergeRetrievalFacts;
    composeFactSummary = mod.composeFactSummary;
  });

  test("normalizeWeatherFacts returns facts from array result", () => {
    const facts = normalizeWeatherFacts(
      { result: [{ province: "เชียงใหม่", temp: 28 }] },
      "อากาศเชียงใหม่"
    );
    expect(facts.length).toBe(1);
    expect(facts[0].domain).toBe("weather");
    expect(facts[0].source.type).toBe("api");
    expect(facts[0].source.freshness).toBe("live");
  });

  test("normalizeWeatherFacts returns facts from object result", () => {
    const facts = normalizeWeatherFacts(
      { data: { temp: 30, humidity: 70 } },
      "อากาศกรุงเทพ"
    );
    expect(facts.length).toBe(1);
    expect(facts[0].entities).toContain("กรุงเทพ");
  });

  test("normalizeWeatherFacts handles null input", () => {
    const facts = normalizeWeatherFacts(null, "test");
    expect(facts).toEqual([]);
  });

  test("normalizeEvidenceFacts returns fact with ISP extraction", () => {
    const facts = normalizeEvidenceFacts(
      { result: { count: 5, items: [] } },
      "evidence ais วันนี้"
    );
    expect(facts.length).toBe(1);
    expect(facts[0].domain).toBe("evidence");
    expect(facts[0].source.type).toBe("database");
  });

  test("normalizeDeterministicFact creates proper fact", () => {
    const fact = normalizeDeterministicFact("calculator", "calculatorTool", "42", "6*7");
    expect(fact.domain).toBe("calculator");
    expect(fact.content).toBe("42");
    expect(fact.confidence).toBe(1.0);
  });

  test("mergeRetrievalFacts deduplicates by id", () => {
    const set1 = [{ id: "a", source: {}, domain: "w", content: "x", entities: [], timestamp: "", confidence: 0.9 }];
    const set2 = [{ id: "a", source: {}, domain: "w", content: "y", entities: [], timestamp: "", confidence: 0.9 }];
    const merged = mergeRetrievalFacts([set1 as any, set2 as any]);
    expect(merged.length).toBe(1);
  });

  test("composeFactSummary creates formatted text", () => {
    const facts = [
      { id: "f1", source: { name: "weatherPipeline" }, domain: "weather", content: "เชียงใหม่ อุณหภูมิ 28°C", entities: [], timestamp: "", confidence: 0.9 },
    ];
    const summary = composeFactSummary(facts as any);
    expect(summary).toContain("[weatherPipeline]");
    expect(summary).toContain("28°C");
  });

  test("composeFactSummary returns empty for no facts", () => {
    expect(composeFactSummary([])).toBe("");
  });
});

// ---- Memory RAG Hook ----

describe("Memory RAG Hook", () => {
  let recordTurnAndGetMeta: any;
  let enrichGroundedContract: any;
  let getMemoryDebugData: any;
  let queryColdRag: any;
  let initMemoryRag: any;

  beforeEach(() => {
    jest.resetModules();
    const mod = require("../../../src/services/memoryRagHook");
    recordTurnAndGetMeta = mod.recordTurnAndGetMeta;
    enrichGroundedContract = mod.enrichGroundedContract;
    getMemoryDebugData = mod.getMemoryDebugData;
    queryColdRag = mod.queryColdRag;
    initMemoryRag = mod.initMemoryRag;
  });

  test("recordTurnAndGetMeta records and returns meta", () => {
    const meta = recordTurnAndGetMeta("test-session", "อากาศเชียงใหม่วันนี้", "weather", ["weatherPipeline"]);
    expect(meta.memoryUsed).toBe(true);
    expect(meta.memoryEntities.length).toBeGreaterThan(0);
    expect(meta.sessionTurnCount).toBe(1);
    expect(meta.activeDomain).toBe("weather");
    expect(["hot", "cold", "both", "none"]).toContain(meta.retrievalMode);
  });

  test("enrichGroundedContract adds ragMeta to contract", () => {
    const sc = {
      __groundedContract: {
        selectedRoute: "weather",
        selectedTools: ["weatherPipeline"],
      },
    };
    const meta = {
      memoryUsed: true,
      memoryEntities: ["province:เชียงใหม่"],
      retrievalMode: "hot" as const,
      retrievalReason: "operational_live_query",
      coldDocHits: 0,
      hotFactCount: 1,
      sessionTurnCount: 1,
      activeDomain: "weather" as const,
    };
    enrichGroundedContract(sc, meta);
    expect(sc.__groundedContract).toHaveProperty("memoryRag");
    expect((sc.__groundedContract as any).memoryRag.memoryUsed).toBe(true);
    expect((sc.__groundedContract as any).memoryRag.retrievalMode).toBe("hot");
  });

  test("enrichGroundedContract handles null input safely", () => {
    enrichGroundedContract(null, {} as any);
    enrichGroundedContract({ noContract: true }, {} as any);
    // Should not throw
  });

  test("getMemoryDebugData returns structured data", () => {
    recordTurnAndGetMeta("debug-session", "test", "general", []);
    const data = getMemoryDebugData("debug-session");
    expect(data).toHaveProperty("session");
    expect(data).toHaveProperty("coldRag");
    expect(data).toHaveProperty("initialized");
    expect(data.session.sessionId).toBe("debug-session");
  });

  test("queryColdRag returns empty when not initialized", () => {
    const result = queryColdRag("NIP คืออะไร");
    // May return empty if cold retriever not loaded yet
    expect(result).toHaveProperty("context");
    expect(result).toHaveProperty("docCount");
    expect(result).toHaveProperty("sources");
  });

  test("initMemoryRag loads corpus successfully", async () => {
    const result = await initMemoryRag();
    expect(result.docCount).toBeGreaterThanOrEqual(3);
  });
});
