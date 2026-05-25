import { assessRisk } from "../../src/services/riskDetector";

describe("assessRisk", () => {
  it("flags rm -rf as critical", () => expect(assessRisk("rm -rf /home").riskLevel).toBe("critical"));
  it("flags sudo as high", () => expect(assessRisk("sudo apt install").riskLevel).toBe("high"));
  it("flags npm install as medium", () => expect(assessRisk("npm install axios").riskLevel).toBe("medium"));
  it("allows safe read command", () => expect(assessRisk("cat file.txt").requiresApproval).toBe(false));
  it("flags file delete context", () => expect(assessRisk("", "file-delete").requiresApproval).toBe(true));
});
