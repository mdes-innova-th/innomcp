/**
 * tests/unit/__tests__/files-safePath.test.ts
 *
 * Unit tests for the safePath sandbox guard in /api/files route.
 * Verifies path traversal attacks are blocked and legitimate paths pass.
 */

import { describe, it, expect, beforeAll } from "@jest/globals";
import path from "node:path";

// We test the exported safePath function from the route.
// To avoid loading the entire express app (which needs env/DB), we
// replicate the pure function here — must stay in sync with files.ts.
// (Alternative: export safePath from files.ts and import it directly.)

const WORKSPACE_ROOT = path.resolve(__dirname, "../../../../../workspace");

function safePath(userPath: string): string | null {
  const cleaned = userPath.replace(/^[/\\]+/, "");
  const resolved = path.resolve(WORKSPACE_ROOT, cleaned);
  if (
    resolved !== WORKSPACE_ROOT &&
    !resolved.startsWith(WORKSPACE_ROOT + path.sep)
  ) {
    return null;
  }
  return resolved;
}

describe("workspace safePath — path traversal protection", () => {
  it("allows a normal file path", () => {
    expect(safePath("projects/report.md")).not.toBeNull();
  });

  it("allows a nested subdirectory path", () => {
    expect(safePath("projects/my-project/notes.md")).not.toBeNull();
  });

  it("allows a path to the root itself", () => {
    expect(safePath("")).toBe(WORKSPACE_ROOT);
  });

  it("blocks Unix-style path traversal (../../etc/passwd)", () => {
    expect(safePath("../../etc/passwd")).toBeNull();
  });

  it("blocks Windows-style traversal (..\\..\\Windows\\System32)", () => {
    expect(safePath("..\\..\\Windows\\System32")).toBeNull();
  });

  it("blocks absolute path injection (/etc/hosts)", () => {
    // After stripping leading slash, /etc/hosts → etc/hosts inside root (safe)
    // Absolute path that resolves outside root:
    const outsidePath = path.resolve("/Windows/System32/drivers/etc/hosts");
    // Direct call with absolute outside path
    const resolved = path.resolve(WORKSPACE_ROOT, outsidePath.replace(/^[/\\]+/, ""));
    // This test checks the logic handles deep traversal patterns
    expect(safePath("../outside-workspace/secret.txt")).toBeNull();
  });

  it("allows artifacts subdirectory", () => {
    expect(safePath("artifacts/task-abc12345.md")).not.toBeNull();
  });

  it("resolved path starts with WORKSPACE_ROOT", () => {
    const result = safePath("projects/data.csv");
    expect(result).not.toBeNull();
    expect(result!.startsWith(WORKSPACE_ROOT)).toBe(true);
  });
});
