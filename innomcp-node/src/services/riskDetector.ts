export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskAssessment {
  riskLevel: RiskLevel;
  reason: string;
  requiresApproval: boolean;
}

// Patterns that require approval
const CRITICAL_PATTERNS = [
  /rm\s+-rf?\s+[\/~]/i,
  /format\s+(c:|d:|\/dev\/)/i,
  /mkfs/i,
  /dd\s+if=/i,
  />\s*\/dev\/(sd|hd|vd)/i,
];

const HIGH_PATTERNS = [
  /rm\s+(-r|-f|-rf|-fr)/i,
  /del\s+\/[sf]/i,
  /rmdir\s+\/s/i,
  /chmod\s+777/i,
  /sudo\s+/i,
  /\|\s*sh\b/i,
  /curl.*\|\s*bash/i,
];

const MEDIUM_PATTERNS = [
  /rm\s+\S+/i,
  /del\s+\S+/i,
  /move\s+/i,
  /mv\s+.*\//i,
  /npm\s+install/i,
  /pip\s+install/i,
  /apt\s+install/i,
];

export function assessRisk(command: string, context?: string): RiskAssessment {
  if (CRITICAL_PATTERNS.some(p => p.test(command))) {
    return { riskLevel: "critical", reason: "คำสั่งนี้อาจทำลายข้อมูลสำคัญหรือระบบไฟล์", requiresApproval: true };
  }
  if (HIGH_PATTERNS.some(p => p.test(command))) {
    return { riskLevel: "high", reason: "คำสั่งนี้มีความเสี่ยงสูง — อาจลบหรือแก้ไขข้อมูลสำคัญ", requiresApproval: true };
  }
  if (MEDIUM_PATTERNS.some(p => p.test(command))) {
    return { riskLevel: "medium", reason: "คำสั่งนี้แก้ไขไฟล์หรือ install package", requiresApproval: true };
  }
  // File deletion via API
  if (context === "file-delete") {
    return { riskLevel: "medium", reason: "การลบไฟล์ไม่สามารถย้อนกลับได้", requiresApproval: true };
  }
  return { riskLevel: "low", reason: "", requiresApproval: false };
}
