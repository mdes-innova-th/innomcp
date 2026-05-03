import express from "express";
import request from "supertest";

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

type AiModeModule = typeof import("../../src/routes/api/aiMode");

const envKeys = [
  "AI_MODE",
  "LOCAL_OLLAMA_BASE_URL",
  "REMOTE_OLLAMA_BASE_URL",
  "LOCAL_OLLAMA_MODEL",
  "REMOTE_OLLAMA_MODEL",
  "OLLAMA_BASE_URL",
  "OLLAMA_HOST",
  "OLLAMA_MODEL",
  "OLLAMA_REMOTE_URL",
  "AI_MODEL",
] as const;

const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function restoreEnv(): void {
  for (const key of envKeys) {
    const value = originalEnv[key];
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function makeApp(router: AiModeModule["default"]) {
  const app = express();
  app.use(express.json());
  app.use("/api/ai-mode", router);
  return app;
}

describe("ai mode route config aliases", () => {
  beforeEach(() => {
    jest.resetModules();
    restoreEnv();
  });

  afterAll(() => {
    restoreEnv();
  });

  it("GET /api/ai-mode resolves local and remote URLs from alias env vars", async () => {
    process.env.AI_MODE = "remote";
    delete process.env.LOCAL_OLLAMA_BASE_URL;
    delete process.env.REMOTE_OLLAMA_BASE_URL;
    process.env.OLLAMA_BASE_URL = "http://local-alias:11434";
    process.env.OLLAMA_REMOTE_URL = "https://remote-alias.example.com";
    process.env.OLLAMA_MODEL = "qwen2.5:14b";

    const { default: aiModeRouter } = await import("../../src/routes/api/aiMode");
    const response = await request(makeApp(aiModeRouter)).get("/api/ai-mode");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      mode: "remote",
      config: {
        localUrl: "http://local-alias:11434",
        remoteUrl: "https://remote-alias.example.com",
        localModel: "qwen2.5:14b",
      },
    });
  });

  it("POST /api/ai-mode does not warn when remote alias env is configured", async () => {
    process.env.AI_MODE = "local";
    delete process.env.REMOTE_OLLAMA_BASE_URL;
    process.env.OLLAMA_REMOTE_URL = "https://remote-alias.example.com";

    const loggerModule = await import("../../src/utils/logger");
    const logger = loggerModule.default as unknown as {
      warn: jest.Mock;
    };
    const { default: aiModeRouter } = await import("../../src/routes/api/aiMode");

    const response = await request(makeApp(aiModeRouter))
      .post("/api/ai-mode")
      .send({ mode: "remote" });

    expect(response.status).toBe(200);
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("remote Ollama URL is not configured")
    );
  });
});