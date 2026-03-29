import { resolveProvinces } from "../../../src/utils/locationResolver";

describe("Phase 6.5 LocationResolver", () => {
  it("supports Thai concatenated text via substring scan", () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    const provinces = resolveProvinces("พรุ่งนี้โคราชฝนตกไหม");
    expect(provinces).toContain("นครราชสีมา");
    expect(spy).toHaveBeenCalled();
    const msg = String(spy.mock.calls[spy.mock.calls.length - 1]?.[0] ?? "");
    expect(msg).toContain("resolvedProvinces=");
    spy.mockRestore();
  });

  it("normalizes common aliases", () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    const provinces = resolveProvinces("อากาศกทมวันนี้");
    expect(provinces).toContain("กรุงเทพมหานคร");
    spy.mockRestore();
  });

  it("returns empty when none", () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    const provinces = resolveProvinces("สวัสดีครับ");
    expect(provinces).toEqual([]);
    spy.mockRestore();
  });
});
