import { exec } from "node:child_process";

import { checkSystemHealth } from "../../src/utils/mcp/tools/system_status_tool";

jest.mock("node:child_process", () => ({
  exec: jest.fn(),
}));

const execMock = exec as unknown as jest.Mock;

describe("system_status_tool", () => {
  beforeEach(() => {
    execMock.mockReset();
  });

  test("timeout -> partial_outage (no throw)", async () => {
    execMock.mockImplementation((_cmd: any, _opts: any, cb: any) => {
      const err: any = new Error("Command timed out");
      err.code = "ETIMEDOUT";
      cb(err, "", "");
    });

    const result = await checkSystemHealth();
    expect(result.status).toBe("partial_outage");
    expect(result.machine_count).toBe("Unknown (CLI Timeout)");
    expect(result.containers).toEqual([]);
  });

  test("docker ps success -> counts evidence containers", async () => {
    execMock.mockImplementation((_cmd: any, _opts: any, cb: any) => {
      cb(null, "evidence-db-1\nredis\nEVIDENCE_DB\nother\n", "");
    });

    const result = await checkSystemHealth();
    expect(result.status).toBe("ok");
    expect(result.machine_count).toBe(2);
    expect(result.containers).toEqual(["evidence-db-1", "EVIDENCE_DB"]);
  });
});
