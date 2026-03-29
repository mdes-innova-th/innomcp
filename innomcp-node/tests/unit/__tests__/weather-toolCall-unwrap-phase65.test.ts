import { parseMcpPayload } from "../../../src/utils/weather/toolCall";

describe("Phase 6.5 parseMcpPayload", () => {
  it("unwraps {ok,meta,data} envelope", () => {
    const result = {
      structuredContent: {
        ok: true,
        meta: { x: 1 },
        data: { Provinces: { Province: [{ ProvinceNameThai: "กรุงเทพมหานคร" }] } },
      },
    };
    const payload = parseMcpPayload(result);
    expect(payload).toHaveProperty("Provinces");
  });

  it("unwraps single-element array wrapper", () => {
    const result = {
      content: [
        {
          type: "text",
          text: JSON.stringify([
            { Provinces: { Province: [{ ProvinceNameThai: "กรุงเทพมหานคร" }] } },
          ]),
        },
      ],
    };
    const payload = parseMcpPayload(result);
    expect(payload).toHaveProperty("Provinces");
  });

  it("parses JSON string from content", () => {
    const result = { content: [{ type: "text", text: "{\"hello\":123}" }] };
    const payload = parseMcpPayload(result);
    expect(payload).toEqual({ hello: 123 });
  });
});
