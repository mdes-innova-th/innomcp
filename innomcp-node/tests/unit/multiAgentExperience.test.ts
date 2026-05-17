import {
  getThinkingReportToneClass,
  resolveThinkingReportSummary,
} from "../../../innomcp-next/src/app/components/chat/multiAgentExperience";

describe("multi-agent thinking report UX contract", () => {
  test("keeps the report dormant before agents are spawned", () => {
    const summary = resolveThinkingReportSummary({
      streamStatus: "idle",
      agentCount: 0,
      doneCount: 0,
      recoveringCount: 0,
      errorCount: 0,
    });

    expect(summary.title).toBe("Thinking report");
    expect(summary.statusText).toBe("พร้อมทำงาน");
    expect(summary.digest).toContain("คำตอบหลัก");
    expect(summary.tone).toBe("ready");
  });

  test("describes a live thinking run as a unified answer handoff", () => {
    const summary = resolveThinkingReportSummary({
      streamStatus: "streaming",
      agentCount: 3,
      doneCount: 1,
      recoveringCount: 0,
      errorCount: 0,
    });

    expect(summary.statusText).toBe("1/3 เสร็จ");
    expect(summary.digest).toContain("ร้อยเป็นคำตอบเดียว");
    expect(summary.tone).toBe("working");
    expect(getThinkingReportToneClass(summary.tone)).toContain("emerald");
  });

  test("prioritizes remediation tone when an agent is recovering or blocked", () => {
    const recovering = resolveThinkingReportSummary({
      streamStatus: "streaming",
      agentCount: 3,
      doneCount: 1,
      recoveringCount: 1,
      errorCount: 0,
    });
    const blocked = resolveThinkingReportSummary({
      streamStatus: "streaming",
      agentCount: 3,
      doneCount: 1,
      recoveringCount: 0,
      errorCount: 1,
    });

    expect(recovering.tone).toBe("recovering");
    expect(recovering.digest).toContain("ไม่แตกคำตอบหลัก");
    expect(blocked.tone).toBe("blocked");
    expect(blocked.digest).toContain("ตรวจสอบได้");
  });
});
