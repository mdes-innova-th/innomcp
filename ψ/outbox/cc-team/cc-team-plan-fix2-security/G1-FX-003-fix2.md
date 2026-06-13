<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-003 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2557,"completion_tokens":5069,"total_tokens":7626,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":3319,"image_tokens":0},"cache_creation_input_tokens":0} | 46s
 generated: 2026-06-13T11:32:05.776Z -->
FILE: innomcp-node/src/services/auditLogger.ts
<<<<<<< SEARCH
  private lastDate: string | null = null;
=======
  private lastDate: string | null = null;

  private authorizer?: () => boolean;

  setAuthorizer(auth: () => boolean): void {
    this.authorizer = auth;
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/auditLogger.ts
<<<<<<< SEARCH
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
=======
  getEntries(filter?: AuditFilter): AuditEntry[] {
    if (this.authorizer && !this.authorizer()) throw new Error('Unauthorized');
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
>>>>>>> REPLACE

FILE: innomcp-node/src/services/auditLogger.ts
<<<<<<< SEARCH
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
=======
  exportCSV(): string {
    if (this.authorizer && !this.authorizer()) throw new Error('Unauthorized');
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
>>>>>>> REPLACE

FILE: innomcp-node/src/services/auditLogger.ts
<<<<<<< SEARCH
  exportJSON(): string {
    const entries = this.getEntries();
    return JSON.stringify(entries, null, 2);
  }
=======
  exportJSON(): string {
    if (this.authorizer && !this.authorizer()) throw new Error('Unauthorized');
    const entries = this.getEntries();
    return JSON.stringify(entries, null, 2);
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/auditLogger.ts
<<<<<<< SEARCH
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
=======
  clear(beforeTimestamp?: number): number {
    if (this.authorizer && !this.authorizer()) throw new Error('Unauthorized');
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
>>>>>>> REPLACE

FILE: innomcp-node/src/services/auditLogger.ts
<<<<<<< SEARCH
  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
=======
  private escapeCsv(value: string): string {
    // Prevent CSV injection by prefixing a single quote to formula triggers
    if (value.startsWith('=') || value.startsWith('+') || value.startsWith('-') || value.startsWith('@')) {
      value = "'" + value;
    }
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
>>>>>>> REPLACE
