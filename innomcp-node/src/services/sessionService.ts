interface SessionData {
  id: string;
  createdAt: number;
  lastActivity: number;
  userId?: string;
  isGuest: boolean;
  preferences: {
    model?: string;
    chatMode?: string;
    providerMode?: string;
  };
  stats: {
    messageCount: number;
    toolUseCount: number;
    totalTokens: number;
  };
  metadata: Record<string, unknown>;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Simple fallback for environments without crypto.randomUUID
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

class SessionService {
  private readonly sessions = new Map<string, SessionData>();

  /**
   * Creates a new session with defaults merged with the provided options.
   */
  create(options?: Partial<SessionData>): SessionData {
    const now = Date.now();
    const id = options?.id ?? generateId();

    const session: SessionData = {
      id,
      createdAt: now,
      lastActivity: now,
      isGuest: false,
      ...options,
      preferences: {
        model: undefined,
        chatMode: undefined,
        providerMode: undefined,
        ...(options?.preferences || {}),
      },
      stats: {
        messageCount: 0,
        toolUseCount: 0,
        totalTokens: 0,
        ...(options?.stats || {}),
      },
      metadata: {
        ...(options?.metadata || {}),
      },
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Retrieves a session by ID, or `undefined` if not found.
   */
  get(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Updates an existing session with a partial object.
   * Nested objects (preferences, stats, metadata) are merged shallowly.
   * @throws If session does not exist.
   */
  update(sessionId: string, updates: Partial<SessionData>): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    if (updates.userId !== undefined) session.userId = updates.userId;
    if (updates.isGuest !== undefined) session.isGuest = updates.isGuest;
    if (updates.lastActivity !== undefined) session.lastActivity = updates.lastActivity;
    if (updates.preferences) {
      session.preferences = { ...session.preferences, ...updates.preferences };
    }
    if (updates.stats) {
      session.stats = { ...session.stats, ...updates.stats };
    }
    if (updates.metadata) {
      session.metadata = { ...session.metadata, ...updates.metadata };
    }
  }

  /**
   * Removes a session by ID.
   * @throws If session does not exist.
   */
  delete(sessionId: string): void {
    if (!this.sessions.delete(sessionId)) {
      throw new Error(`Session ${sessionId} not found`);
    }
  }

  /**
   * Updates the `lastActivity` timestamp of a session to now.
   * @throws If session does not exist.
   */
  touch(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    session.lastActivity = Date.now();
  }

  /**
   * Removes sessions that have been idle for more than `maxIdleMs` milliseconds.
   * Default idle timeout is 30 minutes.
   * @returns Number of removed sessions.
   */
  cleanup(maxIdleMs?: number): number {
    const now = Date.now();
    const threshold = maxIdleMs ?? 30 * 60 * 1000; // 30 minutes default
    let removed = 0;

    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > threshold) {
        this.sessions.delete(id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Returns a snapshot of all currently stored sessions.
   */
  getActive(): SessionData[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Returns the total number of active sessions.
   */
  count(): number {
    return this.sessions.size;
  }

  /**
   * Increments the message count and optionally adds to the total token count.
   * @throws If session does not exist.
   */
  addMessageStat(sessionId: string, tokens?: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    session.stats.messageCount++;
    if (tokens !== undefined) {
      session.stats.totalTokens += tokens;
    }
  }

  /**
   * Increments the tool usage count for a session.
   * @throws If session does not exist.
   */
  addToolStat(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    session.stats.toolUseCount++;
  }
}

export const sessionService = new SessionService();