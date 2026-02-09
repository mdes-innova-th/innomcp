import { GeoIntent } from "./geo-intent";
import { GeoRouter } from "./geo-tool-router";
import { GeoGuard } from "./geo-guard";
import { GeoAggregator } from "./geo-aggregator";
import type { WeatherPacket } from "./interfaces";

/**
 * Orchestrator: message → intent → router → guard → aggregator → WeatherPacket
 *
 * Tool dispatch is delegated to a callback so this class stays decoupled
 * from the MCP tool registry.
 */
export type ToolDispatcher = (toolName: string, params: Record<string, unknown>) => Promise<unknown>;

export class GeoService {
  private intent = new GeoIntent();
  private router = new GeoRouter();
  private guard = new GeoGuard();
  private aggregator = new GeoAggregator();

  constructor(private readonly dispatch: ToolDispatcher) {}

  public async handleRequest(userMessage: string): Promise<WeatherPacket> {
    console.log(`[GeoService] Processing: "${userMessage}"`);

    // 1. Intent
    const intentResult = this.intent.analyze(userMessage);
    console.log("  -> Intent:", JSON.stringify(intentResult));

    if (intentResult.domain !== "weather" || intentResult.confidence < 0.5) {
      return {
        summary: "ไม่เข้าใจคำถามเกี่ยวกับสภาพอากาศ",
        timestamp: new Date().toISOString(),
        source: "none",
        evidence: { tool: "none", latency_ms: 0, confidence: 0 },
      };
    }

    // 2. Router
    const plan = this.router.route(intentResult);
    if (!plan) {
      return {
        summary: "ไม่สามารถระบุตำแหน่งหรือเครื่องมือที่เหมาะสมได้ กรุณาระบุจังหวัดหรือพิกัด",
        timestamp: new Date().toISOString(),
        source: "none",
        evidence: { tool: "none", latency_ms: 0, confidence: 0 },
      };
    }
    console.log("  -> Plan:", JSON.stringify(plan));

    // 3. Execute primary via Guard
    const rawPacket = await this.guard.executeWithGuard(
      () => this.dispatch(plan.primary.tool_name, plan.primary.params),
      plan.primary.tool_name,
    );

    // If primary succeeded, format and return
    if (!rawPacket.error) {
      const formatted = this.aggregator.format(rawPacket);
      console.log(`  -> OK (${formatted.evidence.latency_ms}ms)`);
      return formatted;
    }

    // 4. Try fallbacks in order
    for (const fb of plan.fallbacks) {
      console.log(`  -> Trying fallback: ${fb.tool_name} (${fb.reason})`);
      const fbPacket = await this.guard.executeWithGuard(
        () => this.dispatch(fb.tool_name, fb.params),
        fb.tool_name,
      );

      if (!fbPacket.error) {
        fbPacket.fallback_used = true;
        const formatted = this.aggregator.format(fbPacket);
        console.log(`  -> Fallback OK (${formatted.evidence.latency_ms}ms)`);
        return formatted;
      }
    }

    // 5. All tools failed – return degraded packet from guard
    console.error("  -> All tools failed");
    return rawPacket;
  }
}
