const axiosMock = jest.fn();
const getRedisClientMock = jest.fn();
const getRedisHealthSnapshotMock = jest.fn();
const pingDatabaseMock = jest.fn();

jest.mock("axios", () => ({
  __esModule: true,
  default: axiosMock,
}));

jest.mock("../../src/utils/redis", () => ({
  getRedisClient: getRedisClientMock,
  getRedisHealthSnapshot: getRedisHealthSnapshotMock,
}));

jest.mock("../../src/utils/db", () => ({
  pingDatabase: pingDatabaseMock,
}));

describe("monitoring health checks", () => {
  beforeEach(() => {
    jest.resetModules();
    axiosMock.mockReset();
    getRedisClientMock.mockReset();
    getRedisHealthSnapshotMock.mockReset();
    pingDatabaseMock.mockReset();

    delete process.env.TMD_UID_API;
    delete process.env.TMD_UKEY_API;
    delete process.env.TMD_UID;
    delete process.env.TMD_UKEY;
    delete process.env.GOOGLE_SEARCH_API_KEY;
    delete process.env.GOOGLE_SEARCH_CX;
    delete process.env.SERPAPI_API_KEY;
    process.env.BRAVE_SEARCH_API_KEY = "test-brave-key";

    axiosMock.mockImplementation(async (config: { url?: string }) => {
      const url = String(config?.url || "");
      if (url.includes("open-meteo")) {
        return { status: 200, statusText: "OK", data: { current: { temperature_2m: 31 } } };
      }
      if (url.includes("api.search.brave.com")) {
        return { status: 200, statusText: "OK", data: { web: { results: [] } } };
      }
      return { status: 200, statusText: "OK", data: {} };
    });

    let redisReady = false;
    getRedisClientMock.mockImplementation(async () => ({
      ping: jest.fn(async () => {
        redisReady = true;
        return "PONG";
      }),
    }));
    getRedisHealthSnapshotMock.mockImplementation(() =>
      redisReady
        ? {
            status: "ready",
            configured: true,
            ready: true,
            retryAfterMs: 0,
            rawStatus: "ready",
          }
        : {
            status: "disconnected",
            configured: true,
            ready: false,
            retryAfterMs: 0,
            rawStatus: "disconnected",
          }
    );
    pingDatabaseMock.mockResolvedValue(undefined);
  });

  it("createHealthResponse probes Redis and only checks configured upstream providers", async () => {
    const { createHealthResponse } = await import("../../src/utils/monitoring");

    const first = await createHealthResponse(false);
    const second = await createHealthResponse(false);

    expect(first.services).toEqual(second.services);
    expect(axiosMock).toHaveBeenCalledTimes(3);
    expect(getRedisClientMock).toHaveBeenCalledTimes(1);
    expect(getRedisHealthSnapshotMock).toHaveBeenCalledTimes(1);
    expect(pingDatabaseMock).toHaveBeenCalledTimes(1);

    const redisService = first.services.find((service: { name: string }) => service.name === "Redis");
    const dbService = first.services.find((service: { name: string }) => service.name === "Database");
    const tmdService = first.services.find((service: { name: string }) => service.name === "Weather API (TMD)");

    expect(redisService).toMatchObject({ status: "healthy" });
    expect(dbService).toMatchObject({ status: "healthy" });
    expect(tmdService).toMatchObject({ status: "unknown" });
  });
});