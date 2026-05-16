import type { AgentEvent } from "../../src/agents/events";
import { dispatchTool, planToolCall } from "../../src/agents/toolDispatch";
import type { GuestLimits } from "../../src/middleware/guestLimiter";

describe("planToolCall", () => {
  test("routes datetime intent to dateTimeTool", () => {
    const plan = planToolCall("datetime", "what time is it now?");
    expect(plan?.toolName).toBe("dateTimeTool");
    expect(plan?.args).toEqual({ format: "thai" });
  });

  test("routes calculation intent to calculatorTool with expression", () => {
    const plan = planToolCall("calc", "calculate 123 * 456 + 789");
    expect(plan?.toolName).toBe("calculatorTool");
    expect(plan?.args.expression).toBe("123 * 456 + 789");
  });

  test("routes evidence intent to evidenceTool", () => {
    const plan = planToolCall("evidence", "NIP top ISP yesterday");
    expect(plan?.toolName).toBe("evidenceTool");
    expect(plan?.args.action).toBe("evidence_records_yesterday_by_isp_top");
  });

  test("does not route generic machine learning questions to evidenceTool", () => {
    const plan = planToolCall("general", "machine learning คืออะไร");
    expect(plan).toBeNull();
  });

  test("routes map intent even without a province match", () => {
    const plan = planToolCall("map", "show map for Chiang Rai");
    expect(plan?.toolName).toBe("thai_geo_tool");
    expect(plan?.args.query).toBe("show map for Chiang Rai");
  });

  test("routes knowledge intent to thaiKnowledgeTool", () => {
    const plan = planToolCall("knowledge", "explain PDPA in Thailand");
    expect(plan?.toolName).toBe("thaiKnowledgeTool");
    expect(plan?.args.query).toBe("explain PDPA in Thailand");
  });

  // Phase C.03: casual "now" uses daily (lighter). Only explicit "hourly"/
  // "รายชั่วโมง" triggers 24-hour breakdown to avoid over-heavy responses.
  test("uses daily NWP for casual 'current weather now' (no hourly keyword)", () => {
    const plan = planToolCall("weather", "current weather now");
    expect(plan?.toolName).toBe("nwp_daily_by_place");
  });

  test("uses hourly NWP when query explicitly includes hourly keyword", () => {
    const plan = planToolCall("weather", "อากาศรายชั่วโมงวันนี้กรุงเทพ");
    expect(plan?.toolName).toBe("nwp_hourly_by_place");
  });
});

describe("dispatchTool guest limits", () => {
  test("emits fallback before MCP call when the planned tool is not allowed", async () => {
    const events: AgentEvent[] = [];
    const liveOutputs: Record<string, string> = {};
    const guestLimits: GuestLimits = {
      maxRequestsPerHour: 10,
      maxResponseLength: 2000,
      allowedTools: ["nwp_daily_by_place"],
      maxTokensPerRequest: 500,
    };

    await dispatchTool(
      "map",
      "\u0e41\u0e1c\u0e19\u0e17\u0e35\u0e48 \u0e01\u0e23\u0e38\u0e07\u0e40\u0e17\u0e1e",
      "run-1",
      "msg-1",
      (ev) => events.push(ev),
      liveOutputs,
      guestLimits
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("fallback");
    expect(events[0].fallbackReason).toBe("tool_not_allowed_for_account_tier");
    expect(liveOutputs).toEqual({});
  });
});
