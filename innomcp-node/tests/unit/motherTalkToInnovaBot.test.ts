/**
 * tests/unit/motherTalkToInnovaBot.test.ts
 */

export {}; // Force module mode

import express from "express";
import request from "supertest";
import fs from "fs";
import path from "path";
import os from "os";

let routerModule: typeof import("../../src/routes/api/motherTalkToInnovaBot");

beforeAll(async () => {
  // Point to a temp dir so we don't write to the real outbox
  process.env.INNOVA_BUS_PATH = path.join(os.tmpdir(), `innomcp-test-bus-${Date.now()}`);
  routerModule = await import("../../src/routes/api/motherTalkToInnovaBot");
});

afterAll(() => {
  // Clean up temp dir
  try { fs.rmSync(process.env.INNOVA_BUS_PATH!, { recursive: true, force: true }); } catch { /* ok */ }
  delete process.env.INNOVA_BUS_PATH;
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/mother/talk-to-innova-bot", routerModule.default);
  return app;
}

describe("POST /api/mother/talk-to-innova-bot", () => {
  it("returns 400 when message is missing", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/mother/talk-to-innova-bot").send({});
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it("returns 400 when message is empty string", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/mother/talk-to-innova-bot").send({ message: "  " });
    expect(res.status).toBe(400);
  });

  it("returns 200 with filename when message is valid", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/mother/talk-to-innova-bot")
      .send({ message: "Hello innova-bot from test!", from: "test" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.filename).toContain("innomcp-to-innova-");
    expect(res.body.filename).toMatch(/.md$/);
  });

  it("writes a file to the bus directory", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/mother/talk-to-innova-bot")
      .send({ message: "File write test" });
    expect(res.status).toBe(200);
    expect(fs.existsSync(res.body.filepath)).toBe(true);
  });

  it("written file contains message content", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/mother/talk-to-innova-bot")
      .send({ message: "unique-test-message-abc123" });
    const content = fs.readFileSync(res.body.filepath, "utf8");
    expect(content).toContain("unique-test-message-abc123");
    expect(content).toContain("from: innomcp");
  });
});
