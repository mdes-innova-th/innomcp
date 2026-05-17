import type { StreamStatus } from "./useAgentEventStream";

export type ThinkingReportTone = "ready" | "working" | "recovering" | "blocked" | "complete";

export interface ThinkingReportSummaryInput {
  streamStatus: StreamStatus;
  agentCount: number;
  doneCount: number;
  recoveringCount: number;
  errorCount: number;
}

export interface ThinkingReportSummary {
  title: string;
  statusText: string;
  digest: string;
  tone: ThinkingReportTone;
}

export function resolveThinkingReportSummary(input: ThinkingReportSummaryInput): ThinkingReportSummary {
  const { streamStatus, agentCount, doneCount, recoveringCount, errorCount } = input;

  if (agentCount === 0) {
    return {
      title: "Thinking report",
      statusText: streamStatus === "streaming" ? "กำลังเรียกทีม" : "พร้อมทำงาน",
      digest: "คำตอบหลักจะยังรวมเป็นข้อความเดียว ส่วนบันทึกทีมเปิดดูได้เมื่อจำเป็น",
      tone: streamStatus === "streaming" ? "working" : "ready",
    };
  }

  if (errorCount > 0) {
    return {
      title: "Thinking report",
      statusText: "สำรองช่องทาง",
      digest: "บางตัวแทนสลับช่องทางสำรอง คำตอบหลักยังรวมข้อมูลที่ตรวจสอบได้ครบ",
      tone: "recovering",
    };
  }

  if (recoveringCount > 0) {
    return {
      title: "Thinking report",
      statusText: `กำลังสำรอง ${recoveringCount}`,
      digest: "ทีมกำลังสลับทางเรียกโมเดลหรือเครื่องมือ โดยไม่แตกคำตอบหลักเป็นหลายช่อง",
      tone: "recovering",
    };
  }

  if (streamStatus === "streaming") {
    return {
      title: "Thinking report",
      statusText: `${doneCount}/${agentCount} เสร็จ`,
      digest: `ลูกทีม ${agentCount} ตัวกำลังตรวจข้อมูลและส่งต่อให้บริกรร้อยเป็นคำตอบเดียว`,
      tone: "working",
    };
  }

  return {
    title: "Thinking report",
    statusText: "เสร็จแล้ว",
    digest: `เก็บบันทึกจากลูกทีม ${agentCount} ตัวไว้ใต้คำตอบเดียว`,
    tone: "complete",
  };
}

export function getThinkingReportToneClass(tone: ThinkingReportTone): string {
  switch (tone) {
    case "working":
      return "text-emerald-700 dark:text-emerald-300";
    case "recovering":
      return "text-amber-700 dark:text-amber-300";
    case "blocked":
      return "text-rose-700 dark:text-rose-300";
    case "complete":
      return "text-sky-700 dark:text-sky-300";
    default:
      return "text-slate-600 dark:text-slate-300";
  }
}
