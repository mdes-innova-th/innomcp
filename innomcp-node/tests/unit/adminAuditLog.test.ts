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
