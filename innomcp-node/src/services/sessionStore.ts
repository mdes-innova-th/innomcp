import { promises as fs } from 'fs';
import path from 'path';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface PersistedSession {
  id: string;
  userId?: string;
  createdAt: number;
  lastActivity: number;
  preferences: Record<string, unknown>;
  stats: { messages: number; tokens: number };
}

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const SESSIONS_DIR = path.join(process.cwd(), 'workspace-storage', '.sessions');

// ------------------------------------------------------------------
// Helper: ensure storage directory exists
// ------------------------------------------------------------------

async function ensureDirectory(): Promise<void> {
  try {
    await fs.access(SESSIONS_DIR);
  } catch {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  }
}

// ------------------------------------------------------------------
// SessionStore
// ------------------------------------------------------------------

class SessionStore {
  /**
   * Persist a session to disk.
   */
  async save(session: PersistedSession): Promise<void> {
    await ensureDirectory();
    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
  }

  /**
   * Load a single session by ID. Returns null if not found.
   */
  async load(sessionId: string): Promise<PersistedSession | null> {
    await ensureDirectory();
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as PersistedSession;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err; // rethrow unexpected errors
    }
  }

  /**
   * Load all persisted sessions.
   */
  async loadAll(): Promise<PersistedSession[]> {
    await ensureDirectory();
    const files = await fs.readdir(SESSIONS_DIR);
    const sessions: PersistedSession[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const fullPath = path.join(SESSIONS_DIR, file);
      try {
        const raw = await fs.readFile(fullPath, 'utf-8');
        sessions.push(JSON.parse(raw) as PersistedSession);
      } catch {
        // skip corrupted files
      }
    }
    return sessions;
  }

  /**
   * Delete a session file by ID.
   */
  async delete(sessionId: string): Promise<void> {
    await ensureDirectory();
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    try {
      await fs.unlink(filePath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      // if file doesn't exist, it's already deleted – no error
    }
  }

  /**
   * Remove sessions older than `maxAgeDays` (default 30).
   * Returns the number of deleted sessions.
   */
  async cleanup(maxAgeDays = 30): Promise<number> {
    await ensureDirectory();
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const all = await this.loadAll();
    let deleted = 0;

    for (const session of all) {
      if (now - session.lastActivity > maxAgeMs) {
        try {
          await this.delete(session.id);
          deleted++;
        } catch {
          // ignore per-file errors, continue cleanup
        }
      }
    }
    return deleted;
  }

  /**
   * Aggregate statistics: total sessions, active in last 24h, total messages.
   */
  async stats(): Promise<{ total: number; active24h: number; totalMessages: number }> {
    const all = await this.loadAll();
    const now = Date.now();
    let total = all.length;
    let active24h = 0;
    let totalMessages = 0;
    for (const session of all) {
      if (now - session.lastActivity <= 24 * 60 * 60 * 1000) {
        active24h++;
      }
      totalMessages += session.stats.messages;
    }
    return { total, active24h, totalMessages };
  }
}

// ------------------------------------------------------------------
// Singleton instance
// ------------------------------------------------------------------

export const sessionStore = new SessionStore();