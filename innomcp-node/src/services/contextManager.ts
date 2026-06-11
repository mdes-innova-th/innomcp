```ts
/**
 * ContextManager - manages conversation context windows for innomcp-node.
 *
 * Provides session-based storage, token estimation, trimming strategies,
 * and automatic cleanup of idle sessions.
 */

/** Role of a message in the conversation */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** A single message in a conversation session */
export interface Message {
  role: MessageRole;
  content: string;
  /** Unix timestamp in milliseconds (set automatically if omitted) */
  timestamp?: number;
  /** Pre-calculated token count (if available) */
  tokens?: number;
}

/** Statistics for a conversation session */
export interface SessionStats {
  /** Total number of messages in the session */
  messageCount: number;
  /** Sum of estimated tokens for all messages */
  totalTokens: number;
  /** Timestamp of the oldest message (0 if empty) */
  oldestMessage: number;
  /** Timestamp of the newest message (0 if empty) */
  newestMessage: number;
}

/**
 * Default maximum number of messages per session.
 * Exceeding this limit will automatically drop the oldest messages,
 * while preserving system messages.
 */
const MAX_MESSAGES_PER_SESSION = 200;

/**
 * Session time-to-live in milliseconds (2 hours).
 * Sessions with no activity for this duration are automatically removed.
 */
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Token estimation heuristic: approximately 4 characters per token.
 */
const CHARS_PER_TOKEN = 4;

/**
 * Threshold (as a fraction of maxTokens) at which a warning is logged
 * about high context utilisation.
 */
const TOKEN_USAGE_WARNING_RATIO = 0.8;

export default class ContextManager {
  private static instance: ContextManager | null = null;
  private sessions: Map<string, Message[]>;
  private lastActivity: Map<string, number>;

  private constructor() {
    this.sessions = new Map();
    this.lastActivity = new Map();
  }

  /**
   * Returns the singleton instance of ContextManager.
   * Creates it on first call.
   */
  static getInstance(): ContextManager {
    if (!ContextManager.instance) {
      ContextManager.instance = new ContextManager();
    }
    return ContextManager.instance;
  }

  /**
   * Adds a message to a conversation session.
   * Automatically enforces the maximum message limit (200 messages),
   * dropping oldest non-system messages if necessary.
   * Updates the session's last-activity timestamp.
   *
   * @param sessionId - Unique identifier for the session.
   * @param msg - Message to add (timestamp defaults to Date.now()).
   */
  addMessage(sessionId: string, msg: Message): void {
    this.cleanExpiredSessions();

    const messages = this.sessions.get(sessionId) ?? [];
    const newMessage: Message = {
      ...msg,
      timestamp: msg.timestamp ?? Date.now(),
    };
    messages.push(newMessage);

    // Enforce maximum message count
    if (messages.length > MAX_MESSAGES_PER_SESSION) {
      this.sessions.set(sessionId, this.limitMessageCount(messages));
    } else {
      this.sessions.set(sessionId, messages);
    }

    this.lastActivity.set(sessionId, Date.now());
  }

  /**
   * Retrieves messages for a session, optionally trimmed to fit within a token budget.
   * If the session does not exist or has expired, an empty array is returned.
   *
   * @param sessionId - The session identifier.
   * @param maxTokens - (Optional) Maximum allowed tokens. If provided, messages
   *                    will be trimmed from oldest to newest, preserving system messages.
   * @returns Array of messages, possibly trimmed.
   */
  getContext(sessionId: string, maxTokens?: number): Message[] {
    this.cleanExpiredSessions();

    const messages = this.sessions.get(sessionId);
    if (!messages || messages.length === 0) {
      return [];
    }

    if (maxTokens !== undefined) {
      const trimmed = this.trimContext(messages, maxTokens);
      const currentTokens = ContextManager.estimateTotalTokens(trimmed);
      if (currentTokens > TOKEN_USAGE_WARNING_RATIO * maxTokens) {
        console.warn(
          `คำเตือน: บริบทการสนทนาสำหรับเซสชัน ${sessionId} ใช้โทเค็น ${currentTokens} จากขีดจำกัด ${maxTokens} (>${Math.round(TOKEN_USAGE_WARNING_RATIO * 100)}%) อาจจะต้องทำการบีบอัดเพิ่มเติม`
        );
      }
      return trimmed;
    }

    return messages;
  }

  /**
   * Trims an array of messages to fit within a token budget.
   * The algorithm keeps all system messages and then fills the remaining
   * tokens with the most recent non‑system messages, skipping older ones.
   *
   * @param messages - The original messages.
   * @param maxTokens - Maximum allowed tokens.
   * @returns A new array of trimmed messages (original is not mutated).
   */
  trimContext(messages: Message[], maxTokens: number): Message[] {
    if (messages.length === 0) return [];

    const systemMessages: Message[] = [];
    const otherMessages: Message[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessages.push(msg);
      } else {
        otherMessages.push(msg);
      }
    }

    const systemTokens = ContextManager.estimateTotalTokens(systemMessages);
    let remainingBudget = maxTokens - systemTokens;
    if (remainingBudget <= 0) {
      // Even system messages exceed the budget – keep them all (soft limit)
      return [...systemMessages];
    }

    // Walk from the most recent non‑system message backwards
    const keptOther: Message[] = [];
    let used = 0;
    for (let i = otherMessages.length - 1; i >= 0; i--) {
      const tokenCount = this.getTokenCount(otherMessages[i]);
      if (used + tokenCount > remainingBudget) {
        break; // stop adding earlier messages
      }
      keptOther.unshift(otherMessages[i]); // restore original order
      used += tokenCount;
    }

    return [...systemMessages, ...keptOther];
  }

  /**
   * Estimates the number of tokens in a text string.
   * Uses a fast heuristic: 1 token ≈ 4 characters (rounding up).
   *
   * @param text - Input string.
   * @returns Estimated token count.
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Clears all messages for a given session and removes its metadata.
   * If the session does not exist, this is a no‑op.
   *
   * @param sessionId - The session identifier.
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.lastActivity.delete(sessionId);
  }

  /**
   * Returns the number of **active** (non‑expired) sessions.
   */
  sessionCount(): number {
    this.cleanExpiredSessions();
    return this.sessions.size;
  }

  /**
   * Computes statistics for a given session.
   * If the session does not exist or has expired, returns an empty stats object
   * (all fields zeroed).
   *
   * @param sessionId - The session identifier.
   * @returns Session statistics.
   */
  getSessionStats(sessionId: string): SessionStats {
    this.cleanExpiredSessions();

    const messages = this.sessions.get(sessionId);
    if (!messages || messages.length === 0) {
      return {
        messageCount: 0,
        totalTokens: 0,
        oldestMessage: 0,
        newestMessage: 0,
      };
    }

    let totalTokens = 0;
    let oldest = Number.POSITIVE_INFINITY;
    let newest = 0;

    for (const msg of messages) {
      totalTokens += this.getTokenCount(msg);
      const ts = msg.timestamp ?? 0;
      if (ts < oldest) oldest = ts;
      if (ts > newest) newest = ts;
    }

    return {
      messageCount: messages.length,
      totalTokens,
      oldestMessage: oldest === Number.POSITIVE_INFINITY ? 0 : oldest,
      newestMessage: newest,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Removes any session that has been idle longer than the configured TTL.
   */
  private cleanExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, last] of this.lastActivity.entries()) {
      if (now - last > SESSION_TTL_MS) {
        this.sessions.delete(sessionId);
        this.lastActivity.delete(sessionId);
      }
    }
  }

  /**
   * Reduces the message array to at most MAX_MESSAGES_PER_SESSION messages,
   * preserving all system messages and dropping the oldest non‑system messages
   * first. The original array is not mutated.
   *
   * @param messages - The full message array (may exceed the limit).
   * @returns A new array that satisfies the maximum count.
   */
  private limitMessageCount(messages: Message[]): Message[] {
    if (messages.length <= MAX_MESSAGES_PER_SESSION) {
      return messages;
    }

    const