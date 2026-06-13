<!-- cc-team deliverable
 group: G1 (SEARCH/REPLACE fixes from security)
 member: FX-019 role=fix2 model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":2106,"completion_tokens":7909,"total_tokens":10015,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":6066,"image_tokens":0},"cache_creation_input_tokens":0} | 72s
 generated: 2026-06-13T11:44:10.291Z -->
FILE: innomcp-node/src/services/sessionStore.ts
<<<<<<< SEARCH
async function ensureDirectory(): Promise<void> {
  try {
    await fs.access(SESSIONS_DIR);
  } catch {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  }
}

// ------------------------------------------------------------------
// SessionStore
=======
async function ensureDirectory(): Promise<void> {
  try {
    await fs.access(SESSIONS_DIR);
  } catch {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  }
}

/**
 * Validate session ID: only allow alphanumeric, hyphens, underscores.
 */
function validateId(rawId: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(rawId)) {
    throw new Error(`Invalid session ID: "${rawId}"`);
  }
}

/**
 * Sanitize preferences: remove dangerous keys (__proto__, constructor, prototype).
 */
function sanitizePreferences(prefs: Record<string, unknown>): Record<string, unknown> {
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  const clean: Record<string, unknown> = {};
  for (const key of Object.keys(prefs)) {
    if (!dangerousKeys.includes(key)) {
      clean[key] = prefs[key];
    }
  }
  return clean;
}

// ------------------------------------------------------------------
// SessionStore
>>>>>>> REPLACE

FILE: innomcp-node/src/services/sessionStore.ts
<<<<<<< SEARCH
  async save(session: PersistedSession): Promise<void> {
    await ensureDirectory();
    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
  }
=======
  async save(session: PersistedSession, actorUserId?: string): Promise<void> {
    validateId(session.id);
    if (actorUserId && session.userId && session.userId !== actorUserId) {
      throw new Error('Unauthorized: cannot save another user\'s session');
    }
    await ensureDirectory();
    const cleanSession = {
      ...session,
      preferences: sanitizePreferences(session.preferences),
    };
    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(cleanSession, null, 2), 'utf-8');
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/sessionStore.ts
<<<<<<< SEARCH
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
=======
  async load(sessionId: string, actorUserId?: string): Promise<PersistedSession | null> {
    validateId(sessionId);
    await ensureDirectory();
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const session = JSON.parse(raw) as PersistedSession;
      if (actorUserId && session.userId && session.userId !== actorUserId) {
        throw new Error('Unauthorized: cannot load another user\'s session');
      }
      return session;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw new Error('Failed to read session');
    }
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/sessionStore.ts
<<<<<<< SEARCH
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
=======
  async delete(sessionId: string, actorUserId?: string): Promise<void> {
    validateId(sessionId);
    await ensureDirectory();
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    // Check ownership before deletion
    if (actorUserId) {
      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        const session = JSON.parse(raw) as PersistedSession;
        if (session.userId && session.userId !== actorUserId) {
          throw new Error('Unauthorized: cannot delete another user\'s session');
        }
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          throw new Error('Failed to verify session ownership');
        }
        // If file not found, it's fine to proceed
      }
    }
    try {
      await fs.unlink(filePath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw new Error('Failed to delete session');
      }
      // if file doesn't exist, it's already deleted – no error
    }
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/sessionStore.ts
<<<<<<< SEARCH
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
=======
  async loadAll(actorUserId?: string): Promise<PersistedSession[]> {
    try {
      await ensureDirectory();
      const files = await fs.readdir(SESSIONS_DIR);
      const sessions: PersistedSession[] = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const fullPath = path.join(SESSIONS_DIR, file);
        try {
          const raw = await fs.readFile(fullPath, 'utf-8');
          const session = JSON.parse(raw) as PersistedSession;
          if (actorUserId && session.userId && session.userId !== actorUserId) {
            continue; // skip sessions that don't belong to the user
          }
          sessions.push(session);
        } catch {
          // skip corrupted files
        }
      }
      return sessions;
    } catch (err: any) {
      throw new Error('Failed to load sessions');
    }
  }
>>>>>>> REPLACE

FILE: innomcp-node/src/services/sessionStore.ts
<<<<<<< SEARCH
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
=======
  async stats(actorUserId?: string): Promise<{ total: number; active24h: number; totalMessages: number }> {
    const all = await this.loadAll(actorUserId);
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
>>>>>>> REPLACE
