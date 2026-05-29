import { readFileSync } from "fs";
import { join } from "path";

describe("Admin audit log migration (007_admin_audit_log.sql)", () => {
  const migrationPath = join(
    __dirname,
    "..",
    "..",
    "..",
    "mariadb",
    "migrations",
    "007_admin_audit_log.sql"
  );
  let sql = "";

  beforeAll(() => {
    sql = readFileSync(migrationPath, "utf8");
  });

  it("creates the admin_audit_log table idempotently", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS admin_audit_log");
  });

  it("defines required columns", () => {
    expect(sql).toContain("admin_user_id INT NOT NULL");
    expect(sql).toContain("action VARCHAR(64) NOT NULL");
    expect(sql).toContain("target_user_id INT");
    expect(sql).toContain("meta JSON");
    expect(sql).toContain("created_at TIMESTAMP");
  });

  it("includes lookup indexes", () => {
    expect(sql).toContain("INDEX idx_admin");
    expect(sql).toContain("INDEX idx_target");
    expect(sql).toContain("INDEX idx_action");
    expect(sql).toContain("INDEX idx_created");
  });
});

describe("logAdminAction (utility)", () => {
  // Mock the db module before importing the audit log helper
  jest.mock("../../src/utils/db", () => ({
    withDbConnection: jest.fn(),
  }));

  const dbModule = jest.requireMock("../../src/utils/db") as {
    withDbConnection: jest.Mock;
  };

  // Re-import after the mock is registered
  const { logAdminAction } = jest.requireActual<
    typeof import("../../src/utils/adminAuditLog")
  >("../../src/utils/adminAuditLog");

  beforeEach(() => {
    dbModule.withDbConnection.mockReset();
  });

  it("invokes withDbConnection with insert payload", async () => {
    const execute = jest.fn().mockResolvedValue([{ affectedRows: 1 }]);
    dbModule.withDbConnection.mockImplementation(async (op: (c: unknown) => unknown) =>
      op({ execute })
    );

    await logAdminAction({
      adminUserId: 7,
      action: "user_role_change",
      targetUserId: 42,
      meta: { roleId: 2 },
    });

    expect(dbModule.withDbConnection).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
    const [sqlText, params] = execute.mock.calls[0];
    expect(sqlText).toContain("INSERT INTO admin_audit_log");
    expect(params).toEqual([7, "user_role_change", 42, JSON.stringify({ roleId: 2 })]);
  });

  it("serializes nullish targetUserId and meta to NULL", async () => {
    const execute = jest.fn().mockResolvedValue([{ affectedRows: 1 }]);
    dbModule.withDbConnection.mockImplementation(async (op: (c: unknown) => unknown) =>
      op({ execute })
    );

    await logAdminAction({ adminUserId: 1, action: "custom_action" });

    const [, params] = execute.mock.calls[0];
    expect(params).toEqual([1, "custom_action", null, null]);
  });

  it("swallows DB errors so the admin op never fails", async () => {
    dbModule.withDbConnection.mockRejectedValue(new Error("connection refused"));
    const consoleErr = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      logAdminAction({ adminUserId: 1, action: "user_active_change", targetUserId: 2 })
    ).resolves.toBeUndefined();

    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Route tests: GET /api/admin/audit-log
// ---------------------------------------------------------------------------

jest.mock("../../src/utils/jwt", () => ({
  authenticateToken: (req: any, _res: any, next: Function) => {
    req.user = { userId: 1, role: 0 };
    next();
  },
  requireRole: (_role: number) => (_req: any, _res: any, next: Function) => {
    next();
  },
}));

jest.mock("../../src/routes/api/admin/sessions", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const router = require("express").Router();
  return { __esModule: true, default: router };
});

import express from "express";
import request from "supertest";
import { withDbConnection } from "../../src/utils/db";

const mockWithDb = withDbConnection as jest.Mock;

describe("GET /api/admin/audit-log (route)", () => {
  let app: express.Express;

  beforeAll(async () => {
    const { default: adminRouter } = await import("../../src/routes/api/admin/index");
    app = express();
    app.use(express.json());
    app.use("/api/admin", adminRouter);
  });

  beforeEach(() => {
    mockWithDb.mockReset();
  });

  it("returns 200 with entries array and total", async () => {
    const fakeRows = [
      {
        id: 1,
        created_at: "2026-05-29T10:00:00.000Z",
        admin_user_id: 1,
        admin_email: "admin@example.com",
        action: "user_role_change",
        target_id: 2,
        details: JSON.stringify({ roleId: 1 }),
      },
      {
        id: 2,
        created_at: "2026-05-29T09:00:00.000Z",
        admin_user_id: 1,
        admin_email: "admin@example.com",
        action: "user_active_change",
        target_id: 3,
        details: JSON.stringify({ active: false }),
      },
    ];

    mockWithDb.mockImplementation(async (fn: Function) => {
      const queryMock = jest
        .fn()
        .mockResolvedValueOnce([fakeRows])
        .mockResolvedValueOnce([[{ total: 2 }]]);
      return fn({ query: queryMock });
    });

    const response = await request(app).get("/api/admin/audit-log");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.entries)).toBe(true);
    expect(response.body.entries).toHaveLength(2);
    expect(typeof response.body.total).toBe("number");
    expect(response.body.total).toBe(2);
  });

  it("each entry has id, timestamp, adminEmail, and action", async () => {
    const fakeRows = [
      {
        id: 42,
        created_at: "2026-05-29T12:00:00.000Z",
        admin_user_id: 1,
        admin_email: "superadmin@example.com",
        action: "user_role_change",
        target_id: 5,
        details: null,
      },
    ];

    mockWithDb.mockImplementation(async (fn: Function) => {
      const queryMock = jest
        .fn()
        .mockResolvedValueOnce([fakeRows])
        .mockResolvedValueOnce([[{ total: 1 }]]);
      return fn({ query: queryMock });
    });

    const response = await request(app).get("/api/admin/audit-log");

    expect(response.status).toBe(200);
    const entry = response.body.entries[0];
    expect(entry).toHaveProperty("id", 42);
    expect(entry).toHaveProperty("timestamp", "2026-05-29T12:00:00.000Z");
    expect(entry).toHaveProperty("adminEmail", "superadmin@example.com");
    expect(entry).toHaveProperty("action", "user_role_change");
  });

  it("respects limit query param", async () => {
    const fakeRows = [
      {
        id: 10,
        created_at: "2026-05-29T08:00:00.000Z",
        admin_user_id: 1,
        admin_email: "admin@example.com",
        action: "user_active_change",
        target_id: 9,
        details: null,
      },
    ];

    const capturedArgs: any[][] = [];

    mockWithDb.mockImplementation(async (fn: Function) => {
      const queryMock = jest.fn().mockImplementation((...args: any[]) => {
        capturedArgs.push(args);
        if (capturedArgs.length === 1) return Promise.resolve([fakeRows]);
        return Promise.resolve([[{ total: 50 }]]);
      });
      return fn({ query: queryMock });
    });

    const response = await request(app).get("/api/admin/audit-log?limit=5&offset=0");

    expect(response.status).toBe(200);
    // First query call params array should contain limit=5
    const firstCallParams = capturedArgs[0][1] as number[];
    expect(firstCallParams).toContain(5);
  });

  it("returns 500 with error on DB error (graceful — no crash)", async () => {
    mockWithDb.mockRejectedValue(new Error("DB connection failed"));

    const response = await request(app).get("/api/admin/audit-log");

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
  });
});
