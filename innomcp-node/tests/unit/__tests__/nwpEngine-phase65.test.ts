import { NwpEngine } from "../../../src/utils/weather/engines/nwpEngine";

jest.mock("../../../src/utils/weather/toolCall", () => {
  return {
    executeWeatherToolCall: jest.fn(),
    TimeoutError: class TimeoutError extends Error {
      code = "TIMEOUT" as const;
    },
  };
});

import { executeWeatherToolCall } from "../../../src/utils/weather/toolCall";

describe("Phase 6.5 NwpEngine", () => {
  it("calls NWP daily by place with {place}", async () => {
    (executeWeatherToolCall as any).mockResolvedValue({ data: { daily: [{ t: 1 }] }, source: "NWP" });

    const clients = new Map<string, any>();
    clients.set("innomcp-server", { callTool: jest.fn() });
    const engine = new NwpEngine(clients);

    const res = await engine.getNwpData("นครราชสีมา");

    expect(executeWeatherToolCall).toHaveBeenCalled();
    const call = (executeWeatherToolCall as any).mock.calls[0][0];
    expect(call.toolName).toBe("nwp_daily_by_place");
    expect(call.args).toEqual({ place: "นครราชสีมา" });
    expect(res.type).toBe("nwp");
  });

  it("normalizes nested payload shapes", async () => {
    (executeWeatherToolCall as any).mockResolvedValue({ data: { hourly: [{ h: 1 }] } });

    const clients = new Map<string, any>();
    clients.set("innomcp-server", { callTool: jest.fn() });
    const engine = new NwpEngine(clients);

    const res = await engine.getNwpData("กรุงเทพมหานคร");
    expect(res.type).toBe("nwp");
    expect(res.data).toHaveProperty("forecast");
  });
});
