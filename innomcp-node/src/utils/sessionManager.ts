/**
 * Session Manager - จัดการ chat sessions และ context
 * ให้ AI จำประวัติการคุยได้
 */

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
}

interface ChatSession {
  sessionId: string;
  userId?: string;
  userAgent?: string;
  messages: ChatMessage[];
  metadata: {
    startedAt: Date;
    lastActiveAt: Date;
    messageCount: number;
    context?: Record<string, any>;
    // เพิ่ม status tracking
    status: 'idle' | 'responding' | 'completed' | 'error';
    responseStartTime?: Date;
    currentResponseDuration?: number;
    userEmotion?: string; // เก็บอารมณ์ user ล่าสุด
  };
}

class SessionManager {
  private sessions: Map<string, ChatSession> = new Map();
  private readonly MAX_SESSION_AGE = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_MESSAGES_PER_SESSION = 100;
  private readonly SUMMARY_THRESHOLD = 20; // Summarize when > 20 messages

  /**
   * Get existing session or create new one
   */
  getOrCreateSession(sessionId: string, userId?: string, userAgent?: string): ChatSession {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = {
        sessionId,
        userId,
        userAgent,
        messages: [],
        metadata: {
          startedAt: new Date(),
          lastActiveAt: new Date(),
          messageCount: 0,
          status: 'idle',
        },
      };
      this.sessions.set(sessionId, session);
      console.log(`[SessionManager] Created new session: ${sessionId}`);
    }

    return session;
  }

  /**
   * Update session status - เรียกก่อนเริ่มตอบ
   */
  startResponse(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata.status = 'responding';
      session.metadata.responseStartTime = new Date();
      console.log(`[SessionManager] Session ${sessionId} started responding`);
    }
  }

  /**
   * Complete response - เรียกหลังตอบเสร็จ
   */
  completeResponse(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata.status = 'completed';
      if (session.metadata.responseStartTime) {
        session.metadata.currentResponseDuration = 
          Date.now() - session.metadata.responseStartTime.getTime();
      }
      console.log(`[SessionManager] Session ${sessionId} completed (duration: ${session.metadata.currentResponseDuration}ms)`);
    }
  }

  /**
   * Update user emotion from message
   */
  updateUserEmotion(sessionId: string, emotion: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata.userEmotion = emotion;
      console.log(`[SessionManager] Updated emotion for ${sessionId}: ${emotion}`);
    }
  }

  /**
   * Add message to session
   */
  addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    toolsUsed?: string[]
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[SessionManager] Session not found: ${sessionId}`);
      return;
    }

    const message: ChatMessage = {
      role,
      content,
      timestamp: new Date(),
      toolsUsed,
    };

    session.messages.push(message);
    session.metadata.lastActiveAt = new Date();
    session.metadata.messageCount++;

    // Limit messages per session
    if (session.messages.length > this.MAX_MESSAGES_PER_SESSION) {
      session.messages = session.messages.slice(-this.MAX_MESSAGES_PER_SESSION);
    }

    console.log(`[SessionManager] Added ${role} message to session ${sessionId} (total: ${session.messages.length})`);
  }

  /**
   * Get recent messages for context
   */
  getRecentMessages(sessionId: string, count: number = 10): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    return session.messages.slice(-count);
  }

  /**
   * Get all messages in session
   */
  getAllMessages(sessionId: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    return session?.messages || [];
  }

  /**
   * Build context string for AI prompt
   */
  buildContextString(sessionId: string, includeCount: number = 10): string {
    const messages = this.getRecentMessages(sessionId, includeCount);

    if (messages.length === 0) {
      return '';
    }

    let context = '[ประวัติการคุยล่าสุด]\n';

    for (const msg of messages) {
      // Tools information is now displayed via ToolTypeBadge component in frontend
      // No need to include in context string
      context += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    }

    context += '\n';
    return context;
  }

  /**
   * Get session metadata
   */
  getSessionMetadata(sessionId: string): ChatSession['metadata'] | null {
    const session = this.sessions.get(sessionId);
    return session?.metadata || null;
  }

  /**
   * Update session context (custom data)
   */
  updateContext(sessionId: string, key: string, value: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    if (!session.metadata.context) {
      session.metadata.context = {};
    }

    session.metadata.context[key] = value;
  }

  /**
   * Get context value
   */
  getContext(sessionId: string, key: string): any {
    const session = this.sessions.get(sessionId);
    return session?.metadata.context?.[key];
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      console.log(`[SessionManager] Deleted session: ${sessionId}`);
    }
    return deleted;
  }

  /**
   * Prune old sessions (run periodically)
   */
  pruneOldSessions(): number {
    const now = Date.now();
    let prunedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now - session.metadata.lastActiveAt.getTime();

      if (age > this.MAX_SESSION_AGE) {
        this.sessions.delete(sessionId);
        prunedCount++;
        console.log(`[SessionManager] Pruned old session: ${sessionId} (age: ${Math.round(age / 3600000)}h)`);
      }
    }

    if (prunedCount > 0) {
      console.log(`[SessionManager] Pruned ${prunedCount} old sessions`);
    }

    return prunedCount;
  }

  /**
   * Get session statistics
   */
  getStats() {
    const totalSessions = this.sessions.size;
    let totalMessages = 0;
    let oldestSession: Date | null = null;
    let newestSession: Date | null = null;

    for (const session of this.sessions.values()) {
      totalMessages += session.messages.length;

      if (!oldestSession || session.metadata.startedAt < oldestSession) {
        oldestSession = session.metadata.startedAt;
      }

      if (!newestSession || session.metadata.startedAt > newestSession) {
        newestSession = session.metadata.startedAt;
      }
    }

    return {
      totalSessions,
      totalMessages,
      avgMessagesPerSession: totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0,
      oldestSession,
      newestSession,
    };
  }

  /**
   * Check if session needs summarization
   */
  needsSummarization(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    return session.messages.length > this.SUMMARY_THRESHOLD;
  }

  /**
   * Generate summary of old messages (placeholder - ใช้ AI summarize จริงทีหลัง)
   */
  async generateSummary(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session || session.messages.length < this.SUMMARY_THRESHOLD) {
      return '';
    }

    // TODO: ใช้ AI summarize จริง
    // ตอนนี้ใช้ simple summary
    const oldMessages = session.messages.slice(0, -10);
    const userMessages = oldMessages.filter(m => m.role === 'user').length;
    const toolsUsed = new Set<string>();

    for (const msg of oldMessages) {
      if (msg.toolsUsed) {
        msg.toolsUsed.forEach(tool => toolsUsed.add(tool));
      }
    }

    const summary = `ผู้ใช้ถามคำถาม ${userMessages} ข้อ ใช้ tools: ${Array.from(toolsUsed).join(', ')}`;
    
    return summary;
  }

  /**
   * Clear all sessions (for testing)
   */
  clearAll(): void {
    this.sessions.clear();
    console.log('[SessionManager] Cleared all sessions');
  }
}

// Singleton instance
export const sessionManager = new SessionManager();

// Auto-prune every 1 hour
setInterval(() => {
  sessionManager.pruneOldSessions();
}, 60 * 60 * 1000);

export default sessionManager;
