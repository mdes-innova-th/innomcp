/**
 * tests/unit/motherRaceView.test.ts
 * Tests for the race state derivation logic used by MotherRaceView.tsx
 * (Logic duplicated here since the component is in innomcp-next, not server)
 */

interface AgentEvent {
  type: string;
  runId: string;
  messageId: string;
  publicSummary: string;
  isSafeForUser: true;
  timestamp: string;
  provider?: string;
  latencyMs?: number;
}

interface RaceEntry {
  providerId: string;
  latencyMs?: number;
  done: boolean;
  failed: boolean;
  running: boolean;
  pending: boolean;
  isFirst: boolean;
}

function deriveRaceState(events: AgentEvent[]): RaceEntry[] {
  const seen = new Map<string, {
    started: boolean;
    done: boolean;
    failed: boolean;
    latencyMs?: number;
    startedAt?: number;
  }>();

  for (const ev of events) {
    const pid = ev.provider;
    if (!pid || pid === "mother") continue;

    if (!seen.has(pid)) {
      seen.set(pid, { started: false, done: false, failed: false });
    }
    const s = seen.get(pid)!;

    if (ev.type === "agent_started") {
      if (!s.started) {
        s.started = true;
        s.startedAt = ev.timestamp ? Date.parse(ev.timestamp) : undefined;
      }
    } else if (ev.type === "agent_finished") {
      s.done = true;
      if (ev.latencyMs != null) {
        s.latencyMs = ev.latencyMs;
      } else if (s.startedAt && ev.timestamp) {
        s.latencyMs = Date.parse(ev.timestamp) - s.startedAt;
      }
    } else if (ev.type === "fallback") {
      s.failed = true;
    }
  }

  let firstMs = Infinity;
  let firstId = "";
  for (const [pid, s] of seen.entries()) {
    if (s.done && s.latencyMs != null && s.latencyMs < firstMs) {
      firstMs = s.latencyMs;
      firstId = pid;
    }
  }

  return Array.from(seen.entries()).map(([pid, s]) => ({
    providerId: pid,
    latencyMs: s.latencyMs,
    done: s.done,
    failed: s.failed,
    running: s.started && !s.done && !s.failed,
    pending: !s.started,
    isFirst: pid === firstId,
    label: pid,
    color: "",
  }));
}

function makeEv(overrides: Partial<AgentEvent>): AgentEvent {
  return {
    type: "agent_started",
    runId: "r1",
    messageId: "m1",
    publicSummary: "",
    isSafeForUser: true,
    timestamp: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    ...overrides,
  };
}

describe("deriveRaceState", () => {
  it("returns empty array for no provider events", () => {
    const result = deriveRaceState([
      makeEv({ type: "agent_started", provider: undefined }),
      makeEv({ type: "agent_started", provider: "mother" }),
    ]);
    expect(result).toHaveLength(0);
  });

  it("tracks running state after agent_started", () => {
    const result = deriveRaceState([
      makeEv({ type: "agent_started", provider: "mdes-cloud" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].running).toBe(true);
    expect(result[0].done).toBe(false);
    expect(result[0].failed).toBe(false);
  });

  it("tracks done + latencyMs from structured field", () => {
    const result = deriveRaceState([
      makeEv({ type: "agent_started", provider: "groq-llama" }),
      makeEv({ type: "agent_finished", provider: "groq-llama", latencyMs: 312 }),
    ]);
    expect(result[0].done).toBe(true);
    expect(result[0].latencyMs).toBe(312);
    expect(result[0].running).toBe(false);
  });

  it("tracks failed state on fallback", () => {
    const result = deriveRaceState([
      makeEv({ type: "agent_started", provider: "deepseek-r1" }),
      makeEv({ type: "fallback", provider: "deepseek-r1" }),
    ]);
    expect(result[0].failed).toBe(true);
    expect(result[0].done).toBe(false);
  });

  it("marks isFirst for fastest done provider", () => {
    const result = deriveRaceState([
      makeEv({ type: "agent_started", provider: "groq-llama" }),
      makeEv({ type: "agent_finished", provider: "groq-llama", latencyMs: 200 }),
      makeEv({ type: "agent_started", provider: "mdes-cloud" }),
      makeEv({ type: "agent_finished", provider: "mdes-cloud", latencyMs: 800 }),
    ]);
    const groq = result.find((e) => e.providerId === "groq-llama")!;
    const mdes = result.find((e) => e.providerId === "mdes-cloud")!;
    expect(groq.isFirst).toBe(true);
    expect(mdes.isFirst).toBe(false);
  });

  it("handles retry — second agent_started does not reset startedAt", () => {
    const result = deriveRaceState([
      makeEv({ type: "agent_started", provider: "ollama-local", timestamp: "2026-01-01T00:00:00.000Z" }),
      makeEv({ type: "agent_started", provider: "ollama-local", timestamp: "2026-01-01T00:00:05.000Z" }),
      makeEv({ type: "agent_finished", provider: "ollama-local", latencyMs: 1500 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].latencyMs).toBe(1500);
    expect(result[0].done).toBe(true);
  });

  it("multiple providers tracked independently", () => {
    const result = deriveRaceState([
      makeEv({ type: "agent_started", provider: "claude-haiku" }),
      makeEv({ type: "agent_started", provider: "innova-bot" }),
      makeEv({ type: "agent_finished", provider: "innova-bot", latencyMs: 100 }),
    ]);
    expect(result).toHaveLength(2);
    const haiku = result.find((e) => e.providerId === "claude-haiku")!;
    const innova = result.find((e) => e.providerId === "innova-bot")!;
    expect(haiku.running).toBe(true);
    expect(innova.done).toBe(true);
    expect(innova.isFirst).toBe(true);
  });
});
