import { readFileSync } from "fs";
import { join } from "path";

describe("Chat feedback migration", () => {
  const migrationPath = join(__dirname, "..", "..", "..", "mariadb", "migrations", "006_chat_feedback.sql");
  let sql = "";

  beforeAll(() => {
    sql = readFileSync(migrationPath, "utf8");
  });

  it("exists and is readable", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS chat_feedback");
  });

  it("defines the required chat_feedback columns", () => {
    expect(sql).toContain("message_id VARCHAR(64)");
    expect(sql).toContain("session_id VARCHAR(64)");
    expect(sql).toContain("rating ENUM('up','down')");
    expect(sql).toContain("user_id INT");
    expect(sql).toContain("query TEXT");
    expect(sql).toContain("response_summary TEXT");
    expect(sql).toContain("route VARCHAR(64)");
    expect(sql).toContain("tools_used VARCHAR(255)");
    expect(sql).toContain("created_at TIMESTAMP");
  });

  it("includes indexes for rating, created_at, and session_id", () => {
    expect(sql).toContain("INDEX idx_rating");
    expect(sql).toContain("INDEX idx_created_at");
    expect(sql).toContain("INDEX idx_session");
  });
});
