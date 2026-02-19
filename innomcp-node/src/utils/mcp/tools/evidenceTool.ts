
import { MCPTool } from "../types";
import { queryEvidence } from "../../db/evidenceConnection";

export const EVIDENCE_TOOL_NAME = "detect_evidence_stats";

export const EVIDENCE_TOOL_DEF: MCPTool = {
  name: EVIDENCE_TOOL_NAME,
  description: "Query statistics and status from the Evidence Database (detect). Supported intents: machine_status, pending_evidence, recent_threats.",
  category: "evidence",
  keywords: ["evidence", "threat", "nip", "record", "หลักฐาน", "คนร้าย", "สถานะเครื่อง", "cloud", "server"],
  examples: [
    "ขอสถานะเครื่อง server หน่อย",
    "มีหลักฐานอะไรค้างบ้าง",
    "ขอรายการ threat ล่าสุด 10 รายการ"
  ],
  inputSchema: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: ["machine_status", "active_evidence_machines", "evidence_records_today", "pending_evidence", "recent_threats"],
        description: "The specific query intent to execute."
      },
      limit: {
        type: "number",
        description: "Optional limit for results (default 10)"
      }
    },
    required: ["intent"]
  }
};

export async function handleEvidenceTool(args: any): Promise<any> {
    const { intent, limit = 10 } = args;

    try {
        let sql = "";
        let params: any[] = [];

        switch (intent) {
      case "machine_status":
                // A. Machine Status: Online machines
                sql = "SELECT * FROM machines WHERE is_online = 1";
                break;

            case "active_evidence_machines": // New intent for "active today"
                // Definition: Online machines (is_online=1).
                // If there's a 'type' column, we could filter by type='evidence'. 
                // For now, assume all machines in this DB are relevant.
                sql = "SELECT COUNT(*) as count FROM machines WHERE is_online = 1";
                break;

            case "evidence_records_today": // New intent for "records collected today"
                // Definition: Records created today in 'record' table.
                // Assuming 'create_date' column exists based on 'nip' table usage.
                sql = "SELECT COUNT(*) as count FROM record WHERE DATE(create_date) = CURDATE()";
                break;

            case "pending_evidence":
                // B. Pending Evidence: Created today AND (status_rec IS NULL or not in record table)
                // Interpretation: nip items created today that are not processed in 'record' table.
                // Assuming nip_no connects nip and record.
                sql = `
                    SELECT * FROM nip 
                    WHERE DATE(create_date) = CURDATE() 
                    AND (status_rec IS NULL OR nip_no NOT IN (SELECT nip_no FROM record))
                `;
                break;

            case "recent_threats":
                // C. Recent Threats: Latest NIP items
                sql = "SELECT * FROM nip ORDER BY create_date DESC LIMIT ?";
                params = [limit];
                break;

            default:
                return { 
                    error: `Unknown intent: ${intent}. Supported: machine_status, active_evidence_machines, evidence_records_today, pending_evidence, recent_threats` 
                };
        }

        const rows = await queryEvidence(sql, params);
        
        return {
            summary: `Executed ${intent} successfully. Found ${rows.length} records.`,
            data: rows,
            count: rows.length
        };

    } catch (error: any) {
        return {
            error: `Evidence Query Failed: ${error.message}`,
            details: error.stack
        };
    }
}
