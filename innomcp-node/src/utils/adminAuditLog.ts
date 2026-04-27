// Phase 3: Admin action audit log — DB-backed, table created in migration 007.
// Failure to write must NEVER fail the user-facing admin action; we log and swallow.

import { withDbConnection } from "./db";

export type AdminAuditAction =
  | "user_role_change"
  | "user_active_change"
  | "user_status_change"
  | string;

export interface AdminAuditEntry {
  adminUserId: number;
  action: AdminAuditAction;
  targetUserId?: number | null;
  meta?: Record<string, unknown>;
}

export async function logAdminAction(entry: AdminAuditEntry): Promise<void> {
  try {
    await withDbConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO admin_audit_log (admin_user_id, action, target_user_id, meta)
         VALUES (?, ?, ?, ?)`,
        [
          entry.adminUserId,
          entry.action,
          entry.targetUserId ?? null,
          entry.meta ? JSON.stringify(entry.meta) : null,
        ]
      );
    });
  } catch (err) {
    // Audit failures must not break the admin operation. Surface to console only.
    console.error("[adminAuditLog] failed to persist entry:", err);
  }
}
