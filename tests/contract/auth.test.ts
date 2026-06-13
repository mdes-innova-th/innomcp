import { test, describe, it } from "node:test";
import assert from "node:assert/strict";

const API_BASE = process.env.API_BASE || "http://localhost:3015";

async function isServerReachable(): Promise<boolean> {
  try {
    const res = await fetch(API_BASE, { method: "HEAD", signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}

const serverReachable = await isServerReachable();

if (!serverReachable) {
  test.skip(`Server at ${API_BASE} is unreachable – skipping all tests`);
} else {
  describe("Authentication contract", () => {
    it("POST /api/auth/login with bad credentials returns 4xx + JSON error", async () => {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "invalid", password: "invalid" }),
      });

      assert.ok(res.status >= 400 && res.status < 500, `Expected 4xx, got ${res.status}`);
      assert.notStrictEqual(res.status, 500, "Got 500 Internal Server Error");

      const body = await res.json();
      assert.ok(typeof body === "object" && body !== null, "Response body must be a JSON object");
      assert.ok("error" in body || "message" in body, "JSON response should contain an error or message field");
    });

    it("GET /api/auth/me without cookie returns 401", async () => {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: "GET",
      });

      assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
      assert.notStrictEqual(res.status, 500, "Got 500 Internal Server Error");

      const body = await res.json();
      assert.ok(typeof body === "object" && body !== null, "Response body must be a JSON object");
    });
  });
}
