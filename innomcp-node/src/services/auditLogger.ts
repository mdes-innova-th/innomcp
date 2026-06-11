import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const LOG_DIR = path.join(process.cwd(), 'logs');
const AUDIT_FILE = path.join(LOG_DIR, 'audit.jsonl');

type AuditAction = 'login' | 'logout' | 'message_sent' | 'file_access' | 'provider_change' | 'admin_action' | 'data_export';

interface AuditEntry {
  id: string;
  timestamp: number;
  action: AuditAction;
  sessionId?: string;
  userId?: string;
  ipAddress?: string;
  details: Record<string, unknown>;
  success: boolean;
  error?: string;
}

type AuditEntryInput = Omit<AuditEntry, 'id' | 'timestamp'>;

interface AuditFilter {
  action?: AuditAction;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

class AuditLogger {
  private lastDate: string | null = null;

  private ensureLogDir(): void {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  }

  private getDateString(date: Date = new Date()): string {
    return date.toISOString().slice(0, 10);
  }

  private rotateIfNeeded(): void {
    const today = this.getDateString();

    // If lastDate not set, determine from existing file
    if (this.lastDate === null) {
      try {
        const stat = fs.statSync(AUDIT_FILE);
        const mtimeDate = this.getDateString(stat.mtime);
        if (mtimeDate === today) {
          this.lastDate = today;
          return;
        } else {
          // Rotate old file
          const rotatedName = `audit-${mtimeDate}.jsonl`;
          fs.renameSync(AUDIT_FILE, path.join(LOG_DIR, rotatedName));
          this.lastDate = today;
        }
      } catch {
        // File doesn't exist or error – just start fresh
        this.lastDate = today;
      }
    } else if (this.lastDate !== today) {
      // Rotate previous day file
      const rotatedName = `audit-${this.lastDate}.jsonl`;
      try {
        fs.renameSync(AUDIT_FILE, path.join(LOG_DIR, rotatedName));
      } catch {
        // Ignore if file not found
      }
      this.lastDate = today;
    }
  }

  log(entry: AuditEntryInput): void {
    this.ensureLogDir();
    this.rotateIfNeeded();

    const auditEntry: AuditEntry = {
      id: randomUUID(),
      timestamp: Date.now(),
      ...entry,
    };

    const line = JSON.stringify(auditEntry) + '\n';

    try {
      fs.appendFileSync(AUDIT_FILE, line, 'utf-8');
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }

  getEntries(filter?: AuditFilter): AuditEntry[] {
    const entries: AuditEntry[] = [];
    const files = this.getAllAuditFiles();

    for (const file of files) {
      const lines = this.readLines(file);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as AuditEntry;
          if (this.matchesFilter(entry, filter)) {
            entries.push(entry);
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    if (filter?.limit && entries.length > filter.limit) {
      return entries.slice(0, filter.limit);
    }
    return entries;
  }

  exportCSV(): string {
    const entries = this.getEntries();
    const headers = ['id', 'timestamp', 'action', 'sessionId', 'userId', 'ipAddress', 'details', 'success', 'error'];
    const csvRows = [headers.join(',')];

    for (const entry of entries) {
      const row = [
        this.escapeCsv(entry.id),
        entry.timestamp.toString(),
        this.escapeCsv(entry.action),
        this.escapeCsv(entry.sessionId ?? ''),
        this.escapeCsv(entry.userId ?? ''),
        this.escapeCsv(entry.ipAddress ?? ''),
        this.escapeCsv(JSON.stringify(entry.details)),
        entry.success ? 'true' : 'false',
        this.escapeCsv(entry.error ?? ''),
      ];
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  exportJSON(): string {
    const entries = this.getEntries();
    return JSON.stringify(entries, null, 2);
  }

  clear(beforeTimestamp?: number): number {
    const files = this.getAllAuditFiles();
    let totalRemoved = 0;

    for (const file of files) {
      const lines = this.readLines(file);
      const keptLines: string[] = [];
      let removedCount = 0;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as AuditEntry;
          if (beforeTimestamp !== undefined && entry.timestamp >= beforeTimestamp) {
            keptLines.push(line);
          } else {
            removedCount++;
          }
        } catch {
          // If malformed, keep the line (or discard? Better to keep)
          keptLines.push(line);
        }
      }

      if (keptLines.length === 0) {
        // Remove empty file
        try {
          fs.unlinkSync(file);
        } catch {
          // Ignore
        }
      } else {
        // Rewrite file with kept lines
        try {
          fs.writeFileSync(file, keptLines.join('\n') + (keptLines.length > 0 ? '\n' : ''), 'utf-8');
        } catch {
          // Ignore
        }
      }
      totalRemoved += removedCount;
    }

    return totalRemoved;
  }

  // ---------- Private helpers ----------

  private getAllAuditFiles(): string[] {
    try {
      const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith('audit') && f.endsWith('.jsonl'));
      return files.map(f => path.join(LOG_DIR, f)).sort();
    } catch {
      return [];
    }
  }

  private readLines(file: string): string[] {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      return content.split('\n').filter(line => line.trim() !== '');
    } catch {
      return [];
    }
  }

  private matchesFilter(entry: AuditEntry, filter?: AuditFilter): boolean {
    if (!filter) return true;

    if (filter.action && entry.action !== filter.action) return false;
    if (filter.startTime !== undefined && entry.timestamp < filter.startTime) return false;
    if (filter.endTime !== undefined && entry.timestamp > filter.endTime) return false;
    return true;
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

export const auditLogger = new AuditLogger();