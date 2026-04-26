import { readFileSync } from "fs";
import { join } from "path";

describe("pytest configuration", () => {
  const configPath = join(__dirname, "..", "..", "..", "pytest.ini");
  let content = "";

  beforeAll(() => {
    content = readFileSync(configPath, "utf8");
  });

  it("uses tests as the pytest root path", () => {
    expect(content).toMatch(/testpaths\s*=\s*tests/);
  });

  it("matches python test file patterns", () => {
    expect(content).toMatch(/python_files\s*=\s*test_\*\.py \*_test\.py/);
  });

  it("ignores .txt fixtures during collection", () => {
    expect(content).toContain("**/test-output.txt");
    expect(content).toContain("**/*.txt");
  });
});
